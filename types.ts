// Fix: Add optional properties used by the d3-force simulation. These properties
// are added to nodes during simulation and are required for drag functionality,
// which was causing TypeScript errors in GraphVisualizer.tsx.
export interface Node {
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
  vx?: number;
  vy?: number;
}

export interface Link {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export enum Algorithm {
  LOUVAIN = 'Louvain 算法',
  GIRVAN_NEWMAN = 'Girvan-Newman 算法',
  LABEL_PROPAGATION = '标签传播算法',
}

export enum Layout {
  FORCE_DIRECTED = '力导向布局',
  CIRCULAR = '圆形布局',
}

export enum ColorizationMode {
    COMMUNITY = '按社区',
    GROUND_TRUTH = '按真实社群',
    IN_DEGREE = '按入度中心性',
    OUT_DEGREE = '按出度中心性',
    CLOSENESS = '按接近中心性',
    BETWEENNESS = '按介数中心性',
    PAGERANK = '按 PageRank',
    AUTHORITY = '按 Authority 分数',
    HUB = '按 Hub 分数',
}

export interface CommunityAssignment {
  node: string;
  community: number;
}

export interface BenchmarkNetwork {
  id: string;
  name: string;
  edgeList: string;
  groundTruth: CommunityAssignment[];
  nodeDetails?: {
    [key: string]: {
      description: string;
      imageUrl?: string;
    }
  }
}

export interface PerformanceResult {
    nmi: number;
}

export interface GNParams {
  numCommunities: number;
  nodesPerCommunity: number;
  p_in: number;
  p_out: number;
}

export interface LFRParams {
  n: number;
  mu: number;
  minCommunity: number;
  maxCommunity: number;
  degreeExponent: number; // gamma
  communityExponent: number; // beta
  minDegree: number;
  maxDegree: number;
}

export interface LouvainParams {
  resolution: number;
}

export interface GirvanNewmanParams {
    targetCommunities: number;
}

export interface RunHistoryEntry {
  id: string;
  networkName: string;
  algorithm: Algorithm;
  params: string;
  performance: PerformanceResult | null;
  graphData: GraphData;
}

export enum CentralityAlgorithm {
  IN_DEGREE = '入度中心性 (In-Degree)',
  OUT_DEGREE = '出度中心性 (Out-Degree)',
  CLOSENESS = '接近中心性 (Closeness)',
  BETWEENNESS = '介数中心性 (Betweenness)',
  PAGERANK = 'PageRank',
  HITS_AUTHORITY = 'HITS (Authority Score)',
  HITS_HUB = 'HITS (Hub Score)',
}

export interface CentralityResult {
  nodeId: string;
  score: number;
}

export interface HITSCentralityResult {
  authority: CentralityResult[];
  hub: CentralityResult[];
}


export interface CentralityResultPackage {
  algorithm: CentralityAlgorithm;
  results: CentralityResult[];
}

export enum LinkPredictionAlgorithm {
  COMMON_NEIGHBORS = '共同邻居',
  JACCARD = '杰卡德系数',
  ADAMIC_ADAR = '阿达姆/阿达尔指数',
  PREFERENTIAL_ATTACHMENT = '优先连接',
}

export interface LinkPredictionResult {
  source: string;
  target: string;
  score: number;
}

export type ActiveTool = 'select' | 'addNode' | 'addLink' | 'delete';