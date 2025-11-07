import React, { useState, useCallback, useRef } from 'react';
import ControlPanel from './components/ControlPanel';
import GraphVisualizer from './components/GraphVisualizer';
import { getAlgorithmExplanation, runCommunityDetection } from './services/geminiService';
import { GraphData, Algorithm, Node, Link, CommunityAssignment, PerformanceResult, GNParams, LFRParams, LouvainParams, GirvanNewmanParams, RunHistoryEntry } from './types';
import { calculateNMI } from './utils/performance';
import { generateGNNetwork, generateLFRNetwork } from './utils/networkGenerators';
import VisualizationControls from './components/VisualizationControls';
import { BENCHMARK_NETWORKS } from './data/benchmarkNetworks';
import CharacterDetailModal from './components/CharacterDetailModal';


const parseEdgeList = (data: string): GraphData => {
  const links: Link[] = [];
  const nodeSet = new Set<string>();
  const lines = data.trim().split('\n');

  lines.forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      const [source, target] = parts;
      if (source && target) {
        links.push({ source, target });
        nodeSet.add(source);
        nodeSet.add(target);
      }
    }
  });
  
  const nodes: Node[] = Array.from(nodeSet).map(id => ({ id }));
  return { nodes, links };
};

const benchmarkNetworkInfo = BENCHMARK_NETWORKS.map(({ id, name }) => ({ id, name }));

function App() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [customData, setCustomData] = useState<string>('');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<Algorithm>(Algorithm.LOUVAIN);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [explanation, setExplanation] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [groundTruth, setGroundTruth] = useState<CommunityAssignment[] | null>(null);
  const [performance, setPerformance] = useState<PerformanceResult | null>(null);
  const [scaleNodeSizeByDegree, setScaleNodeSizeByDegree] = useState<boolean>(true);
  const [showNodeLabels, setShowNodeLabels] = useState<boolean>(true);
  const [groupCommunities, setGroupCommunities] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [currentNetworkName, setCurrentNetworkName] = useState<string>('无网络');
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [gnParams, setGnParams] = useState<GNParams>({
    numCommunities: 4,
    nodesPerCommunity: 30,
    p_in: 0.7,
    p_out: 0.01,
  });

  const [lfrParams, setLfrParams] = useState<LFRParams>({
    n: 150,
    mu: 0.1,
    minCommunity: 20,
    maxCommunity: 50,
    degreeExponent: 2.5,
    communityExponent: 1.5,
    minDegree: 5,
    maxDegree: 40,
  });

  const [louvainParams, setLouvainParams] = useState<LouvainParams>({
    resolution: 1.0,
  });

  const [girvanNewmanParams, setGirvanNewmanParams] = useState<GirvanNewmanParams>({
    targetCommunities: 2,
  });

  const clearResults = () => {
    setExplanation('');
    setError(null);
    setPerformance(null);
  }

  const handleLoadBenchmark = useCallback((benchmarkId: string) => {
    try {
        const network = BENCHMARK_NETWORKS.find(n => n.id === benchmarkId);
        if (!network) {
            throw new Error(`未找到基准网络 "${benchmarkId}"`);
        }

        const { edgeList, groundTruth: newGroundTruth, nodeDetails, name } = network;
        const parsedData = parseEdgeList(edgeList);
        setCustomData(edgeList);
        setCurrentNetworkName(name);

        // Immediately add ground truth community data to nodes for visualization
        const groundTruthMap = new Map<string, number>();
        newGroundTruth.forEach(gt => groundTruthMap.set(gt.node, gt.community));
        
        const nodesWithDetails = parsedData.nodes.map(node => ({
          ...node,
          community: groundTruthMap.get(node.id),
          groundTruthCommunity: groundTruthMap.get(node.id),
          description: nodeDetails?.[node.id]?.description,
          imageUrl: nodeDetails?.[node.id]?.imageUrl,
        }));
        
        setGraphData({ ...parsedData, nodes: nodesWithDetails });
        setGroundTruth(newGroundTruth);
        clearResults();
    } catch (e: any) {
        setError(e.message || "加载基准网络失败。");
        console.error(e);
    }
  }, []);

  const handleParseCustomData = useCallback(() => {
    const parsedData = parseEdgeList(customData);
    if(parsedData.nodes.length === 0) {
      setError("数据无效或为空。请输入边列表格式的数据 (例如 '节点1 节点2')。");
      return;
    }
    setGraphData(parsedData);
    setGroundTruth(null); // Custom data has no ground truth
    setCurrentNetworkName('自定义网络');
    clearResults();
  }, [customData]);
  
  const handleGenerateNetwork = useCallback((type: 'gn' | 'lfr') => {
    let result;
    if (type === 'gn') {
      result = generateGNNetwork(gnParams);
      setCurrentNetworkName('生成的 GN 网络');
    } else {
      result = generateLFRNetwork(lfrParams);
      setCurrentNetworkName('生成的 LFR 网络');
    }
    
    // The generator now returns graphData with communities included
    setGraphData(result.graphData);
    setGroundTruth(result.groundTruth);
    setCustomData(result.edgeList);
    clearResults();
  }, [gnParams, lfrParams]);


  const handleRunDetection = async () => {
    if (graphData.nodes.length === 0) {
      setError("没有加载图数据。请先加载数据再运行检测。");
      return;
    }
    
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    setIsLoading(true);
    let newPerformance: PerformanceResult | null = null;
    clearResults();

    // Reset communities and misclassified status before detection, but keep other details
    const initialGraphData = {
        ...graphData,
        nodes: graphData.nodes.map(n => ({ ...n, community: undefined, isMisclassified: false }))
    };
    setGraphData(initialGraphData);

    try {
      // --- Step 1: Run community detection using the Gemini API ---
      let params = {};
      let paramsString = '默认参数';
      switch(selectedAlgorithm) {
        case Algorithm.LOUVAIN:
          params = louvainParams;
          paramsString = `分辨率: ${louvainParams.resolution.toFixed(2)}`;
          break;
        case Algorithm.GIRVAN_NEWMAN:
          params = girvanNewmanParams;
          paramsString = `目标社群数: ${girvanNewmanParams.targetCommunities}`;
          break;
        case Algorithm.LABEL_PROPAGATION:
          // LPA has no user-configurable parameters in this implementation
          break;
        default:
          throw new Error(`算法 "${selectedAlgorithm}" 不支持。`);
      }

      const communities = await runCommunityDetection(initialGraphData, selectedAlgorithm, params, signal);
      
      const communityMap = new Map<string, number>();
      communities.forEach(c => {
        communityMap.set(c.node, c.community);
      });

      const updatedNodes = initialGraphData.nodes.map(node => {
        const detectedComm = communityMap.get(node.id);
        const trueComm = node.groundTruthCommunity;
        const isMisclassified = detectedComm !== undefined && trueComm !== undefined && detectedComm !== trueComm;
        
        return {
          ...node,
          community: detectedComm,
          isMisclassified: isMisclassified,
        };
      });
      
      const finalGraphData = { ...initialGraphData, nodes: updatedNodes };
      setGraphData(finalGraphData);
      
      if (groundTruth && groundTruth.length > 0) {
        const nmi = calculateNMI(groundTruth, communities, initialGraphData.nodes);
        newPerformance = { nmi };
        setPerformance(newPerformance);
      }

      const newHistoryEntry: RunHistoryEntry = {
        id: Date.now().toString(),
        networkName: currentNetworkName,
        algorithm: selectedAlgorithm,
        params: paramsString,
        performance: newPerformance,
        graphData: finalGraphData,
      };
      setRunHistory(prev => [newHistoryEntry, ...prev.slice(0, 19)]); // Keep max 20 entries

      // --- Step 2: Asynchronously fetch the explanation from Gemini ---
      try {
        if (signal.aborted) throw new DOMException("Request aborted by user", "AbortError");
        const explanationText = await getAlgorithmExplanation(selectedAlgorithm, signal);
        setExplanation(explanationText);
      } catch (explanationError) {
        if (explanationError instanceof DOMException && explanationError.name === 'AbortError') {
            // This is expected if the user cancels
        } else {
            console.error("无法获取解释，但社区已计算完成。", explanationError);
            setExplanation("社区发现成功，但从AI加载算法解释失败。");
        }
      }

    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError("检测已被取消。");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("检测过程中发生未知错误。");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };
  
  const handleCancelDetection = useCallback(() => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
  }, []);

  const handleLoadFromHistory = (entryId: string) => {
    const entry = runHistory.find(e => e.id === entryId);
    if (entry) {
        setGraphData(entry.graphData);
        clearResults();
        setError(`已从历史记录加载: ${entry.networkName} - ${entry.algorithm}`);
        setTimeout(() => setError(null), 3000); // Temporary message
    }
  };

  const handleDeleteHistoryEntry = (entryId: string) => {
      setRunHistory(prev => prev.filter(e => e.id !== entryId));
  };


  const handleNodeClick = (node: Node) => {
    if (node.description || node.imageUrl) {
      setSelectedNode(node);
    }
  };

  const handleCloseModal = () => {
    setSelectedNode(null);
  };


  return (
    <div className="flex flex-col md:flex-row h-screen w-screen p-4 gap-4">
      <header className="md:hidden p-2">
          <h1 className="text-2xl font-bold text-center text-cyan-300">社区发现可视化工具</h1>
      </header>
      <aside className="w-full md:w-1/3 lg:w-1/4 h-auto md:h-full flex-shrink-0">
        <ControlPanel
          customData={customData}
          setCustomData={setCustomData}
          selectedAlgorithm={selectedAlgorithm}
          setSelectedAlgorithm={setSelectedAlgorithm}
          onParse={handleParseCustomData}
          onLoadBenchmark={handleLoadBenchmark}
          onRun={handleRunDetection}
          onCancel={handleCancelDetection}
          isLoading={isLoading}
          explanation={explanation}
          error={error}
          performance={performance}
          gnParams={gnParams}
          setGnParams={setGnParams}
          lfrParams={lfrParams}
          setLfrParams={setLfrParams}
          louvainParams={louvainParams}
          setLouvainParams={setLouvainParams}
          girvanNewmanParams={girvanNewmanParams}
          setGirvanNewmanParams={setGirvanNewmanParams}
          onGenerate={handleGenerateNetwork}
          benchmarkNetworks={benchmarkNetworkInfo}
          runHistory={runHistory}
          onLoadFromHistory={handleLoadFromHistory}
          onDeleteHistoryEntry={handleDeleteHistoryEntry}
        />
      </aside>
      <main className="w-full md:w-2/3 lg:w-3/4 h-1/2 md:h-full min-h-0 bg-gray-800 rounded-lg shadow-lg flex flex-col">
        <div className="p-4 border-b border-gray-700 hidden md:flex justify-between items-center flex-wrap gap-2">
            <h1 className="text-2xl font-bold text-cyan-300">网络可视化</h1>
            <VisualizationControls 
              scaleNodeSizeByDegree={scaleNodeSizeByDegree}
              setScaleNodeSizeByDegree={setScaleNodeSizeByDegree}
              showNodeLabels={showNodeLabels}
              setShowNodeLabels={setShowNodeLabels}
              groupCommunities={groupCommunities}
              setGroupCommunities={setGroupCommunities}
            />
        </div>
        <div className="flex-grow p-2 min-h-0">
          {graphData.nodes.length > 0 ? (
            <GraphVisualizer 
              graphData={graphData} 
              scaleNodeSizeByDegree={scaleNodeSizeByDegree} 
              showNodeLabels={showNodeLabels}
              groupCommunities={groupCommunities}
              onNodeClick={handleNodeClick}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
                <p>加载或生成图数据以开始。</p>
            </div>
          )}
        </div>
      </main>
      {selectedNode && (
        <CharacterDetailModal node={selectedNode} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default App;
