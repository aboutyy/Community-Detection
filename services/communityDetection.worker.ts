// Inlined types from types.ts
// FIX: Renamed Algorithm to AppAlgorithm to avoid conflicts with global types in the worker environment.
enum AppAlgorithm {
  LOUVAIN = 'Louvain 算法',
  GIRVAN_NEWMAN = 'Girvan-Newman 算法',
  LABEL_PROPAGATION = '标签传播算法',
}

interface CommunityAssignment {
  node: string;
  community: number;
}

// FIX: Renamed Node to AppNode to avoid conflicts with the global DOM Node type in the worker environment.
interface AppNode {
  id: string;
  community?: number;
  description?: string;
  imageUrl?: string;
  isMisclassified?: boolean;
  groundTruthCommunity?: number;
  attributes?: { [key: string]: number };
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | AppNode;
  target: string | AppNode;
}

interface GraphData {
  nodes: AppNode[];
  links: Link[];
}

interface LouvainParams {
  resolution: number;
}

interface GirvanNewmanParams {
    targetCommunities: number;
}


// Helper class for graph operations
class Graph {
    nodes: Set<string>;
    edges: { source: string, target: string }[];
    adj: Map<string, string[]>;
    degrees: Map<string, number>;
    m: number; // Total weight of edges (1 for each link in unweighted graph)

    constructor(graphData: GraphData) {
        this.nodes = new Set(graphData.nodes.map(n => n.id));
        
        // FIX: Sanitize links to ensure source/target are always string IDs. D3-force can
        // mutate the link objects, replacing string IDs with full Node objects. This
        // ensures the worker's graph logic works correctly.
        this.edges = graphData.links.map(link => ({
            source: typeof link.source === 'object' && link.source !== null ? (link.source as AppNode).id : String(link.source),
            target: typeof link.target === 'object' && link.target !== null ? (link.target as AppNode).id : String(link.target),
        }));

        this.adj = new Map();
        this.degrees = new Map();
        this.m = 0; 

        for (const node of this.nodes) {
            this.adj.set(node, []);
            this.degrees.set(node, 0);
        }

        for (const edge of this.edges) {
            if (this.nodes.has(edge.source) && this.nodes.has(edge.target)) {
                this.adj.get(edge.source)!.push(edge.target);
                this.degrees.set(edge.source, this.degrees.get(edge.source)! + 1);
                
                // For undirected graphs, add reverse edge and degree
                if (edge.source !== edge.target) {
                    this.adj.get(edge.target)!.push(edge.source);
                    this.degrees.set(edge.target, this.degrees.get(edge.target)! + 1);
                }
                this.m++;
            }
        }
    }
}

// --- Algorithm Implementations ---

const shuffle = <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};


// 1. Label Propagation Algorithm
const runLabelPropagation = (graph: Graph): CommunityAssignment[] => {
    let communities = new Map<string, string>(); // node -> community label
    Array.from(graph.nodes).forEach(node => communities.set(node, node));

    let changed = true;
    let iterations = 0;
    const maxIterations = 30;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        
        const shuffledNodes = shuffle(Array.from(graph.nodes));

        for (const node of shuffledNodes) {
            const neighbors = graph.adj.get(node) || [];
            if (neighbors.length === 0) continue;

            const labelCounts = new Map<string, number>();
            for (const neighbor of neighbors) {
                const neighborComm = communities.get(neighbor)!;
                labelCounts.set(neighborComm, (labelCounts.get(neighborComm) || 0) + 1);
            }

            let maxCount = 0;
            let bestLabels: string[] = [];
            for (const [label, count] of labelCounts.entries()) {
                if (count > maxCount) {
                    maxCount = count;
                    bestLabels = [label];
                } else if (count === maxCount) {
                    bestLabels.push(label);
                }
            }
            
            const newCommunity = bestLabels[Math.floor(Math.random() * bestLabels.length)];

            if (communities.get(node) !== newCommunity) {
                communities.set(node, newCommunity);
                changed = true;
            }
        }
    }
    
    // Normalize community IDs to integers
    const uniqueLabels = [...new Set(communities.values())].sort();
    const labelMap = new Map(uniqueLabels.map((label, i) => [label, i]));

    return Array.from(communities.entries()).map(([node, community]) => ({
        node,
        community: labelMap.get(community)!
    }));
};

// 2. Louvain Algorithm
const runLouvain = (graph: Graph, params: LouvainParams): CommunityAssignment[] => {
    const { resolution } = params;

    if (graph.m === 0) {
        return Array.from(graph.nodes).map((node, i) => ({ node, community: i }));
    }

    class Partition {
        nodeToCommunity: Map<string, number>;
        communities: Map<number, Set<string>>;
        sigma_tot: Map<number, number>;
        m2: number;

        constructor(nodes: Set<string>, degrees: Map<string, number>, m: number) {
            this.nodeToCommunity = new Map();
            this.communities = new Map();
            this.sigma_tot = new Map();
            this.m2 = 2 * m;

            let communityId = 0;
            for (const node of nodes) {
                this.nodeToCommunity.set(node, communityId);
                this.communities.set(communityId, new Set([node]));
                this.sigma_tot.set(communityId, degrees.get(node)!);
                communityId++;
            }
        }

        moveNode(node: string, newComm: number) {
            const oldComm = this.nodeToCommunity.get(node)!;
            const nodeDegree = graph.degrees.get(node)!;

            this.sigma_tot.set(oldComm, this.sigma_tot.get(oldComm)! - nodeDegree);
            this.sigma_tot.set(newComm, this.sigma_tot.get(newComm)! + nodeDegree);
            
            this.communities.get(oldComm)!.delete(node);
            if (this.communities.get(oldComm)!.size === 0) {
                this.communities.delete(oldComm);
            }
            this.communities.get(newComm)!.add(node);
            
            this.nodeToCommunity.set(node, newComm);
        }
    }
    
    // --- Phase 1: Modularity Optimization ---
    const optimizeModularity = (partition: Partition) => {
        let improvement = true;
        let pass_count = 0;
        while (improvement && pass_count < 100) { // Failsafe
            pass_count++;
            improvement = false;
            const nodes = Array.from(graph.nodes).sort(); // For determinism

            for (const node of nodes) {
                const nodeDegree = graph.degrees.get(node)!;
                const neighbors = graph.adj.get(node)!;
                const currentNodeCommunity = partition.nodeToCommunity.get(node)!;

                // Calculate connections to neighbor communities
                const neighborCommunities = new Map<number, number>(); // community -> weight
                for(const neighbor of neighbors) {
                    const neighborComm = partition.nodeToCommunity.get(neighbor)!;
                    neighborCommunities.set(neighborComm, (neighborCommunities.get(neighborComm) || 0) + 1);
                }

                const k_i_in_current = neighborCommunities.get(currentNodeCommunity) || 0;
                const sigma_tot_current = partition.sigma_tot.get(currentNodeCommunity)!;

                let bestCommunity = currentNodeCommunity;
                let maxGain = 0.0; // The gain of staying is 0. We only move if gain > 0.
                
                // Iterate over potential new communities (only neighbors' communities)
                for (const [targetComm, k_i_in_target] of neighborCommunities.entries()) {
                    if (targetComm === currentNodeCommunity) {
                        continue;
                    }

                    const sigma_tot_target = partition.sigma_tot.get(targetComm)!;

                    // This is the change in modularity if we move 'node' from its current comm to targetComm
                    const gain_links = k_i_in_target - k_i_in_current;
                    const gain_degrees = (resolution * nodeDegree / partition.m2) * ((sigma_tot_current - nodeDegree) - sigma_tot_target);
                    
                    const net_gain = gain_links + gain_degrees;

                    if (net_gain > maxGain) {
                        maxGain = net_gain;
                        bestCommunity = targetComm;
                    }
                }
                
                if (bestCommunity !== currentNodeCommunity) {
                    partition.moveNode(node, bestCommunity);
                    improvement = true;
                }
            }
        }
    };
    
    // --- Phase 2: Community Aggregation ---
    const aggregateCommunities = (partition: Partition): GraphData => {
        const communityIds = Array.from(partition.communities.keys());
        const newNodes = communityIds.map(id => ({ id: id.toString() } as AppNode));
        const newLinks: { source: string, target: string }[] = [];
        
        const communityWeights = new Map<string, number>();

        for (const edge of graph.edges) {
            const comm1 = partition.nodeToCommunity.get(edge.source)!;
            const comm2 = partition.nodeToCommunity.get(edge.target)!;
            const comm1Str = comm1.toString();
            const comm2Str = comm2.toString();

            const key = comm1 <= comm2 ? `${comm1Str}|${comm2Str}` : `${comm2Str}|${comm1Str}`;
            communityWeights.set(key, (communityWeights.get(key) || 0) + 1);
        }

        for (const [key, weight] of communityWeights.entries()) {
            const [source, target] = key.split('|');
            for (let i = 0; i < weight; i++) {
                newLinks.push({ source, target });
            }
        }
        
        return { nodes: newNodes, links: newLinks };
    };
    
    // --- Main Louvain Loop ---
    let communityHierarchy: Map<string, number>[] = [];
    let currentPartition = new Partition(graph.nodes, graph.degrees, graph.m);
    
    while (true) {
        optimizeModularity(currentPartition);
        communityHierarchy.push(new Map(currentPartition.nodeToCommunity));
        
        const numCommunities = currentPartition.communities.size;
        if (numCommunities === graph.nodes.size) {
            // No improvement was made, stop.
            break;
        }
        
        const newGraphData = aggregateCommunities(currentPartition);
        if (newGraphData.links.length === 0) {
            // No more inter-community links
            break;
        }

        graph = new Graph(newGraphData);
        currentPartition = new Partition(graph.nodes, graph.degrees, graph.m);
    }
    
    // --- Map communities back to original nodes (Robust Implementation) ---
    const finalPartition = new Map();
    const originalNodes = Array.from(communityHierarchy[0].keys());

    originalNodes.forEach(node => {
        let currentCommunity = communityHierarchy[0].get(node);
        for (let level = 1; level < communityHierarchy.length; level++) {
            const nextLevelCommunity = communityHierarchy[level].get(String(currentCommunity));
            if (nextLevelCommunity === undefined) {
                break; // This community was not aggregated further.
            }
            currentCommunity = nextLevelCommunity;
        }
        finalPartition.set(node, currentCommunity);
    });
    
    const uniqueLabels = [...new Set(finalPartition.values())].sort((a,b)=>a-b);
    const labelMap = new Map(uniqueLabels.map((label, i) => [label, i]));

    return Array.from(finalPartition.entries()).map(([node, community]) => ({
        node,
        community: labelMap.get(community)!
    }));
};


// 3. Girvan-Newman Algorithm
const runGirvanNewman = (graph: Graph, params: GirvanNewmanParams): CommunityAssignment[] => {
    const { targetCommunities } = params;
    
    const tempAdj = new Map<string, Set<string>>();
    graph.nodes.forEach(n => tempAdj.set(n, new Set()));
    graph.edges.forEach(e => {
        tempAdj.get(e.source)!.add(e.target);
        if (e.source !== e.target) {
            tempAdj.get(e.target)!.add(e.source);
        }
    });

    const getComponents = () => {
        const components: string[][] = [];
        const visited = new Set<string>();
        for (const node of graph.nodes) {
            if (!visited.has(node)) {
                const component: string[] = [];
                const q = [node];
                visited.add(node);
                let head = 0;
                while (head < q.length) {
                    const u = q[head++];
                    component.push(u);
                    for (const v of tempAdj.get(u)!) {
                        if (!visited.has(v)) {
                            visited.add(v);
                            q.push(v);
                        }
                    }
                }
                components.push(component);
            }
        }
        return components;
    };

    let numComponents = getComponents().length;
    let m = graph.m;

    while(numComponents < targetCommunities && m > 0) {
        // Calculate edge betweenness
        const betweenness = new Map<string, number>();

        for (const node of graph.nodes) {
            const S: string[] = [];
            const P = new Map<string, string[]>();
            graph.nodes.forEach(n => P.set(n, []));
            const sigma = new Map<string, number>();
            graph.nodes.forEach(n => sigma.set(n, 0));
            sigma.set(node, 1);
            const d = new Map<string, number>();
            graph.nodes.forEach(n => d.set(n, -1));
            d.set(node, 0);

            const Q = [node];
            let head = 0;
            while(head < Q.length) {
                const v = Q[head++];
                S.push(v);
                for(const w of tempAdj.get(v)!) {
                    if (d.get(w)! < 0) {
                        Q.push(w);
                        d.set(w, d.get(v)! + 1);
                    }
                    if (d.get(w) === d.get(v)! + 1) {
                        sigma.set(w, sigma.get(w)! + sigma.get(v)!);
                        P.get(w)!.push(v);
                    }
                }
            }

            const delta = new Map<string, number>();
            graph.nodes.forEach(n => delta.set(n, 0));
            
            while(S.length > 0) {
                const w = S.pop()!;
                for(const v of P.get(w)!) {
                    const c = (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!);
                    const edgeKey = v < w ? `${v}|${w}` : `${w}|${v}`;
                    betweenness.set(edgeKey, (betweenness.get(edgeKey) || 0) + c);
                    delta.set(v, delta.get(v)! + c);
                }
            }
        }
        
        let maxBetweenness = -1;
        let edgeToRemove = '';
        for(const [edge, val] of betweenness.entries()) {
            if (val > maxBetweenness) {
                maxBetweenness = val;
                edgeToRemove = edge;
            }
        }
        
        if (!edgeToRemove) break; // No more edges to remove

        const [u, v] = edgeToRemove.split('|');
        tempAdj.get(u)!.delete(v);
        tempAdj.get(v)!.delete(u);
        m--;

        numComponents = getComponents().length;
    }

    const finalComponents = getComponents();
    const result: CommunityAssignment[] = [];
    finalComponents.forEach((component, i) => {
        component.forEach(node => {
            result.push({ node, community: i });
        });
    });

    return result;
};


self.onmessage = (event: MessageEvent) => {
    const { graphData, algorithm, params } = event.data;
    
    try {
        const graph = new Graph(graphData);
        let result: CommunityAssignment[];

        switch(algorithm) {
            case AppAlgorithm.LOUVAIN:
                result = runLouvain(graph, params as LouvainParams);
                break;
            case AppAlgorithm.GIRVAN_NEWMAN:
                if (graph.nodes.size > 100) {
                    throw new Error("Girvan-Newman 算法对于超过100个节点的图来说太慢了。请选择一个更小的网络或不同的算法。");
                }
                result = runGirvanNewman(graph, params as GirvanNewmanParams);
                break;
            case AppAlgorithm.LABEL_PROPAGATION:
                result = runLabelPropagation(graph);
                break;
            default:
                throw new Error(`选择了未知的算法: ${algorithm}`);
        }
        
        self.postMessage({ type: 'SUCCESS', payload: result });

    } catch (error) {
        self.postMessage({ type: 'ERROR', payload: error instanceof Error ? error.message : 'Worker中发生未知错误。' });
    }
};