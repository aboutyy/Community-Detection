import React, { useState } from 'react';
import { GNParams, LFRParams } from '../types';

interface SyntheticGeneratorControlsProps {
  gnParams: GNParams;
  setGnParams: (params: GNParams) => void;
  lfrParams: LFRParams;
  setLfrParams: (params: LFRParams) => void;
  onGenerate: (type: 'gn' | 'lfr') => void;
  isLoading: boolean;
}

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
      <span>{step < 1 ? value.toFixed(2) : value}{unit}</span>
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

const SyntheticGeneratorControls: React.FC<SyntheticGeneratorControlsProps> = ({
  gnParams,
  setGnParams,
  lfrParams,
  setLfrParams,
  onGenerate,
  isLoading,
}) => {
  const [generatorType, setGeneratorType] = useState<'gn' | 'lfr'>('gn');

  return (
    <div className="space-y-4">
      <div className="flex justify-center rounded-md bg-gray-900/50 p-1">
        <button
          onClick={() => setGeneratorType('gn')}
          className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors w-1/2 ${
            generatorType === 'gn' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          GN 模型
        </button>
        <button
          onClick={() => setGeneratorType('lfr')}
          className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors w-1/2 ${
            generatorType === 'lfr' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          LFR 基准
        </button>
      </div>
      
      {generatorType === 'gn' && (
        <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg">
          <h4 className="font-semibold text-gray-200">Girvan-Newman (GN) 参数</h4>
          <Slider label="社区数量" value={gnParams.numCommunities} min={2} max={10} step={1} onChange={(v) => setGnParams({ ...gnParams, numCommunities: v })} />
          <Slider label="每社区节点数" value={gnParams.nodesPerCommunity} min={10} max={50} step={1} onChange={(v) => setGnParams({ ...gnParams, nodesPerCommunity: v })} />
          <Slider label="社区内连接概率 (p_in)" value={gnParams.p_in} min={0} max={1} step={0.01} onChange={(v) => setGnParams({ ...gnParams, p_in: v })} />
          <Slider label="社区间连接概率 (p_out)" value={gnParams.p_out} min={0} max={0.2} step={0.005} onChange={(v) => setGnParams({ ...gnParams, p_out: v })} />
        </div>
      )}

      {generatorType === 'lfr' && (
        <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg">
          <h4 className="font-semibold text-gray-200">LFR 基准网络参数</h4>
          <p className="text-xs text-gray-400 -mt-2 mb-2">生成具有幂律度分布和社区规模分布的网络。</p>
          <Slider label="节点总数" value={lfrParams.n} min={50} max={500} step={10} onChange={(v) => setLfrParams({ ...lfrParams, n: v })} />
          <Slider label="混合参数 (μ)" value={lfrParams.mu} min={0.05} max={0.8} step={0.01} onChange={(v) => setLfrParams({ ...lfrParams, mu: v })} />
          <Slider label="最小度" value={lfrParams.minDegree} min={1} max={10} step={1} onChange={(v) => setLfrParams({ ...lfrParams, minDegree: v })} />
          <Slider label="最大度" value={lfrParams.maxDegree} min={10} max={100} step={1} onChange={(v) => setLfrParams({ ...lfrParams, maxDegree: v })} />
          <Slider label="度指数 (γ)" value={lfrParams.degreeExponent} min={2} max={4} step={0.1} onChange={(v) => setLfrParams({ ...lfrParams, degreeExponent: v })} />
          <Slider label="最小社区规模" value={lfrParams.minCommunity} min={10} max={50} step={1} onChange={(v) => setLfrParams({ ...lfrParams, minCommunity: v })} />
          <Slider label="最大社区规模" value={lfrParams.maxCommunity} min={20} max={100} step={1} onChange={(v) => setLfrParams({ ...lfrParams, maxCommunity: v })} />
          <Slider label="社区规模指数 (β)" value={lfrParams.communityExponent} min={1} max={3} step={0.1} onChange={(v) => setLfrParams({ ...lfrParams, communityExponent: v })} />
        </div>
      )}

      <button
        onClick={() => onGenerate(generatorType)}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50"
        disabled={isLoading}
      >
        生成网络
      </button>
    </div>
  );
};

export default SyntheticGeneratorControls;
