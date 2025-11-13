import { Algorithm, CommunityAssignment, GraphData, LouvainParams, GirvanNewmanParams } from '../types';

interface RunDetectionParams {
  graphData: GraphData;
  algorithm: Algorithm;
  params: LouvainParams | GirvanNewmanParams | {};
  signal: AbortSignal;
}

const workerCode = `
const AppAlgorithm = {
  LOUVAIN: 'Louvain 算法',
  GIRVAN_NEWMAN: 'Girvan-Newman 算法',
  LABEL_PROPAGATION: '标签传播算法',
};

class Graph {
    constructor(graphData) {
        this.nodes = new Set(graphData.nodes.map(n => n.id));
        
        this.edges = graphData.links.map(link => ({
            source: typeof link.source === 'object' && link.source !== null ? link.source.id : String(link.source),
            target: typeof link.target === 'object' && link.target !== null ? link.target.id : String(link.target),
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
                this.adj.get(edge.source).push(edge.target);
                this.adj.get(edge.target).push(edge.source);
                this.degrees.set(edge.source, this.degrees.get(edge.source) + 1);
                this.degrees.set(edge.target, this.degrees.get(edge.target) + 1);
            }
        }
    }
}

// 1. Label Propagation Algorithm
const runLabelPropagation = (graph) => {
    const nodeIds = Array.from(graph.nodes).sort();
    let communities = new Map(); // node -> community label
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

            const labelCounts = new Map();
            for (const neighbor of neighbors) {
                const neighborComm = communities.get(neighbor);
                labelCounts.set(neighborComm, (labelCounts.get(neighborComm) || 0) + 1);
            }

            let maxCount = 0;
            let bestLabels = [];
            for (const [label, count] of labelCounts.entries()) {
                if (count > maxCount) {
                    maxCount = count;
                    bestLabels = [label];
                } else if (count === maxCount) {
                    bestLabels.push(label);
                }
            }
            
            const newCommunity = bestLabels.sort()[0];

            if (communities.get(node) !== newCommunity) {
                communities.set(node, newCommunity);
                changed = true;
            }
        }
    }
    
    const uniqueLabels = [...new Set(communities.values())].sort();
    const labelMap = new Map(uniqueLabels.map((label, i) => [label, i]));

    return Array.from(communities.entries()).map(([node, community]) => ({
        node,
        community: labelMap.get(community)
    }));
};

// 2. Louvain Algorithm
const runLouvain = (graph, params) => {
    const { resolution } = params;

    if (graph.m === 0) {
        return Array.from(graph.nodes).map((node, i) => ({ node, community: i }));
    }

    class Partition {
        constructor(nodes, adj, degrees, m) {
            this.nodeToCommunity = new Map();
            this.communities = new Map();
            this.sigma_tot = new Map();
            this.m2 = 2 * m;

            let communityId = 0;
            for (const node of nodes) {
                this.nodeToCommunity.set(node, communityId);
                this.communities.set(communityId, new Set([node]));
                this.sigma_tot.set(communityId, degrees.get(node));
                communityId++;
            }
        }

        moveNode(node, newComm) {
            const oldComm = this.nodeToCommunity.get(node);
            const nodeDegree = graph.degrees.get(node);

            this.sigma_tot.set(oldComm, this.sigma_tot.get(oldComm) - nodeDegree);
            this.sigma_tot.set(newComm, this.sigma_tot.get(newComm) + nodeDegree);
            
            this.communities.get(oldComm).delete(node);
            if (this.communities.get(oldComm).size === 0) {
                this.communities.delete(oldComm);
            }
            this.communities.get(newComm).add(node);
            
            this.nodeToCommunity.set(node, newComm);
        }
    }
    
    const optimizeModularity = (partition) => {
        let improvement = true;
        let pass_count = 0;
        while (improvement && pass_count < 100) { // Failsafe
            pass_count++;
            improvement = false;
            const nodes = Array.from(graph.nodes).sort(); // For determinism

            for (const node of nodes) {
                const nodeDegree = graph.degrees.get(node);
                const neighbors = graph.adj.get(node) || [];
                const currentNodeCommunity = partition.nodeToCommunity.get(node);

                // Calculate connections to neighbor communities
                const neighborCommunities = new Map(); // community -> weight
                for(const neighbor of neighbors) {
                    const neighborComm = partition.nodeToCommunity.get(neighbor);
                    neighborCommunities.set(neighborComm, (neighborCommunities.get(neighborComm) || 0) + 1);
                }

                const k_i_in_current = neighborCommunities.get(currentNodeCommunity) || 0;
                const sigma_tot_current = partition.sigma_tot.get(currentNodeCommunity);

                let bestCommunity = currentNodeCommunity;
                let maxGain = 0.0; // The gain of staying is 0. We only move if gain > 0.
                
                // Iterate over potential new communities (only neighbors' communities)
                for (const [targetComm, k_i_in_target] of neighborCommunities.entries()) {
                    if (targetComm === currentNodeCommunity) {
                        continue;
                    }

                    const sigma_tot_target = partition.sigma_tot.get(targetComm);

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
    
    const aggregateCommunities = (partition) => {
        const communityIds = Array.from(partition.communities.keys());
        const newNodes = communityIds.map(id => ({ id: id.toString() }));
        const newLinks = [];
        
        const communityWeights = new Map();
        for (const edge of graph.edges) {
            const comm1 = partition.nodeToCommunity.get(edge.source);
            const comm2 = partition.nodeToCommunity.get(edge.target);
            
            if (comm1 !== comm2) {
                const newComm1 = comm1.toString();
                const newComm2 = comm2.toString();
                const key = newComm1 < newComm2 ? \`\${newComm1}|\${newComm2}\` : \`\${newComm2}|\${newComm1}\`;
                communityWeights.set(key, (communityWeights.get(key) || 0) + 1);
            }
        }
        
        for(const [key, weight] of communityWeights.entries()) {
            const [source, target] = key.split('|');
             for(let i = 0; i < weight; i++) {
                newLinks.push({ source, target });
             }
        }
        
        return { nodes: newNodes, links: newLinks };
    };
    
    let communityHierarchy = [];
    let currentPartition = new Partition(graph.nodes, graph.adj, graph.degrees, graph.m);
    
    while (true) {
        optimizeModularity(currentPartition);
        communityHierarchy.push(new Map(currentPartition.nodeToCommunity));
        
        const numCommunities = currentPartition.communities.size;
        if (numCommunities === graph.nodes.size) {
            break;
        }
        
        const newGraphData = aggregateCommunities(currentPartition);
        if (newGraphData.links.length === 0) {
            break;
        }

        graph = new Graph(newGraphData);
        currentPartition = new Partition(graph.nodes, graph.adj, graph.degrees, graph.m);
    }
    
    let finalPartition = new Map();
    const originalNodes = Array.from(new Set(communityHierarchy[0].keys()));
    originalNodes.forEach(node => finalPartition.set(node, communityHierarchy[0].get(node)));

    for (let level = 1; level < communityHierarchy.length; level++) {
        const levelPartition = communityHierarchy[level];
        const newFinalPartition = new Map();
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
        community: labelMap.get(community)
    }));
};


// 3. Girvan-Newman Algorithm
const runGirvanNewman = (graph, params) => {
    const { targetCommunities } = params;
    const currentEdges = new Set(graph.edges.map(e => e.source < e.target ? \`\${e.source}|\${e.target}\` : \`\${e.target}|\${e.source}\`));
    const tempAdj = new Map();
    graph.nodes.forEach(n => tempAdj.set(n, new Set()));
    graph.edges.forEach(e => {
        tempAdj.get(e.source).add(e.target);
        tempAdj.get(e.target).add(e.source);
    });

    const getComponents = () => {
        const components = [];
        const visited = new Set();
        for (const node of graph.nodes) {
            if (!visited.has(node)) {
                const component = [];
                const q = [node];
                visited.add(node);
                let head = 0;
                while (head < q.length) {
                    const u = q[head++];
                    component.push(u);
                    for (const v of tempAdj.get(u)) {
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
        const betweenness = new Map();
        currentEdges.forEach(e => betweenness.set(e, 0.0));

        for (const node of graph.nodes) {
            const S = [];
            const P = new Map();
            graph.nodes.forEach(n => P.set(n, []));
            const sigma = new Map();
            graph.nodes.forEach(n => sigma.set(n, 0));
            sigma.set(node, 1);
            const d = new Map();
            graph.nodes.forEach(n => d.set(n, -1));
            d.set(node, 0);

            const Q = [node];
            let head = 0;
            while(head < Q.length) {
                const v = Q[head++];
                S.push(v);
                for(const w of tempAdj.get(v)) {
                    if (d.get(w) < 0) {
                        Q.push(w);
                        d.set(w, d.get(v) + 1);
                    }
                    if (d.get(w) === d.get(v) + 1) {
                        sigma.set(w, sigma.get(w) + sigma.get(v));
                        P.get(w).push(v);
                    }
                }
            }

            const delta = new Map();
            graph.nodes.forEach(n => delta.set(n, 0));
            
            while(S.length > 0) {
                const w = S.pop();
                for(const v of P.get(w)) {
                    const c = (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w));
                    const edgeKey = v < w ? \`\${v}|\${w}\` : \`\${w}|\${v}\`;
                    betweenness.set(edgeKey, (betweenness.get(edgeKey) || 0) + c);
                    delta.set(v, delta.get(v) + c);
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
        
        if (!edgeToRemove) break;

        const [u, v] = edgeToRemove.split('|');
        currentEdges.delete(edgeToRemove);
        tempAdj.get(u).delete(v);
        tempAdj.get(v).delete(u);

        numComponents = getComponents().length;
    }

    const finalComponents = getComponents();
    const result = [];
    finalComponents.forEach((component, i) => {
        component.forEach(node => {
            result.push({ node, community: i });
        });
    });

    return result;
};


self.onmessage = (event) => {
    const { graphData, algorithm, params } = event.data;
    
    try {
        const graph = new Graph(graphData);
        let result;

        switch(algorithm) {
            case AppAlgorithm.LOUVAIN:
                result = runLouvain(graph, params);
                break;
            case AppAlgorithm.GIRVAN_NEWMAN:
                if (graph.nodes.size > 100) {
                    throw new Error("Girvan-Newman 算法对于超过100个节点的图来说太慢了。请选择一个更小的网络或不同的算法。");
                }
                result = runGirvanNewman(graph, params);
                break;
            case AppAlgorithm.LABEL_PROPAGATION:
                result = runLabelPropagation(graph);
                break;
            default:
                throw new Error(\`选择了未知的算法: \${algorithm}\`);
        }
        
        self.postMessage({ type: 'SUCCESS', payload: result });

    } catch (error) {
        self.postMessage({ type: 'ERROR', payload: error instanceof Error ? error.message : 'Worker中发生未知错误。' });
    }
};
`;

export const runCommunityDetection = ({ graphData, algorithm, params, signal }: RunDetectionParams): Promise<CommunityAssignment[]> => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    const cleanup = () => {
      URL.revokeObjectURL(workerUrl);
      signal.removeEventListener('abort', handleAbort);
      worker.terminate();
    };

    const handleAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal.addEventListener('abort', handleAbort, { once: true });

    worker.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'SUCCESS') {
        resolve(payload);
      } else {
        reject(new Error(payload));
      }
      cleanup();
    };

    worker.onerror = (error) => {
      reject(new Error(`社区发现 Worker 错误: ${error.message}`));
      cleanup();
    };

    worker.postMessage({
      graphData,
      algorithm,
      params,
    });
  });
};

export const getAlgorithmExplanation = (algorithm: Algorithm): string => {
  switch(algorithm) {
    case Algorithm.LOUVAIN:
      return "Louvain 算法是一种贪婪的模块度优化算法。它分两个阶段迭代进行：首先，将每个节点分配到其自己的社区中，然后，如果移动能够增加网络的模块度，则将节点移动到其邻居的社区中。其次，它会构建一个新网络，其中节点是第一阶段形成的社区。这个过程会重复进行，直到模块度无法再提高为止，从而揭示出层次化的社区结构。";
    case Algorithm.GIRVAN_NEWMAN:
      return "Girvan-Newman 算法是一种分裂式的层次聚类方法。它通过迭代地移除网络中“边介数中心性”最高的边来工作。“边介数”衡量的是网络中所有节点对之间的最短路径经过某条边的次数。移除这些“桥梁”边会逐渐将网络分解成独立的社区。该算法会一直持续，直到达到预设的社区数量。";
    case Algorithm.LABEL_PROPAGATION:
      return "标签传播算法（LPA）是一种快速的社区发现算法。开始时，每个节点都被赋予一个唯一的标签（即它自己的社区）。然后，在每次迭代中，每个节点都会采纳其邻居中最常见的标签。这个过程会以异步或同步的方式重复，直到没有节点改变其标签，从而形成稳定的社区。由于其近线性的时间复杂度，它非常适用于大型网络。";
    default:
      return "请选择一种算法以查看其解释。";
  }
};