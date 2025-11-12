import React, { useMemo } from 'react';
import { Layout, ColorizationMode, GraphData, CentralityAlgorithm } from '../types';

interface VisualizationControlsProps {
  scaleNodeSizeByDegree: boolean;
  setScaleNodeSizeByDegree: (value: boolean) => void;
  showNodeLabels: boolean;
  setShowNodeLabels: (value: boolean) => void;
  groupCommunities: boolean;
  setGroupCommunities: (value: boolean) => void;
  layout: Layout;
  setLayout: (layout: Layout) => void;
  colorizationMode: ColorizationMode;
  setColorizationMode: (mode: ColorizationMode) => void;
  graphData: GraphData;
}

const ControlToggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ label, checked, onChange, disabled }) => (
  <label className={`flex items-center justify-between transition-opacity ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
    <div className="relative">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer-checked:bg-cyan-600 transition-colors"></div>
      <div className="absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-full"></div>
    </div>
  </label>
);


const VisualizationControls: React.FC<VisualizationControlsProps> = ({
  scaleNodeSizeByDegree,
  setScaleNodeSizeByDegree,
  showNodeLabels,
  setShowNodeLabels,
  groupCommunities,
  setGroupCommunities,
  layout,
  setLayout,
  colorizationMode,
  setColorizationMode,
  graphData,
}) => {

  const availableColorizations = useMemo(() => {
    const modes: { value: ColorizationMode, label: string, disabled: boolean }[] = [
      { value: ColorizationMode.COMMUNITY, label: '按社区', disabled: !graphData.nodes.some(n => n.community !== undefined) },
      { value: ColorizationMode.GROUND_TRUTH, label: '按真实社群', disabled: !graphData.nodes.some(n => n.groundTruthCommunity !== undefined) },
      { value: ColorizationMode.IN_DEGREE, label: '按入度中心性', disabled: !graphData.nodes.some(n => n.attributes?.[CentralityAlgorithm.IN_DEGREE] !== undefined) },
      { value: ColorizationMode.OUT_DEGREE, label: '按出度中心性', disabled: !graphData.nodes.some(n => n.attributes?.[CentralityAlgorithm.OUT_DEGREE] !== undefined) },
      { value: ColorizationMode.CLOSENESS, label: '按接近中心性', disabled: !graphData.nodes.some(n => n.attributes?.[CentralityAlgorithm.CLOSENESS] !== undefined) },
      { value: ColorizationMode.BETWEENNESS, label: '按介数中心性', disabled: !graphData.nodes.some(n => n.attributes?.[CentralityAlgorithm.BETWEENNESS] !== undefined) },
      { value: ColorizationMode.PAGERANK, label: '按 PageRank', disabled: !graphData.nodes.some(n => n.attributes?.[CentralityAlgorithm.PAGERANK] !== undefined) },
      { value: ColorizationMode.AUTHORITY, label: '按 Authority 分数', disabled: !graphData.nodes.some(n => n.attributes?.[CentralityAlgorithm.HITS_AUTHORITY] !== undefined) },
      { value: ColorizationMode.HUB, label: '按 Hub 分数', disabled: !graphData.nodes.some(n => n.attributes?.[CentralityAlgorithm.HITS_HUB] !== undefined) },
    ];
    return modes;
  }, [graphData]);
  
  const isForceDirected = layout === Layout.FORCE_DIRECTED;

  return (
    <div className="flex flex-col space-y-6">
       <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">可视化选项</h3>

      {/* Node Color Section */}
      <div className="space-y-2">
        <label htmlFor="color-mode-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">节点着色</label>
        <select
          id="color-mode-select"
          value={colorizationMode}
          onChange={(e) => setColorizationMode(e.target.value as ColorizationMode)}
          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
        >
          {availableColorizations.map(opt => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label} {opt.disabled ? '(不可用)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Layout Section */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">布局</label>
        <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-900/50 p-1 rounded-lg">
            <button
                onClick={() => setLayout(Layout.FORCE_DIRECTED)}
                className={`w-1/2 px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                    isForceDirected ? 'bg-cyan-600 text-white' : 'text-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600/50'
                }`}
            >
                力导向
            </button>
            <button
                onClick={() => setLayout(Layout.CIRCULAR)}
                className={`w-1/2 px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                    !isForceDirected ? 'bg-cyan-600 text-white' : 'text-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600/50'
                }`}
            >
                圆形
            </button>
        </div>
      </div>
      
       {/* Toggles Section */}
      <div className="space-y-4">
        <ControlToggle
            label="节点大小按度缩放"
            checked={scaleNodeSizeByDegree}
            onChange={setScaleNodeSizeByDegree}
        />
        <ControlToggle
            label="显示节点标签"
            checked={showNodeLabels}
            onChange={setShowNodeLabels}
        />
         <ControlToggle
            label="社区聚合展示"
            checked={groupCommunities}
            onChange={setGroupCommunities}
            disabled={!isForceDirected}
        />
      </div>
    </div>
  );
};

export default VisualizationControls;