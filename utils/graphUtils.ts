

import { GraphData, Node, Link, CentralityAlgorithm } from '../types';

export const parseEdgeList = (data: string): GraphData => {
  const links: Link[] = [];
  const nodeSet = new Set<string>();
  const lines = data.trim().split('\n');

  lines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      const [source, target] = parts;
      if (source && target) {
        links.push({ source, target });
        nodeSet.add(source);
        nodeSet.add(target);
      }
    }
  });
  
  const nodes: Node[] = Array.from(nodeSet).map(id => ({ id, attributes: {} }));
  return { nodes, links };
};

export const enrichNodesWithDegrees = (graphData: GraphData, isDirected: boolean): GraphData => {
    const inDegrees = new Map<string, number>();
    const outDegrees = new Map<string, number>();

    graphData.nodes.forEach(node => {
        inDegrees.set(node.id, 0);
        outDegrees.set(node.id, 0);
    });

    graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' && link.source !== null ? (link.source as Node).id : String(link.source);
        const targetId = typeof link.target === 'object' && link.target !== null ? (link.target as Node).id : String(link.target);

        if (outDegrees.has(sourceId)) {
            outDegrees.set(sourceId, (outDegrees.get(sourceId) || 0) + 1);
        }
        if (inDegrees.has(targetId)) {
            inDegrees.set(targetId, (inDegrees.get(targetId) || 0) + 1);
        }
    });

    const updatedNodes = graphData.nodes.map(node => {
        const inDegree = inDegrees.get(node.id) || 0;
        const outDegree = outDegrees.get(node.id) || 0;
        const totalDegree = isDirected ? inDegree + outDegree : outDegree; // For undirected, out=in=total

        return {
            ...node,
            attributes: {
                ...node.attributes,
                [CentralityAlgorithm.IN_DEGREE]: inDegree,
                [CentralityAlgorithm.OUT_DEGREE]: outDegree,
                // A general 'degree' attribute can be useful for things like node scaling
                '度 (总)': totalDegree
            }
        };
    });

    return { ...graphData, nodes: updatedNodes };
};