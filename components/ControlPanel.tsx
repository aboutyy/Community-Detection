

import React, { useState } from 'react';
import { Algorithm, PerformanceResult, GNParams, LFRParams, LouvainParams, GirvanNewmanParams, RunHistoryEntry, CentralityAlgorithm, CentralityResultPackage, GraphData, LinkPredictionAlgorithm, LinkPredictionResult } from '../types';
import SyntheticGeneratorControls from './SyntheticGeneratorControls';
import NetworkProperties from './NetworkProperties';

interface BenchmarkNetworkInfo {
  id: string;
  name: string;
}
type SaveStatus = 'idle' | 'saving' | 'saved';

interface ControlPanelProps {
  graphData: GraphData;
  customData: string;
  setCustomData: (data: string) => void;
  selectedAlgorithm: Algorithm;
  setSelectedAlgorithm: (algo: Algorithm) => void;
  onParse: () => void;
  onLoadBenchmark: (benchmarkId: string) => void;
  onNewNetwork: () => void;
  onRun: () => void;
  onCancel: () => void;
  isLoading: boolean;
  explanation: string;
  error: string | null;
  performance: PerformanceResult | null;
  gnParams: GNParams;
  setGnParams: (params: GNParams) => void;
  lfrParams: LFRParams;
  setLfrParams: (params: LFRParams) => void;
  louvainParams: LouvainParams;
  setLouvainParams: (params: LouvainParams) => void;
  girvanNewmanParams: GirvanNewmanParams;
  setGirvanNewmanParams: (params: GirvanNewmanParams) => void;
  onGenerate: (type: 'gn' | 'lfr') => void;
  benchmarkNetworks: BenchmarkNetworkInfo[];
  runHistory: RunHistoryEntry[];
  onLoadFromHistory: (id: string) => void;
  onDeleteHistoryEntry: (id: string) => void;
  centralityResults: CentralityResultPackage | null;
  onCalculateCentrality: (algorithm: CentralityAlgorithm) => void;
  onClearCentrality: () => void;
  isCalculatingCentrality: boolean;
  linkPredictionResults: LinkPredictionResult[] | null;
  onCalculateLinkPrediction: (algorithm: LinkPredictionAlgorithm) => void;
  isCalculatingLinkPrediction: boolean;
  onHoverPredictedLink: (link: { source: string, target: string } | null) => void;
  isDirected: boolean;
  setIsDirected: (isDirected: boolean) => void;
  onSaveNetwork: () => void;
  onLoadSavedNetwork: () => void;
  hasSavedNetwork: boolean;
  saveStatus: SaveStatus;
}

type DataSource = 'benchmark' | 'generator' | 'custom';

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  unit?: string;
}> = ({ label, value, min, max, step, onChange, unit }) => (
  <div>
    <label className="flex justify-between text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
      <span>{label}</span>
      <span>{step >= 1 ? value : value.toFixed(2)}{unit}</span>
    </label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
    />
  </div>
);


const ControlPanel: React.FC<ControlPanelProps> = (props) => {
  const {
    graphData,
    selectedAlgorithm,
    setSelectedAlgorithm,
    onRun,
    onCancel,
    isLoading,
    explanation,
    error,
    performance,
    benchmarkNetworks,
    louvainParams,
    setLouvainParams,
    girvanNewmanParams,
    setGirvanNewmanParams,
    runHistory,
    onLoadFromHistory,
    onDeleteHistoryEntry,
    centralityResults,
    onCalculateCentrality,
    onClearCentrality,
    isCalculatingCentrality,
    linkPredictionResults,
    onCalculateLinkPrediction,
    isCalculatingLinkPrediction,
    onHoverPredictedLink,
    isDirected,
    setIsDirected,
    onSaveNetwork,
    onLoadSavedNetwork,
    hasSavedNetwork,
    saveStatus,
  } = props;
  const [dataSource, setDataSource] = useState<DataSource>('benchmark');
  const [selectedCentrality, setSelectedCentrality] = useState<CentralityAlgorithm>(CentralityAlgorithm.IN_DEGREE);
  const [selectedLinkPrediction, setSelectedLinkPrediction] = useState<LinkPredictionAlgorithm>(LinkPredictionAlgorithm.COMMON_NEIGHBORS);
  
  const getCentralityExplanation = (algorithm: CentralityAlgorithm): { text: string, warning?: string } => {
    switch (algorithm) {
        case CentralityAlgorithm.IN_DEGREE:
            return { text: '入度中心性衡量有多少链接指向一个节点。值越高，节点越受“欢迎”或认可。' };
        case CentralityAlgorithm.OUT_DEGREE:
            return { text: '出度中心性衡量一个节点发出了多少链接。值越高，节点在网络中越“活跃”。' };
        case CentralityAlgorithm.CLOSENESS:
            return { text: '接近中心性衡量一个节点到所有其他可达节点的平均距离有多近。分数越高表示节点越容易到达网络中的其他节点。', warning: '此算法在大型网络上计算可能会很慢。' };
        case CentralityAlgorithm.BETWEENNESS:
            return { text: '介数中心性衡量一个节点在网络中所有节点对之间的最短路径上出现的频率。分数高的节点通常是连接不同社群的“桥梁”。', warning: '此算法在大型网络上计算量非常大，可能会导致浏览器无响应。' };
        case CentralityAlgorithm.PAGERANK:
            return { text: 'PageRank最初用于对网页进行排名，它衡量节点的重要性，考虑到其连接的数量和质量。来自重要节点的链接比来自不重要节点的链接贡献更大。' };
        case CentralityAlgorithm.HITS_AUTHORITY:
            return { text: '权威 (Authority) 分数衡量一个节点被多少“好的枢纽”节点指向。分数高的节点是其主题领域内的信息权威来源。', warning: '此算法在大型网络上计算可能会很慢。' };
        case CentralityAlgorithm.HITS_HUB:
            return { text: '枢纽 (Hub) 分数衡量一个节点指向多少“好的权威”节点。分数高的节点是发现权威内容的良好起点。', warning: '此算法在大型网络上计算可能会很慢。' };
        default:
            return { text: '' };
    }
  };

  const renderDataSourceContent = () => {
    const getSaveButtonText = () => {
        switch (saveStatus) {
            case 'saving': return '保存中...';
            case 'saved': return '已保存!';
            default: return '保存网络';
        }
    };

    switch(dataSource) {
      case 'benchmark':
        return (
          <div>
            <label htmlFor="benchmark-select" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              加载基准网络
            </label>
            <select
              id="benchmark-select"
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
              onChange={(e) => props.onLoadBenchmark(e.target.value)}
              disabled={isLoading}
              defaultValue=""
            >
              <option value="" disabled>选择一个基准网络...</option>
              {benchmarkNetworks.map((network) => (
                <option key={network.id} value={network.id}>{network.name}</option>
              ))}
            </select>
          </div>
        );
      case 'generator':
        return <SyntheticGeneratorControls {...props} />;
      case 'custom':
        return (
          <div>
            <label htmlFor="edge-list" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              粘贴自定义图数据 (边列表)
            </label>
            <textarea
              id="edge-list"
              rows={8}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
              placeholder="例如:&#10;节点1 节点2&#10;节点2 节点3&#10;或点击“新建网络”开始编辑"
              value={props.customData}
              onChange={(e) => props.setCustomData(e.target.value)}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={props.onNewNetwork}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50"
                  disabled={isLoading}
                >
                  新建网络
                </button>
                <button
                  onClick={props.onParse}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50"
                  disabled={isLoading}
                >
                  加载数据
                </button>
                <button
                  onClick={onSaveNetwork}
                  className={`w-full font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50 ${
                    saveStatus === 'saved'
                      ? 'bg-green-600 text-white cursor-default'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white'
                  }`}
                  disabled={isLoading || props.graphData.nodes.length === 0 || saveStatus !== 'idle'}
                >
                  {getSaveButtonText()}
                </button>
                <button
                  onClick={onLoadSavedNetwork}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50"
                  disabled={isLoading || !hasSavedNetwork}
                >
                  加载已存网络
                </button>
            </div>
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 p-4 overflow-y-auto border-r border-gray-200 dark:border-gray-700/50">
      
      <div className="space-y-6">
        
        {/* Data Source Section */}
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">1. 数据源</h3>
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {(['benchmark', 'generator', 'custom'] as DataSource[]).map(source => (
                <button
                  key={source}
                  onClick={() => setDataSource(source)}
                  className={`capitalize flex-1 py-2 px-4 text-sm font-semibold transition-colors duration-200 ${
                    dataSource === source
                      ? 'border-b-2 border-cyan-500 text-cyan-500 dark:border-cyan-400 dark:text-cyan-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {source === 'benchmark' ? '真实网络' : source === 'generator' ? '生成网络' : '自定义数据'}
                </button>
              ))}
            </div>
            
            {dataSource !== 'generator' && (
               <label className={`flex items-center justify-between transition-opacity cursor-pointer`}>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">有向网络</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isDirected}
                    onChange={(e) => {
                        setIsDirected(e.target.checked);
                        // Re-parse data when toggled
                        if (props.customData) props.onParse();
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer-checked:bg-cyan-600 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-full"></div>
                </div>
              </label>
            )}

            <div className="pt-2">
              {renderDataSourceContent()}
            </div>
        </div>

        {/* Network Overview Section */}
        {graphData.nodes.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700/50">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">2. 网络概览</h3>
            <NetworkProperties graphData={graphData} />
          </div>
        )}

        {/* Algorithm Section */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">3. 算法配置</h3>
            <div>
              <label htmlFor="algorithm" className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                社区发现算法
              </label>
              <select
                id="algorithm"
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                value={selectedAlgorithm}
                onChange={(e) => setSelectedAlgorithm(e.target.value as Algorithm)}
                disabled={isLoading}
              >
                {Object.values(Algorithm).map((algo) => (
                  <option key={algo} value={algo}>{algo}</option>
                ))}
              </select>
            </div>
            
             <div className="text-xs text-blue-800 dark:text-blue-300 bg-blue-100/50 dark:bg-blue-900/50 border border-blue-300/50 dark:border-blue-700/50 p-2 rounded-md">
                <span className="font-bold">注意:</span> 社区发现算法在运行时会将所有图视为无向图进行处理。
            </div>
            
            {selectedAlgorithm === Algorithm.LOUVAIN && (
                <div className="space-y-4 p-4 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Louvain 参数</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2 mb-2">
                        较低的值会发现较大的社区，较高的值会发现较小的社区。对于空手道俱乐部网络，可以尝试0.5左右。
                    </p>
                    <Slider 
                        label="分辨率 (Resolution)" 
                        value={louvainParams.resolution} 
                        min={0.1} 
                        max={2.0} 
                        step={0.05} 
                        onChange={(v) => setLouvainParams({ ...louvainParams, resolution: v })} 
                    />
                </div>
            )}

            {selectedAlgorithm === Algorithm.GIRVAN_NEWMAN && (
                 <div className="space-y-4 p-4 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Girvan-Newman 参数</h4>
                    <div className="text-xs text-yellow-800 dark:text-yellow-300 bg-yellow-100/50 dark:bg-yellow-900/50 border border-yellow-300/50 dark:border-yellow-700/50 p-2 rounded-md">
                        <span className="font-bold">警告:</span> 此算法计算量大，在较大型网络上可能会很慢。
                    </div>
                    <Slider 
                        label="目标社区数量" 
                        value={girvanNewmanParams.targetCommunities} 
                        min={1} 
                        max={20}
                        step={1} 
                        onChange={(v) => setGirvanNewmanParams({ ...girvanNewmanParams, targetCommunities: v })} 
                    />
                </div>
            )}

            {isLoading ? (
              <button
                onClick={onCancel}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-md transition duration-300 flex items-center justify-center"
              >
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                取消检测
              </button>
            ) : (
              <button
                onClick={onRun}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-md transition duration-300 flex items-center justify-center disabled:bg-cyan-800 disabled:cursor-not-allowed"
                disabled={isLoading || props.customData.length === 0}
              >
                运行社区发现
              </button>
            )}
        </div>
        
        {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-md" role="alert">
                <strong className="font-bold">错误: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}

        {/* Analysis Section */}
        {!isLoading && (
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">4. 网络分析</h3>
            
            {/* Centrality Analysis */}
            <div className="space-y-2">
              <label htmlFor="centrality-algorithm" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                中心性算法
              </label>
              <select
                id="centrality-algorithm"
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                value={selectedCentrality}
                onChange={(e) => setSelectedCentrality(e.target.value as CentralityAlgorithm)}
                disabled={isCalculatingCentrality || isLoading || isCalculatingLinkPrediction}
              >
                {Object.values(CentralityAlgorithm).map((algo) => (
                  <option key={algo} value={algo}>{algo}</option>
                ))}
              </select>
            
              {getCentralityExplanation(selectedCentrality).warning && (
                  <div className="text-xs text-yellow-800 dark:text-yellow-300 bg-yellow-100/50 dark:bg-yellow-900/50 border border-yellow-300/50 dark:border-yellow-700/50 p-2 rounded-md">
                      <span className="font-bold">警告:</span> {getCentralityExplanation(selectedCentrality).warning}
                  </div>
              )}
              
              {!isDirected && (selectedCentrality === CentralityAlgorithm.HITS_AUTHORITY || selectedCentrality === CentralityAlgorithm.HITS_HUB) && (
                  <div className="text-xs text-blue-800 dark:text-blue-300 bg-blue-100/50 dark:bg-blue-900/50 border border-blue-300/50 dark:border-blue-700/50 p-2 rounded-md">
                      <span className="font-bold">注意:</span> HITS 算法专为有向网络设计。在当前的无向图中，每条链接都被视为双向关系，因此 Authority 和 Hub 分数可能会高度相似。
                  </div>
              )}

              <button
                onClick={() => onCalculateCentrality(selectedCentrality)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={isLoading || isCalculatingCentrality || isCalculatingLinkPrediction || props.customData.length === 0}
              >
                {isCalculatingCentrality && (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isCalculatingCentrality ? '计算中...' : '计算中心性'}
              </button>

               {centralityResults && (
                  <div className="mt-2 bg-gray-100 dark:bg-gray-900/50 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200">{centralityResults.algorithm} 排名 (Top 10)</h4>
                         <button
                            onClick={onClearCentrality}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                         >
                           清除
                         </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{getCentralityExplanation(centralityResults.algorithm).text}</p>
                      <ul className="space-y-2 text-sm">
                        {centralityResults.results.slice(0, 10).map((result, index) => (
                          <li key={result.nodeId} className="flex justify-between items-center bg-white dark:bg-gray-800/50 p-2 rounded-md">
                            <span className="flex items-center">
                              <span className="text-xs font-bold bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 rounded-full h-6 w-6 flex items-center justify-center mr-3">{index + 1}</span>
                              <span className="font-mono font-semibold text-gray-800 dark:text-gray-200 truncate" title={result.nodeId}>{result.nodeId}</span>
                            </span>
                            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{result.score.toFixed(4)}</span>
                          </li>
                        ))}
                      </ul>
                  </div>
              )}
            </div>
            
            {/* Link Prediction */}
            <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <label htmlFor="link-prediction-algorithm" className="block text-sm font-medium text-gray-600 dark:text-gray-300">
                链路预测
              </label>
              <select
                id="link-prediction-algorithm"
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md p-2 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                value={selectedLinkPrediction}
                onChange={(e) => setSelectedLinkPrediction(e.target.value as LinkPredictionAlgorithm)}
                disabled={isCalculatingLinkPrediction || isLoading || isCalculatingCentrality}
              >
                {Object.values(LinkPredictionAlgorithm).map((algo) => (
                  <option key={algo} value={algo}>{algo}</option>
                ))}
              </select>
               <button
                onClick={() => onCalculateLinkPrediction(selectedLinkPrediction)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-white font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={isLoading || isCalculatingCentrality || isCalculatingLinkPrediction || props.customData.length === 0}
              >
                {isCalculatingLinkPrediction && (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isCalculatingLinkPrediction ? '计算中...' : '计算预测'}
              </button>

              {linkPredictionResults && (
                 <div className="mt-2 bg-gray-100 dark:bg-gray-900/50 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">预测链接排名 (Top 10)</h4>
                    <ul className="space-y-2 text-sm">
                      {linkPredictionResults.slice(0, 10).map((result, index) => (
                        <li 
                          key={`${result.source}-${result.target}`} 
                          className="flex justify-between items-center bg-white dark:bg-gray-800/50 p-2 rounded-md transition-all duration-150 hover:ring-2 hover:ring-purple-500"
                          onMouseEnter={() => onHoverPredictedLink(result)}
                          onMouseLeave={() => onHoverPredictedLink(null)}
                        >
                          <span className="flex items-center truncate">
                            <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full h-6 w-6 flex items-center justify-center mr-3">{index + 1}</span>
                            <span className="font-mono font-semibold text-gray-800 dark:text-gray-200 truncate" title={`${result.source} - ${result.target}`}>
                                {result.source} - {result.target}
                            </span>
                          </span>
                          <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{result.score.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                 </div>
              )}
            </div>

          </div>
        )}
        
        {/* Results and History Section */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">5. 结果与历史</h3>
            {performance && !isLoading && (
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">性能分析</h4>
                    <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">归一化互信息 (NMI):</span>
                            <span className="text-2xl font-bold text-green-600 dark:text-green-400">{performance.nmi.toFixed(4)}</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">将检测到的社区与真实社区进行比较。1.0为完美匹配。</p>
                    </div>
                </div>
            )}

            {explanation && !isLoading && (
              <div>
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">算法解释</h4>
                <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-lg prose dark:prose-invert prose-sm max-w-none">
                  <p>{explanation}</p>
                </div>
              </div>
            )}

            {runHistory.length > 0 && !isLoading && (
              <div>
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">运行历史</h4>
                <div className="space-y-2 max-h-[25vh] overflow-y-auto pr-2 rounded-md">
                  {runHistory.map(entry => (
                    <div key={entry.id} className="bg-gray-100 dark:bg-gray-900/50 p-3 rounded-lg text-sm transition hover:bg-gray-200 dark:hover:bg-gray-700/50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-gray-800 dark:text-gray-200">{entry.networkName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{entry.algorithm}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{entry.params}</p>
                        </div>
                        {entry.performance && (
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="font-semibold text-green-600 dark:text-green-400">{entry.performance.nmi.toFixed(4)}</p>
                            <p className="text-xs text-gray-500">NMI</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => onLoadFromHistory(entry.id)}
                          className="text-xs bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-700 dark:hover:bg-cyan-600 text-white font-semibold py-1 px-3 rounded-md transition w-full"
                        >
                          查看
                        </button>
                        <button
                          onClick={() => onDeleteHistoryEntry(entry.id)}
                          className="text-xs bg-gray-500 hover:bg-red-600 dark:bg-gray-600 dark:hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md transition w-full"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;