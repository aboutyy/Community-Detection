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
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
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
  LOUVAIN = 'Louvain Method',
  GIRVAN_NEWMAN = 'Girvan-Newman Algorithm',
  LABEL_PROPAGATION = 'Label Propagation Algorithm',
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
