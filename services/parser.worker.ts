// Inlined types from types.ts
// FIX: Renamed Node to AppNode to avoid conflict with the global DOM Node type in the worker environment.
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

// FIX: Renamed to avoid potential global conflicts.
enum AppCentralityAlgorithm {
  IN_DEGREE = '入度中心性 (In-Degree)',
  OUT_DEGREE = '出度中心性 (Out-Degree)',
  CLOSENESS = '接近中心性 (Closeness)',
  BETWEENNESS = '介数中心性 (Betweenness)',
  PAGERANK = 'PageRank',
}

interface ParserWorkerData {
    edgeList: string;
    isDirected: boolean;
}

// Inlined functions from utils/graphUtils.ts
const parseEdgeList = (data: string): GraphData => {
  const links: { source: string, target: string }[] = [];
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
  
  const nodes: AppNode[] = Array.from(nodeSet).map(id => ({ id, attributes: {} }));
  return { nodes, links };
};

const enrichNodesWithDegrees = (graphData: GraphData, isDirected: boolean): GraphData => {
    const inDegrees = new Map<string, number>();
    const outDegrees = new Map<string, number>();

    graphData.nodes.forEach(node => {
        inDegrees.set(node.id, 0);
        outDegrees.set(node.id, 0);
    });

    graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'object' && link.source !== null ? (link.source as AppNode).id : String(link.source);
        const targetId = typeof link.target === 'object' && link.target !== null ? (link.target as AppNode).id : String(link.target);

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
        const totalDegree = isDirected ? inDegree + outDegree : outDegree;

        return {
            ...node,
            attributes: {
                ...node.attributes,
                [AppCentralityAlgorithm.IN_DEGREE]: inDegree,
                [AppCentralityAlgorithm.OUT_DEGREE]: outDegree,
                '度 (总)': totalDegree
            }
        };
    });

    return { ...graphData, nodes: updatedNodes };
};
// Worker entry point
self.onmessage = (event: MessageEvent<ParserWorkerData>) => {
    const { edgeList, isDirected } = event.data;
    try {
        const parsedData = parseEdgeList(edgeList);
        const finalGraphData = enrichNodesWithDegrees(parsedData, isDirected);
        self.postMessage({ type: 'SUCCESS', payload: finalGraphData });
    } catch (error) {
        self.postMessage({ type: 'ERROR', payload: error instanceof Error ? error.message : '解析数据时发生未知错误。' });
    }
};