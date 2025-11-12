import { GraphData, LinkPredictionResult, LinkPredictionAlgorithm, Node } from '../types';

// #region Graph Representation & Helpers
interface PredictionGraph {
    nodes: string[];
    adj: Map<string, Set<string>>;
    degrees: Map<string, number>;
    existingLinks: Set<string>;
}

const buildPredictionGraph = (graphData: GraphData): PredictionGraph => {
    const adj = new Map<string, Set<string>>();
    const degrees = new Map<string, number>();
    const nodes = graphData.nodes.map(n => n.id);
    const existingLinks = new Set<string>();

    nodes.forEach(nodeId => {
        adj.set(nodeId, new Set());
        degrees.set(nodeId, 0);
    });

    graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' && link.source !== null ? (link.source as Node).id : String(link.source);
        const targetId = typeof link.target === 'object' && link.target !== null ? (link.target as Node).id : String(link.target);
        
        if (adj.has(sourceId) && adj.has(targetId)) {
            adj.get(sourceId)!.add(targetId);
            adj.get(targetId)!.add(sourceId);
            degrees.set(sourceId, (degrees.get(sourceId) || 0) + 1);
            degrees.set(targetId, (degrees.get(targetId) || 0) + 1);
            
            // Store existing links to avoid predicting them
            const key = sourceId < targetId ? `${sourceId}|${targetId}` : `${targetId}|${sourceId}`;
            existingLinks.add(key);
        }
    });

    return { nodes, adj, degrees, existingLinks };
};

function* getCandidateLinks(graph: PredictionGraph) {
    for (let i = 0; i < graph.nodes.length; i++) {
        for (let j = i + 1; j < graph.nodes.length; j++) {
            const u = graph.nodes[i];
            const v = graph.nodes[j];
            const key = `${u}|${v}`;
            if (!graph.existingLinks.has(key)) {
                yield [u, v];
            }
        }
    }
}
// #endregion

// #region Algorithm Implementations
const calculateCommonNeighbors = (graph: PredictionGraph): LinkPredictionResult[] => {
    const results: LinkPredictionResult[] = [];
    for (const [u, v] of getCandidateLinks(graph)) {
        const neighborsU = graph.adj.get(u)!;
        const neighborsV = graph.adj.get(v)!;
        const intersection = new Set([...neighborsU].filter(n => neighborsV.has(n)));
        if (intersection.size > 0) {
            results.push({ source: u, target: v, score: intersection.size });
        }
    }
    return results;
};

const calculateJaccard = (graph: PredictionGraph): LinkPredictionResult[] => {
    const results: LinkPredictionResult[] = [];
     for (const [u, v] of getCandidateLinks(graph)) {
        const neighborsU = graph.adj.get(u)!;
        const neighborsV = graph.adj.get(v)!;
        const intersection = new Set([...neighborsU].filter(n => neighborsV.has(n)));
        const union = new Set([...neighborsU, ...neighborsV]);
        if (union.size > 0) {
            results.push({ source: u, target: v, score: intersection.size / union.size });
        }
    }
    return results;
};

const calculateAdamicAdar = (graph: PredictionGraph): LinkPredictionResult[] => {
    const results: LinkPredictionResult[] = [];
    for (const [u, v] of getCandidateLinks(graph)) {
        const neighborsU = graph.adj.get(u)!;
        const neighborsV = graph.adj.get(v)!;
        const commonNeighbors = [...neighborsU].filter(n => neighborsV.has(n));
        
        let score = 0;
        for (const w of commonNeighbors) {
            const degreeW = graph.degrees.get(w)!;
            if (degreeW > 1) { // Avoid log(1) = 0 which would lead to division by zero
                score += 1 / Math.log(degreeW);
            }
        }

        if (score > 0) {
            results.push({ source: u, target: v, score });
        }
    }
    return results;
};

const calculatePreferentialAttachment = (graph: PredictionGraph): LinkPredictionResult[] => {
    const results: LinkPredictionResult[] = [];
    for (const [u, v] of getCandidateLinks(graph)) {
        const degreeU = graph.degrees.get(u)!;
        const degreeV = graph.degrees.get(v)!;
        const score = degreeU * degreeV;
        if (score > 0) {
            results.push({ source: u, target: v, score });
        }
    }
    return results;
};
// #endregion

// #region Dispatcher
export const calculateLinkPrediction = (graphData: GraphData, algorithm: LinkPredictionAlgorithm): LinkPredictionResult[] => {
    if (graphData.nodes.length < 2) return [];

    const graph = buildPredictionGraph(graphData);
    
    switch(algorithm) {
        case LinkPredictionAlgorithm.COMMON_NEIGHBORS:
            return calculateCommonNeighbors(graph);
        case LinkPredictionAlgorithm.JACCARD:
            return calculateJaccard(graph);
        case LinkPredictionAlgorithm.ADAMIC_ADAR:
            return calculateAdamicAdar(graph);
        case LinkPredictionAlgorithm.PREFERENTIAL_ATTACHMENT:
            return calculatePreferentialAttachment(graph);
        default:
            throw new Error(`未知的链路预测算法: ${algorithm}`);
    }
};
// #endregion
