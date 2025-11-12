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
    m: number;

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
        this.m = this.edges.length;

        for (const node of this.nodes) {
            this.adj.set(node, []);
            this.degrees.set(node, 0);
        }

        for (const edge of this.edges) {
            if (this.nodes.has(edge.source) && this.nodes.has(edge.target)) {
                this.adj.get(edge.source)!.push(edge.target);
                this.adj.get(edge.target)!.push(edge.source);
                this.degrees.set(edge.source, this.degrees.get(edge.source)! + 1);
                this.degrees.set(edge.target, this.degrees.get(edge.target)! + 1);
            }
        }
    }
}

// --- Algorithm Implementations ---

// 1. Label Propagation Algorithm
const runLabelPropagation = (graph: Graph): CommunityAssignment[] => {
    const nodeIds = Array.from(graph.nodes).sort();
    let communities = new Map<string, string>(); // node -> community label
    nodeIds.forEach(node => communities.set(node, node));

    let changed = true;
    let iterations = 0;
    const maxIterations = 20;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;
        
        for (const node of nodeIds) {
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

            // Tie-breaking: choose the lexicographically smallest label
            const newCommunity = bestLabels.sort()[0];

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

// 2. Louvain Algorithm - REFACTORED to full 2-phase implementation
const runLouvain = (graph: Graph, params: LouvainParams): CommunityAssignment[] => {
    const { resolution } = params;

    if (graph.m === 0) {
        return Array.from(graph.nodes).map((node, i) => ({ node, community: i }));
    }

    // --- Helper Data Structures ---
    // Represents the state of the graph partition at a given level
    class Partition {
        nodeToCommunity: Map<string, number>;
        communities: Map<number, Set<string>>;
        sigma_tot: Map<number, number>; // Sum of degrees in a community
        k_i_in: Map<string, Map<number, number>>; // Links from node i to community
        m2: number; // 2 * m

        constructor(nodes: Set<string>, adj: Map<string, string[]>, degrees: Map<string, number>, m: number) {
            this.nodeToCommunity = new Map();
            this.communities = new Map();
            this.sigma_tot = new Map();
            this.k_i_in = new Map();
            this.m2 = 2 * m;

            let communityId = 0;
            for (const node of nodes) {
                this.nodeToCommunity.set(node, communityId);
                this.communities.set(communityId, new Set([node]));
                this.sigma_tot.set(communityId, degrees.get(node)!);
                this.k_i_in.set(node, new Map());
                communityId++;
            }
            
            for(const node of nodes) {
                const neighbors = adj.get(node)!;
                for (const neighbor of neighbors) {
                    const neighborComm = this.nodeToCommunity.get(neighbor)!;
                    this.k_i_in.get(node)!.set(neighborComm, (this.k_i_in.get(node)!.get(neighborComm) || 0) + 1);
                }
            }
        }

        // Move a node to a new community and update data structures
        moveNode(node: string, newComm: number) {
            const oldComm = this.nodeToCommunity.get(node)!;
            const nodeDegree = graph.degrees.get(node)!;

            // Update sigma_tot
            this.sigma_tot.set(oldComm, this.sigma_tot.get(oldComm)! - nodeDegree);
            this.sigma_tot.set(newComm, this.sigma_tot.get(newComm)! + nodeDegree);
            
            // Update communities sets
            this.communities.get(oldComm)!.delete(node);
            if (this.communities.get(oldComm)!.size === 0) {
                this.communities.delete(oldComm);
            }
            this.communities.get(newComm)!.add(node);
            
            // Update nodeToCommunity map
            this.nodeToCommunity.set(node, newComm);
        }
    }
    
    // --- Phase 1: Modularity Optimization ---
    const optimizeModularity = (partition: Partition) => {
        let improvement = true;
        while (improvement) {
            improvement = false;
            const nodes = Array.from(graph.nodes).sort(); // For determinism

            for (const node of nodes) {
                const currentNodeCommunity = partition.nodeToCommunity.get(node)!;
                const neighbors = graph.adj.get(node)!;
                const nodeDegree = graph.degrees.get(node)!;
                let bestCommunity = currentNodeCommunity;
                let maxDeltaQ = 0;

                const neighborCommunities = new Map<number, number>(); // community -> weight
                for(const neighbor of neighbors) {
                    const neighborComm = partition.nodeToCommunity.get(neighbor)!;
                    neighborCommunities.set(neighborComm, (neighborCommunities.get(neighborComm) || 0) + 1);
                }

                for (const [comm, k_i_in_val] of neighborCommunities.entries()) {
                    // Modularity gain for moving node into community `comm`
                    // Simplified formula: delta_Q = k_i,in - (sigma_tot * k_i) / (2m)
                    const deltaQ = k_i_in_val - resolution * (partition.sigma_tot.get(comm)! * nodeDegree) / partition.m2;

                    if (deltaQ > maxDeltaQ) {
                        maxDeltaQ = deltaQ;
                        bestCommunity = comm;
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
        const newNodes: Set<string> = new Set();
        const newLinks: { source: string, target: string }[] = [];
        const communityMap = new Map<number, string>();
        let counter = 0;
        for (const commId of partition.communities.keys()) {
            const newId = counter.toString();
            communityMap.set(commId, newId);
            newNodes.add(newId);
            counter++;
        }
        
        const communityWeights = new Map<string, number>();
        for (const edge of graph.edges) {
            const comm1 = partition.nodeToCommunity.get(edge.source)!;
            const comm2 = partition.nodeToCommunity.get(edge.target)!;
            
            if (comm1 !== comm2) {
                const newComm1 = communityMap.get(comm1)!;
                const newComm2 = communityMap.get(comm2)!;
                const key = newComm1 < newComm2 ? `${newComm1}|${newComm2}` : `${newComm2}|${newComm1}`;
                communityWeights.set(key, (communityWeights.get(key) || 0) + 1);
            }
        }
        
        for(const [key, weight] of communityWeights.entries()) {
            const [source, target] = key.split('|');
             for(let i = 0; i < weight; i++) { // Add edges based on weight
                newLinks.push({ source, target });
             }
        }
        
        return { nodes: Array.from(newNodes).map(id => ({ id } as AppNode)), links: newLinks };
    };
    
    // --- Main Louvain Loop ---
    let communityHierarchy: Map<string, number>[] = [];
    let currentPartition = new Partition(graph.nodes, graph.adj, graph.degrees, graph.m);
    
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
        currentPartition = new Partition(graph.nodes, graph.adj, graph.degrees, graph.m);
    }
    
    // --- Map communities back to original nodes ---
    let finalPartition = new Map<string, number>();
    const originalNodes = Array.from(new Set(communityHierarchy[0].keys()));
    originalNodes.forEach(node => finalPartition.set(node, communityHierarchy[0].get(node)!));

    for (let level = 1; level < communityHierarchy.length; level++) {
        const levelPartition = communityHierarchy[level];
        const newFinalPartition = new Map<string, number>();
        for (const [node, community] of finalPartition.entries()) {
            const mappedComm = levelPartition.get(community.toString());
            if (mappedComm !== undefined) {
                 newFinalPartition.set(node, mappedComm);
            }
        }
        finalPartition = newFinalPartition;
    }
    
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
    const currentEdges = new Set(graph.edges.map(e => e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`));
    const tempAdj = new Map<string, Set<string>>();
    graph.nodes.forEach(n => tempAdj.set(n, new Set()));
    graph.edges.forEach(e => {
        tempAdj.get(e.source)!.add(e.target);
        tempAdj.get(e.target)!.add(e.source);
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

    while(numComponents < targetCommunities && currentEdges.size > 0) {
        // Calculate edge betweenness
        const betweenness = new Map<string, number>();
        currentEdges.forEach(e => betweenness.set(e, 0.0));

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
        currentEdges.delete(edgeToRemove);
        tempAdj.get(u)!.delete(v);
        tempAdj.get(v)!.delete(u);

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