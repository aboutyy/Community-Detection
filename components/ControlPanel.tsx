import React, { useState } from 'react';
import { Algorithm, PerformanceResult, GNParams, LFRParams, LouvainParams, GirvanNewmanParams, RunHistoryEntry } from '../types';
import SyntheticGeneratorControls from './SyntheticGeneratorControls';

interface BenchmarkNetworkInfo {
  id: string;
  name: string;
}
interface ControlPanelProps {
  customData: string;
  setCustomData: (data: string) => void;
  selectedAlgorithm: Algorithm;
  setSelectedAlgorithm: (algo: Algorithm) => void;
  onParse: () => void;
  onLoadBenchmark: (benchmarkId: string) => void;
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
    <label className="flex justify-between text-sm font-medium text-gray-300 mb-1">
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
      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
    />
  </div>
);


const ControlPanel: React.FC<ControlPanelProps> = (props) => {
  const {
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
  } = props;
  const [dataSource, setDataSource] = useState<DataSource>('benchmark');
  
  const renderDataSourceContent = () => {
    switch(dataSource) {
      case 'benchmark':
        return (
          <div>
            <label htmlFor="benchmark-select" className="block text-sm font-medium text-gray-300 mb-2">
              加载基准网络
            </label>
            <select
              id="benchmark-select"
              className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
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
            <label htmlFor="edge-list" className="block text-sm font-medium text-gray-300 mb-2">
              粘贴自定义图数据 (边列表)
            </label>
            <textarea
              id="edge-list"
              rows={8}
              className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
              placeholder="例如:&#10;节点1 节点2&#10;节点2 节点3"
              value={props.customData}
              onChange={(e) => props.setCustomData(e.target.value)}
            />
            <button
              onClick={props.onParse}
              className="mt-2 w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50"
              disabled={isLoading}
            >
              加载自定义数据
            </button>
          </div>
        );
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-800 p-6 rounded-lg shadow-lg overflow-y-auto">
      <h2 className="text-2xl font-bold text-cyan-400 mb-4">控制面板</h2>
      
      <div className="mb-6">
        <div className="flex border-b border-gray-700">
          {(['benchmark', 'generator', 'custom'] as DataSource[]).map(source => (
            <button
              key={source}
              onClick={() => setDataSource(source)}
              className={`capitalize flex-1 py-2 px-4 text-sm font-semibold transition-colors duration-200 ${
                dataSource === source
                  ? 'border-b-2 border-cyan-400 text-cyan-400'
                  : 'text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              {source === 'benchmark' ? '真实网络' : source === 'generator' ? '生成网络' : '自定义数据'}
            </button>
          ))}
        </div>
        <div className="pt-4">
          {renderDataSourceContent()}
        </div>
      </div>
      
      <div className="flex-grow flex flex-col space-y-6">
        <div>
          <label htmlFor="algorithm" className="block text-sm font-medium text-gray-300 mb-2">
            社区发现算法
          </label>
          <select
            id="algorithm"
            className="w-full bg-gray-900 border border-gray-700 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
            value={selectedAlgorithm}
            onChange={(e) => setSelectedAlgorithm(e.target.value as Algorithm)}
            disabled={isLoading}
          >
            {Object.values(Algorithm).map((algo) => (
              <option key={algo} value={algo}>{algo}</option>
            ))}
          </select>
        </div>
        
        {selectedAlgorithm === Algorithm.LOUVAIN && (
            <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg">
                <h4 className="font-semibold text-gray-200">Louvain 参数</h4>
                <p className="text-xs text-gray-400 -mt-2 mb-2">
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
             <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg">
                <h4 className="font-semibold text-gray-200">Girvan-Newman 参数</h4>
                <div className="text-xs text-yellow-300 bg-yellow-900/50 border border-yellow-700/50 p-2 rounded-md">
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
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-md transition duration-300 flex items-center justify-center disabled:bg-cyan-800"
            disabled={isLoading}
          >
            运行社区发现
          </button>
        )}

        {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md" role="alert">
                <strong className="font-bold">错误: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}

        {performance && !isLoading && (
            <div>
                <h3 className="text-xl font-bold text-cyan-400 mb-2">性能分析</h3>
                <div className="bg-gray-900/50 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-300">归一化互信息 (NMI):</span>
                        <span className="text-2xl font-bold text-green-400">{performance.nmi.toFixed(4)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">将检测到的社区与真实社区进行比较。1.0为完美匹配。</p>
                </div>
            </div>
        )}

        {explanation && !isLoading && (
          <div>
            <h3 className="text-xl font-bold text-cyan-400 mb-2">算法解释</h3>
            <div className="bg-gray-900/50 p-4 rounded-lg prose prose-invert prose-sm max-w-none">
              <p>{explanation}</p>
            </div>
          </div>
        )}

        {runHistory.length > 0 && !isLoading && (
          <div className="pt-4">
            <h3 className="text-xl font-bold text-cyan-400 mb-2">运行历史</h3>
            <div className="space-y-2 max-h-[25vh] overflow-y-auto pr-2 rounded-md">
              {runHistory.map(entry => (
                <div key={entry.id} className="bg-gray-900/50 p-3 rounded-lg text-sm transition hover:bg-gray-700/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-200">{entry.networkName}</p>
                      <p className="text-xs text-gray-400">{entry.algorithm}</p>
                      <p className="text-xs text-gray-400">{entry.params}</p>
                    </div>
                    {entry.performance && (
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="font-semibold text-green-400">{entry.performance.nmi.toFixed(4)}</p>
                        <p className="text-xs text-gray-500">NMI</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => onLoadFromHistory(entry.id)}
                      className="text-xs bg-cyan-700 hover:bg-cyan-600 text-white font-semibold py-1 px-3 rounded-md transition w-full"
                    >
                      查看
                    </button>
                    <button
                      onClick={() => onDeleteHistoryEntry(entry.id)}
                      className="text-xs bg-gray-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-md transition w-full"
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
  );
};

export default ControlPanel;
