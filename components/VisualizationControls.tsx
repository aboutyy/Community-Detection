import React from 'react';

interface VisualizationControlsProps {
  scaleNodeSizeByDegree: boolean;
  setScaleNodeSizeByDegree: (value: boolean) => void;
  showNodeLabels: boolean;
  setShowNodeLabels: (value: boolean) => void;
  groupCommunities: boolean;
  setGroupCommunities: (value: boolean) => void;
}

const VisualizationControls: React.FC<VisualizationControlsProps> = ({
  scaleNodeSizeByDegree,
  setScaleNodeSizeByDegree,
  showNodeLabels,
  setShowNodeLabels,
  groupCommunities,
  setGroupCommunities,
}) => {
  return (
    <div className="flex items-center space-x-6">
      <label htmlFor="node-size-toggle" className="flex items-center cursor-pointer">
        <span className="text-sm font-medium text-gray-300 mr-3">Scale Nodes by Degree</span>
        <div className="relative">
          <input
            type="checkbox"
            id="node-size-toggle"
            className="sr-only peer"
            checked={scaleNodeSizeByDegree}
            onChange={(e) => setScaleNodeSizeByDegree(e.target.checked)}
          />
          <div className="w-14 h-8 bg-gray-600 rounded-full peer-checked:bg-cyan-600 transition-colors"></div>
          <div className="absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6"></div>
        </div>
      </label>
      <label htmlFor="node-label-toggle" className="flex items-center cursor-pointer">
        <span className="text-sm font-medium text-gray-300 mr-3">Show Node Labels</span>
        <div className="relative">
          <input
            type="checkbox"
            id="node-label-toggle"
            className="sr-only peer"
            checked={showNodeLabels}
            onChange={(e) => setShowNodeLabels(e.target.checked)}
          />
          <div className="w-14 h-8 bg-gray-600 rounded-full peer-checked:bg-cyan-600 transition-colors"></div>
          <div className="absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6"></div>
        </div>
      </label>
      <label htmlFor="group-communities-toggle" className="flex items-center cursor-pointer">
        <span className="text-sm font-medium text-gray-300 mr-3">Group Communities</span>
        <div className="relative">
          <input
            type="checkbox"
            id="group-communities-toggle"
            className="sr-only peer"
            checked={groupCommunities}
            onChange={(e) => setGroupCommunities(e.target.checked)}
          />
          <div className="w-14 h-8 bg-gray-600 rounded-full peer-checked:bg-cyan-600 transition-colors"></div>
          <div className="absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6"></div>
        </div>
      </label>
    </div>
  );
};

export default VisualizationControls;