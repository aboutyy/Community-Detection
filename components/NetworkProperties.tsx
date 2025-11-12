import React from 'react';
import { GraphData } from '../types';

interface NetworkPropertiesProps {
  graphData: GraphData;
}

const NetworkProperties: React.FC<NetworkPropertiesProps> = ({ graphData }) => {
  const numNodes = graphData.nodes.length;
  const numLinks = graphData.links.length;
  const averageDegree = numNodes > 0 ? (2 * numLinks / numNodes).toFixed(2) : '0.00';

  return (
    <div className="space-y-2 p-3 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600 dark:text-gray-300">节点数</span>
        <span className="font-semibold font-mono text-gray-800 dark:text-gray-100">{numNodes}</span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600 dark:text-gray-300">链接数</span>
        <span className="font-semibold font-mono text-gray-800 dark:text-gray-100">{numLinks}</span>
      </div>
      <div className="flex justify-between items-center text-sm">
        <span className="text-gray-600 dark:text-gray-300">平均度</span>
        <span className="font-semibold font-mono text-gray-800 dark:text-gray-100">{averageDegree}</span>
      </div>
    </div>
  );
};

export default NetworkProperties;
