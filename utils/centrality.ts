import { GraphData, CentralityResult, CentralityAlgorithm, Node, HITSCentralityResult } from '../types';

// #region Graph Representation
interface GraphRepresentation {
    adj: Map<string, string[]>; // For traversal from a node
    revAdj: Map<string, string[]>; // For finding nodes pointing to a node
    outDegrees: Map<string, number>;
}
const buildGraphRepresentation = (graphData: GraphData, isDirected: boolean): GraphRepresentation => {
    const adj = new Map<string, string[]>();
    const revAdj = new Map<string, string[]>();
    const outDegrees = new Map<string, number>();

    graphData.nodes.forEach(n => {
        adj.set(n.id, []);
        revAdj.set(n.id, []);
        outDegrees.set(n.id, 0);
    });

    graphData.links.forEach(l => {
        const sourceId = typeof l.source === 'object' && l.source !== null ? (l.source as Node).id : String(l.source);
        const targetId = typeof l.target === 'object' && l.target !== null ? (l.target as Node).id : String(l.target);
        
        if (adj.has(sourceId) && adj.has(targetId)) {
            adj.get(sourceId)!.push(targetId);
            revAdj.get(targetId)!.push(sourceId);
            outDegrees.set(sourceId, outDegrees.get(sourceId)! + 1);
            if (!isDirected) {
                adj.get(targetId)!.push(sourceId);
                revAdj.get(sourceId)!.push(targetId);
                outDegrees.set(targetId, outDegrees.get(targetId)! + 1);
            }
        }
    });
    return { adj, revAdj, outDegrees };
};
// #endregion

// #region Degree Centrality
const calculateInDegreeCentrality = (graphData: GraphData): CentralityResult[] => {
  const { nodes, links } = graphData;
  const numNodes = nodes.length;
  if (numNodes <= 1) return nodes.map(node => ({ nodeId: node.id, score: 0 }));
  
  const inDegrees = new Map<string, number>();
  nodes.forEach(node => inDegrees.set(node.id, 0));

  links.forEach(link => {
    const targetId = typeof link.target === 'object' && link.target !== null ? (link.target as Node).id : String(link.target);
    if (inDegrees.has(targetId)) {
        inDegrees.set(targetId, (inDegrees.get(targetId) || 0) + 1);
    }
  });

  return Array.from(inDegrees.entries()).map(([nodeId, degree]) => ({
      nodeId,
      score: degree / (numNodes - 1)
  }));
};

const calculateOutDegreeCentrality = (graphData: GraphData): CentralityResult[] => {
  const { nodes, links } = graphData;
  const numNodes = nodes.length;
  if (numNodes <= 1) return nodes.map(node => ({ nodeId: node.id, score: 0 }));

  const outDegrees = new Map<string, number>();
  nodes.forEach(node => outDegrees.set(node.id, 0));

  links.forEach(link => {
    const sourceId = typeof link.source === 'object' && link.source !== null ? (link.source as Node).id : String(link.source);
    if (outDegrees.has(sourceId)) {
        outDegrees.set(sourceId, (outDegrees.get(sourceId) || 0) + 1);
    }
  });
  
  return Array.from(outDegrees.entries()).map(([nodeId, degree]) => ({
      nodeId,
      score: degree / (numNodes - 1)
  }));
};
// #endregion

// #region Closeness Centrality
const calculateClosenessCentrality = (graphData: GraphData, isDirected: boolean): CentralityResult[] => {
    const { nodes } = graphData;
    const { adj } = buildGraphRepresentation(graphData, isDirected);
    const results: CentralityResult[] = [];

    for (const startNode of nodes) {
        let totalDistance = 0;
        let reachableNodes = 0;
        const q: [string, number][] = [[startNode.id, 0]];
        const visited = new Set([startNode.id]);

        let head = 0;
        while(head < q.length) {
            const [currentNode, distance] = q[head++];
            
            if (distance > 0) { // Exclude distance to self
                totalDistance += distance;
                reachableNodes++;
            }

            const neighbors = adj.get(currentNode) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    q.push([neighbor, distance + 1]);
                }
            }
        }
        
        // The score is 0 if the node is isolated or the component has only one node.
        const score = (totalDistance > 0 && reachableNodes > 0) 
            ? reachableNodes / totalDistance
            : 0;

        results.push({ nodeId: startNode.id, score });
    }
    return results;
}
// #endregion

// #region Betweenness Centrality (Brandes' Algorithm)
const calculateBetweennessCentrality = (graphData: GraphData, isDirected: boolean): CentralityResult[] => {
    const { nodes } = graphData;
    const { adj } = buildGraphRepresentation(graphData, isDirected);
    const betweenness = new Map<string, number>();
    nodes.forEach(n => betweenness.set(n.id, 0.0));

    for (const s of nodes) {
        const S: string[] = [];
        const P = new Map<string, string[]>();
        nodes.forEach(n => P.set(n.id, []));
        
        const sigma = new Map<string, number>();
        nodes.forEach(n => sigma.set(n.id, 0.0));
        sigma.set(s.id, 1.0);

        const d = new Map<string, number>();
        nodes.forEach(n => d.set(n.id, -1));
        d.set(s.id, 0);

        const Q = [s.id];
        let head = 0;
        while (head < Q.length) {
            const v = Q[head++];
            S.push(v);
            for (const w of adj.get(v)!) {
                if (d.get(w)! < 0) {
                    Q.push(w);
                    d.set(w, d.get(v)! + 1);
                }
                if (d.get(w)! === d.get(v)! + 1) {
                    sigma.set(w, sigma.get(w)! + sigma.get(v)!);
                    P.get(w)!.push(v);
                }
            }
        }
        
        const delta = new Map<string, number>();
        nodes.forEach(n => delta.set(n.id, 0.0));
        
        while (S.length > 0) {
            const w = S.pop()!;
            for (const v of P.get(w)!) {
                const c = (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!);
                delta.set(v, delta.get(v)! + c);
            }
            if (w !== s.id) {
                betweenness.set(w, betweenness.get(w)! + delta.get(w)!);
            }
        }
    }

    // Normalize
    const n = nodes.length;
    let scale = 1.0;
    if (n > 2) {
      scale = isDirected ? (1 / ((n - 1) * (n - 2))) : (2 / ((n - 1) * (n - 2)));
    }
    
    const results: CentralityResult[] = [];
    betweenness.forEach((score, nodeId) => {
        results.push({ nodeId, score: score * scale });
    });

    return results;
};
// #endregion

// #region PageRank
const calculatePageRank = (graphData: GraphData, isDirected: boolean, damping = 0.85, maxIterations = 100, tolerance = 1e-6): CentralityResult[] => {
    const { nodes } = graphData;
    const { revAdj, outDegrees } = buildGraphRepresentation(graphData, isDirected);
    const n = nodes.length;

    if (n === 0) return [];
    
    let ranks = new Map<string, number>();
    nodes.forEach(node => ranks.set(node.id, 1 / n));

    for (let i = 0; i < maxIterations; i++) {
        const newRanks = new Map<string, number>();
        let diff = 0;
        let danglingSum = 0;

        // Calculate sum of ranks from dangling nodes (nodes with no outgoing links)
        for (const node of nodes) {
            if (outDegrees.get(node.id)! === 0) {
                danglingSum += ranks.get(node.id)!;
            }
        }

        for (const node of nodes) {
            let rankSum = 0;
            const incomingNeighbors = revAdj.get(node.id)!;
            for (const neighbor of incomingNeighbors) {
                const neighborOutDegree = outDegrees.get(neighbor)!;
                if (neighborOutDegree > 0) {
                    rankSum += ranks.get(neighbor)! / neighborOutDegree;
                }
            }
            
            const danglingContribution = danglingSum / n;
            const newRank = (1 - damping) / n + damping * (rankSum + danglingContribution);
            newRanks.set(node.id, newRank);
            diff += Math.abs(newRanks.get(node.id)! - ranks.get(node.id)!);
        }

        ranks = newRanks;
        if (diff < tolerance) {
            break;
        }
    }
    
    // Normalize so sum is 1
    const totalRank = Array.from(ranks.values()).reduce((sum, rank) => sum + rank, 0);
    const results: CentralityResult[] = [];
    if (totalRank > 1e-9) {
        ranks.forEach((score, nodeId) => {
            results.push({ nodeId, score: score / totalRank });
        });
    }

    return results;
};
// #endregion

// #region HITS (Authorities and Hubs)
const calculateHITS = (graphData: GraphData, isDirected: boolean, maxIterations = 100, tolerance = 1e-6): HITSCentralityResult => {
    const { nodes } = graphData;
    const { adj, revAdj } = buildGraphRepresentation(graphData, isDirected);
    const n = nodes.length;

    if (n === 0) return { authority: [], hub: [] };

    let authorityScores = new Map<string, number>();
    let hubScores = new Map<string, number>();
    nodes.forEach(node => {
        authorityScores.set(node.id, 1.0);
        hubScores.set(node.id, 1.0);
    });

    for (let i = 0; i < maxIterations; i++) {
        const lastAuth = new Map(authorityScores);
        let authSumSq = 0;
        
        // Update authority scores
        for (const node of nodes) {
            let score = 0;
            const incomingNeighbors = revAdj.get(node.id) || [];
            for (const neighbor of incomingNeighbors) {
                score += hubScores.get(neighbor)!; // Use hub scores from previous iteration
            }
            authorityScores.set(node.id, score);
            authSumSq += score * score;
        }

        // Normalize authority scores
        const authNorm = Math.sqrt(authSumSq) || 1;
        authorityScores.forEach((score, id) => authorityScores.set(id, score / authNorm));

        let hubSumSq = 0;
        
        // Update hub scores
        for (const node of nodes) {
            let score = 0;
            const outgoingNeighbors = adj.get(node.id) || [];
            for (const neighbor of outgoingNeighbors) {
                score += authorityScores.get(neighbor)!; // Use the just-updated authority scores
            }
            hubScores.set(node.id, score);
            hubSumSq += score * score;
        }

        // Normalize hub scores
        const hubNorm = Math.sqrt(hubSumSq) || 1;
        hubScores.forEach((score, id) => hubScores.set(id, score / hubNorm));

        let diff = 0;
        for (const node of nodes) {
            diff += Math.abs(authorityScores.get(node.id)! - lastAuth.get(node.id)!);
        }
        if (diff < tolerance) break;
    }
    
    const authorityResults: CentralityResult[] = [];
    authorityScores.forEach((score, nodeId) => authorityResults.push({ nodeId, score }));

    const hubResults: CentralityResult[] = [];
    hubScores.forEach((score, nodeId) => hubResults.push({ nodeId, score }));

    return { authority: authorityResults, hub: hubResults };
};
// #endregion


// #region Dispatcher
export const calculateCentrality = (graphData: GraphData, algorithm: CentralityAlgorithm, isDirected: boolean): CentralityResult[] | HITSCentralityResult => {
    switch(algorithm) {
        case CentralityAlgorithm.IN_DEGREE:
            return calculateInDegreeCentrality(graphData);
        case CentralityAlgorithm.OUT_DEGREE:
            return calculateOutDegreeCentrality(graphData);
        case CentralityAlgorithm.CLOSENESS:
            return calculateClosenessCentrality(graphData, isDirected);
        case CentralityAlgorithm.BETWEENNESS:
            return calculateBetweennessCentrality(graphData, isDirected);
        case CentralityAlgorithm.PAGERANK:
            return calculatePageRank(graphData, isDirected);
        case CentralityAlgorithm.HITS_AUTHORITY:
        case CentralityAlgorithm.HITS_HUB:
            return calculateHITS(graphData, isDirected);
        default:
            return [];
    }
}
// #endregion