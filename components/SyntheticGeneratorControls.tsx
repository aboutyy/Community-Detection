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
      <span>{value}{unit}</span>
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
          GN
        </button>
        <button
          onClick={() => setGeneratorType('lfr')}
          className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors w-1/2 ${
            generatorType === 'lfr' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          LFR
        </button>
      </div>
      
      {generatorType === 'gn' && (
        <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg">
          <h4 className="font-semibold text-gray-200">Girvan-Newman (GN) Parameters</h4>
          <Slider label="Number of Communities" value={gnParams.numCommunities} min={2} max={10} step={1} onChange={(v) => setGnParams({ ...gnParams, numCommunities: v })} />
          <Slider label="Nodes per Community" value={gnParams.nodesPerCommunity} min={10} max={50} step={1} onChange={(v) => setGnParams({ ...gnParams, nodesPerCommunity: v })} />
          <Slider label="Intra-Community Prob (p_in)" value={gnParams.p_in} min={0} max={1} step={0.01} onChange={(v) => setGnParams({ ...gnParams, p_in: v })} />
          <Slider label="Inter-Community Prob (p_out)" value={gnParams.p_out} min={0} max={0.2} step={0.005} onChange={(v) => setGnParams({ ...gnParams, p_out: v })} />
        </div>
      )}

      {generatorType === 'lfr' && (
        <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg">
          <h4 className="font-semibold text-gray-200">LFR Benchmark Parameters</h4>
          <p className="text-xs text-gray-400 -mt-2 mb-2">Generates networks with power-law degree and community size distributions.</p>
          <Slider label="Number of Nodes" value={lfrParams.n} min={50} max={500} step={10} onChange={(v) => setLfrParams({ ...lfrParams, n: v })} />
          <Slider label="Mixing Param (μ)" value={lfrParams.mu} min={0.05} max={0.8} step={0.01} onChange={(v) => setLfrParams({ ...lfrParams, mu: v })} />
          <Slider label="Min Degree" value={lfrParams.minDegree} min={1} max={10} step={1} onChange={(v) => setLfrParams({ ...lfrParams, minDegree: v })} />
          <Slider label="Max Degree" value={lfrParams.maxDegree} min={10} max={100} step={1} onChange={(v) => setLfrParams({ ...lfrParams, maxDegree: v })} />
          <Slider label="Degree Exponent (γ)" value={lfrParams.degreeExponent} min={2} max={4} step={0.1} onChange={(v) => setLfrParams({ ...lfrParams, degreeExponent: v })} />
          <Slider label="Min Community Size" value={lfrParams.minCommunity} min={10} max={50} step={1} onChange={(v) => setLfrParams({ ...lfrParams, minCommunity: v })} />
          <Slider label="Max Community Size" value={lfrParams.maxCommunity} min={20} max={100} step={1} onChange={(v) => setLfrParams({ ...lfrParams, maxCommunity: v })} />
          <Slider label="Community Exponent (β)" value={lfrParams.communityExponent} min={1} max={3} step={0.1} onChange={(v) => setLfrParams({ ...lfrParams, communityExponent: v })} />
        </div>
      )}

      <button
        onClick={() => onGenerate(generatorType)}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-md transition duration-300 disabled:opacity-50"
        disabled={isLoading}
      >
        Generate Network
      </button>
    </div>
  );
};

export default SyntheticGeneratorControls;