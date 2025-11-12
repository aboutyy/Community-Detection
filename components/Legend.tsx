import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { GraphData, ColorizationMode, CentralityAlgorithm } from '../types';

const colorModeToAttrKey: { [key: string]: CentralityAlgorithm | string | undefined } = {
    [ColorizationMode.IN_DEGREE]: CentralityAlgorithm.IN_DEGREE,
    [ColorizationMode.OUT_DEGREE]: CentralityAlgorithm.OUT_DEGREE,
    [ColorizationMode.CLOSENESS]: CentralityAlgorithm.CLOSENESS,
    [ColorizationMode.BETWEENNESS]: CentralityAlgorithm.BETWEENNESS,
    [ColorizationMode.PAGERANK]: CentralityAlgorithm.PAGERANK,
    [ColorizationMode.AUTHORITY]: CentralityAlgorithm.HITS_AUTHORITY,
    [ColorizationMode.HUB]: CentralityAlgorithm.HITS_HUB,
};

interface LegendProps {
  graphData: GraphData;
  colorizationMode: ColorizationMode;
  theme: 'light' | 'dark';
}

const Legend: React.FC<LegendProps> = ({ graphData, colorizationMode, theme }) => {
  const legendData = useMemo(() => {
    const { nodes } = graphData;
    if (!nodes || nodes.length === 0) return null;

    // Categorical Legends
    if (colorizationMode === ColorizationMode.COMMUNITY || colorizationMode === ColorizationMode.GROUND_TRUTH) {
      const communityKey = colorizationMode === ColorizationMode.COMMUNITY ? 'community' : 'groundTruthCommunity';
      const communities = Array.from(new Set(nodes.map(n => n[communityKey]).filter(c => c !== undefined)))
                             .sort((a, b) => (a as number) - (b as number));
                             
      if (communities.length === 0 || communities.length > 20) return null; // Don't show legend if no communities or too many

      const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
      
      return {
        type: 'categorical',
        title: colorizationMode === ColorizationMode.COMMUNITY ? '社区' : '真实社群',
        items: communities.map(c => ({
          label: `${c}`,
          color: colorScale(String(c)),
        })),
      };
    }
    
    // Continuous Legends
    const attrKey = colorModeToAttrKey[colorizationMode];
    if (attrKey) {
      const values = nodes.map(n => n.attributes?.[attrKey as string]).filter(v => v !== undefined) as number[];
      if (values.length === 0) return null;

      const min = d3.min(values) ?? 0;
      const max = d3.max(values) ?? 1;

      const domain = (Math.abs(min - max) < 1e-9) ? [min - 0.5, max + 0.5] : [min, max];
      const colorScale = d3.scaleSequential(d3.interpolateViridis).domain(domain);
      
      const gradientStops = d3.range(0, 1.01, 0.1).map(t => colorScale(domain[0] + t * (domain[1] - domain[0]))).join(', ');
      
      return {
        type: 'continuous',
        title: colorizationMode.replace('按', '').trim(),
        gradient: `linear-gradient(to right, ${gradientStops})`,
        minLabel: min.toFixed(3),
        maxLabel: max.toFixed(3),
      };
    }
    
    return null;
  }, [graphData, colorizationMode]);

  if (!legendData) return null;
  
  const textColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
  const headerColor = theme === 'dark' ? 'text-gray-100' : 'text-gray-800';

  return (
    <div className={`bg-gray-100/50 dark:bg-gray-900/50 p-3 rounded-lg w-full ${textColor}`}>
      <h4 className={`font-bold text-sm mb-2 ${headerColor}`}>{legendData.title}</h4>
      {legendData.type === 'categorical' && (
        <div className="space-y-1 max-h-40 overflow-y-auto pr-2">
          {legendData.items.map(item => (
            <div key={item.label} className="flex items-center text-xs">
              <span className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: item.color }}></span>
              <span>社区 {item.label}</span>
            </div>
          ))}
        </div>
      )}
      {legendData.type === 'continuous' && (
        <div>
          <div className="h-3 w-full rounded-full border border-gray-300/50 dark:border-gray-600/50" style={{ background: legendData.gradient }}></div>
          <div className="flex justify-between text-xs mt-1 font-mono">
            <span>{legendData.minLabel}</span>
            <span>{legendData.maxLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Legend;