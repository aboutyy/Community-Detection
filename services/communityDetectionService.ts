

import { Algorithm, CommunityAssignment, GraphData, LouvainParams, GirvanNewmanParams } from '../types';

interface RunDetectionParams {
  graphData: GraphData;
  algorithm: Algorithm;
  params: LouvainParams | GirvanNewmanParams | {};
  signal: AbortSignal;
}

export const runCommunityDetection = ({ graphData, algorithm, params, signal }: RunDetectionParams): Promise<CommunityAssignment[]> => {
  return new Promise((resolve, reject) => {
    // FIX: Using a direct relative path for the worker script to improve
    // compatibility with environments where `new URL(..., import.meta.url)`
    // might fail.
    const worker = new Worker('./services/communityDetection.worker.ts', {
      type: 'module'
    });

    const handleAbort = () => {
      worker.terminate();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal.addEventListener('abort', handleAbort, { once: true });

    worker.onmessage = (event) => {
      signal.removeEventListener('abort', handleAbort);
      const { type, payload } = event.data;
      if (type === 'SUCCESS') {
        resolve(payload);
      } else {
        reject(new Error(payload));
      }
      worker.terminate();
    };

    worker.onerror = (error) => {
      signal.removeEventListener('abort', handleAbort);
      reject(error);
      worker.terminate();
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