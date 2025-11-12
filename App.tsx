

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ControlPanel from './components/ControlPanel';
import GraphVisualizer from './components/GraphVisualizer';
// FIX: Corrected the service import path. The community detection logic was in geminiService.ts.
import { getAlgorithmExplanation, runCommunityDetection } from './services/communityDetectionService';
import { GraphData, Algorithm, Node, Link, CommunityAssignment, PerformanceResult, GNParams, LFRParams, LouvainParams, GirvanNewmanParams, RunHistoryEntry, Layout, CentralityAlgorithm, CentralityResultPackage, ColorizationMode, ActiveTool, LinkPredictionAlgorithm, LinkPredictionResult } from './types';
import { calculateNMI } from './utils/performance';
import { generateGNNetwork, generateLFRNetwork } from './utils/networkGenerators';
import VisualizationControls from './components/VisualizationControls';
import { BENCHMARK_NETWORKS } from './data/benchmarkNetworks';
import CharacterDetailModal from './components/CharacterDetailModal';
import { calculateCentrality } from './utils/centrality';
import { calculateLinkPrediction } from './utils/linkPrediction';
import { parseEdgeList, enrichNodesWithDegrees } from './utils/graphUtils';
import Legend from './components/Legend';
import Header from './components/Header';

type Theme = 'light' | 'dark';
type SaveStatus = 'idle' | 'saving' | 'saved';

const benchmarkNetworkInfo = BENCHMARK_NETWORKS.map(({ id, name }) => ({ id, name }));
const SAVED_NETWORK_KEY = 'interactive_community_detection_saved_network';

const EditingToolbar: React.FC<{
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}> = ({ activeTool, setActiveTool, onUndo, onRedo, canUndo, canRedo }) => {
    // FIX: Changed JSX.Element to React.ReactNode to resolve "Cannot find namespace 'JSX'" error.
    const tools: { id: ActiveTool; label: string; icon: React.ReactNode }[] = [
        { id: 'select', label: '选择/移动', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" /></svg> },
        { id: 'addNode', label: '添加节点', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
        { id: 'addLink', label: '添加链接', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg> },
        { id: 'delete', label: '删除', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.067-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg> },
    ];
    return (
        <div className="absolute top-4 left-4 z-10 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-lg shadow-lg p-2 flex flex-col items-center space-y-1 border border-gray-200 dark:border-gray-700">
            {tools.map(tool => (
                <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    className={`p-2 rounded-md transition-colors duration-200 ${activeTool === tool.id ? 'bg-cyan-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    title={tool.label}
                >
                    {tool.icon}
                </button>
            ))}
            <div className="w-full h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
            <button
                onClick={onUndo}
                disabled={!canUndo}
                className="p-2 rounded-md transition-colors duration-200 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                title="撤销"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
            </button>
            <button
                onClick={onRedo}
                disabled={!canRedo}
                className="p-2 rounded-md transition-colors duration-200 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                title="重做"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg>
            </button>
        </div>
    );
};


function App() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [customData, setCustomData] = useState<string>('');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<Algorithm>(Algorithm.LOUVAIN);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [explanation, setExplanation] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [groundTruth, setGroundTruth] = useState<CommunityAssignment[] | null>(null);
  const [performance, setPerformance] = useState<PerformanceResult | null>(null);
  const [scaleNodeSizeByDegree, setScaleNodeSizeByDegree] = useState<boolean>(false);
  const [showNodeLabels, setShowNodeLabels] = useState<boolean>(true);
  const [groupCommunities, setGroupCommunities] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [currentNetworkName, setCurrentNetworkName] = useState<string>('无网络');
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [layout, setLayout] = useState<Layout>(Layout.FORCE_DIRECTED);
  const [theme, setTheme] = useState<Theme>('dark');
  const [centralityResults, setCentralityResults] = useState<CentralityResultPackage | null>(null);
  const [isCalculatingCentrality, setIsCalculatingCentrality] = useState<boolean>(false);
  const [linkPredictionResults, setLinkPredictionResults] = useState<LinkPredictionResult[] | null>(null);
  const [isCalculatingLinkPrediction, setIsCalculatingLinkPrediction] = useState<boolean>(false);
  const [hoveredPredictedLink, setHoveredPredictedLink] = useState<{ source: string; target: string } | null>(null);
  const [colorizationMode, setColorizationMode] = useState<ColorizationMode>(ColorizationMode.COMMUNITY);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<ActiveTool | null>(null);
  const [linkSourceNodeId, setLinkSourceNodeId] = useState<string | null>(null);
  const [zoomResetKey, setZoomResetKey] = useState(0);
  const [history, setHistory] = useState<GraphData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isDirected, setIsDirected] = useState<boolean>(false);
  const [hasSavedNetwork, setHasSavedNetwork] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);
  
  useEffect(() => {
    if (localStorage.getItem(SAVED_NETWORK_KEY)) {
      setHasSavedNetwork(true);
    }
  }, []);
  
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
    setCentralityResults(null);
    setLinkPredictionResults(null);
  }
  
  const clearHistory = () => {
      setHistory([]);
      setHistoryIndex(-1);
  }

  const resetGraph = (graphDataToReset: GraphData, name: string, groundTruthData: CommunityAssignment[] | null, directed: boolean) => {
      // Clear any fixed positions when loading a new graph
      const nodesWithoutPosition = graphDataToReset.nodes.map(n => ({...n, fx: null, fy: null}));
      const finalGraphData = { ...graphDataToReset, nodes: nodesWithoutPosition };
      
      setGraphData(finalGraphData);
      setCurrentNetworkName(name);
      setGroundTruth(groundTruthData);
      setIsDirected(directed);
      clearResults();
      clearHistory();
      setHighlightedNodeId(null);
      setColorizationMode(ColorizationMode.COMMUNITY);
      setActiveTool(null); // Ensure we exit edit mode when loading a new graph
      setZoomResetKey(k => k + 1);
  };
  
  const updateGraphAndHistory = useCallback((newGraphData: GraphData) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newGraphData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setGraphData(newGraphData);
  }, [history, historyIndex]);

  const handleLoadBenchmark = useCallback((benchmarkId: string) => {
    try {
        const network = BENCHMARK_NETWORKS.find(n => n.id === benchmarkId);
        if (!network) {
            throw new Error(`未找到基准网络 "${benchmarkId}"`);
        }

        const { edgeList, groundTruth: newGroundTruth, nodeDetails, name } = network;
        setCustomData(edgeList);
        
        const LARGE_GRAPH_THRESHOLD = 1000;
        const lineCount = edgeList.trim().split('\n').length;
        
        const processData = (enrichedGraph: GraphData) => {
            const groundTruthMap = new Map<string, number>();
            newGroundTruth.forEach(gt => groundTruthMap.set(gt.node, gt.community));
            
            const nodesWithDetails = enrichedGraph.nodes.map(node => ({
              ...node,
              community: groundTruthMap.get(node.id),
              groundTruthCommunity: groundTruthMap.get(node.id),
              description: nodeDetails?.[node.id]?.description,
              imageUrl: nodeDetails?.[node.id]?.imageUrl,
            }));
            
            resetGraph({ ...enrichedGraph, nodes: nodesWithDetails }, name, newGroundTruth, isDirected);
        };
        
        if (lineCount > LARGE_GRAPH_THRESHOLD) {
            setIsParsing(true);
            setGraphData({ nodes: [], links: [] });
            clearResults();

            const worker = new Worker('./services/parser.worker.ts', { type: 'module' });
            worker.onmessage = (event) => {
                const { type, payload } = event.data;
                if (type === 'SUCCESS') {
                    processData(payload);
                } else {
                    setError(payload);
                }
                setIsParsing(false);
                worker.terminate();
            };
            worker.onerror = (error) => {
                console.error("Parser worker error:", error);
                setError("解析大型图数据时发生严重错误。");
                setIsParsing(false);
                worker.terminate();
            };
            worker.postMessage({ edgeList, isDirected });
        } else {
            const parsedData = parseEdgeList(edgeList);
            const enrichedData = enrichNodesWithDegrees(parsedData, isDirected);
            processData(enrichedData);
        }
    } catch (e: any) {
        setError(e.message || "加载基准网络失败。");
        console.error(e);
    }
  }, [isDirected]);

  useEffect(() => {
    handleLoadBenchmark('karate');
  }, [handleLoadBenchmark]);

  const handleParseCustomData = useCallback(() => {
    let edgeList = customData;
    let name = '自定义网络';
    let truth: CommunityAssignment[] | null = null;
    
    if (customData.trim() === '') {
      setError("数据为空。请粘贴数据或点击“新建网络”。");
      return;
    }

    if (parseEdgeList(edgeList).nodes.length === 0) {
      setError("数据无效。请输入边列表格式的数据 (例如 '节点1 节点2')。");
      return;
    }
    
    setCustomData(edgeList);
    
    const LARGE_GRAPH_THRESHOLD = 1000;
    const lineCount = edgeList.trim().split('\n').length;

    const processData = (enrichedGraph: GraphData) => {
        resetGraph(enrichedGraph, name, truth, isDirected);
    };

    if (lineCount > LARGE_GRAPH_THRESHOLD) {
        setIsParsing(true);
        setGraphData({ nodes: [], links: [] });
        clearResults();

        const worker = new Worker('./services/parser.worker.ts', { type: 'module' });
        worker.onmessage = (event) => {
            const { type, payload } = event.data;
            if (type === 'SUCCESS') {
                processData(payload);
            } else {
                setError(payload);
            }
            setIsParsing(false);
            worker.terminate();
        };
        worker.onerror = (error) => {
            console.error("Parser worker error:", error);
            setError("解析大型图数据时发生严重错误。");
            setIsParsing(false);
            worker.terminate();
        };
        worker.postMessage({ edgeList, isDirected });
    } else {
        const parsedData = parseEdgeList(edgeList);
        const enrichedData = enrichNodesWithDegrees(parsedData, isDirected);
        processData(enrichedData);
    }
  }, [customData, isDirected]);
  
  const handleGenerateNetwork = useCallback((type: 'gn' | 'lfr') => {
    let result;
    let name = '';
    // Generators create undirected networks
    const directed = false;
    if (type === 'gn') {
      result = generateGNNetwork(gnParams);
      name = '生成的 GN 网络';
    } else {
      result = generateLFRNetwork(lfrParams);
      name = '生成的 LFR 网络';
    }
    
    setCustomData(result.edgeList);
    const enrichedData = enrichNodesWithDegrees(result.graphData, directed);
    resetGraph(enrichedData, name, result.groundTruth, directed);
  }, [gnParams, lfrParams]);


  const handleRunDetection = async () => {
    if (graphData.nodes.length === 0) {
      setError("没有加载图数据。请先加载数据再运行检测。");
      return;
    }
    
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    let newPerformance: PerformanceResult | null = null;
    clearResults();
    setHighlightedNodeId(null);

    const initialGraphData = {
        ...graphData,
        nodes: graphData.nodes.map(n => ({ ...n, community: undefined, isMisclassified: false }))
    };
    setGraphData(initialGraphData);

    try {
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
          break;
        default:
          throw new Error(`算法 "${selectedAlgorithm}" 不支持。`);
      }

      const communities = await runCommunityDetection({
        graphData: initialGraphData,
        algorithm: selectedAlgorithm,
        params,
        signal,
      });

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
      setRunHistory(prev => [newHistoryEntry, ...prev.slice(0, 19)]);

      const explanationText = getAlgorithmExplanation(selectedAlgorithm);
      setExplanation(explanationText);

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
    abortControllerRef.current?.abort();
  }, []);

  const handleLoadFromHistory = (entryId: string) => {
    const entry = runHistory.find(e => e.id === entryId);
    if (entry) {
        setGraphData(entry.graphData);
        clearResults();
        clearHistory();
        setHighlightedNodeId(null);
        setError(`已从历史记录加载: ${entry.networkName} - ${entry.algorithm}`);
        setTimeout(() => setError(null), 3000);
        setZoomResetKey(k => k + 1);
    }
  };

  const handleDeleteHistoryEntry = (entryId: string) => {
      setRunHistory(prev => prev.filter(e => e.id !== entryId));
  };


  const handleNodeClick = useCallback((node: Node) => {
    setHighlightedNodeId(prevId => prevId === node.id ? null : node.id);

    if (!activeTool) {
        if (node.description || node.imageUrl) {
          setSelectedNode(node);
        }
        return;
    }

    switch (activeTool) {
        case 'addLink':
            if (!linkSourceNodeId) {
                setLinkSourceNodeId(node.id);
            } else {
                if (linkSourceNodeId === node.id) { // Clicked same node, cancel
                    setLinkSourceNodeId(null);
                    return;
                }
                const newLink: Link = { source: linkSourceNodeId, target: node.id };
                // Avoid duplicate links
                const linkExists = graphData.links.some(
                    l => (l.source === newLink.source && l.target === newLink.target) ||
                         (!isDirected && l.source === newLink.target && l.target === newLink.source)
                );
                if (!linkExists) {
                    const nextGraphData = { ...graphData, links: [...graphData.links, newLink] };
                    updateGraphAndHistory(nextGraphData);
                }
                setLinkSourceNodeId(null);
            }
            break;
        case 'delete': {
            const nextGraphData = {
                nodes: graphData.nodes.filter(n => n.id !== node.id),
                links: graphData.links.filter(l => l.source !== node.id && l.target !== node.id)
            };
            updateGraphAndHistory(nextGraphData);
            break;
        }
        default:
            // Do nothing for 'select' or 'addNode' on node click
            break;
    }
  }, [activeTool, linkSourceNodeId, graphData, isDirected, updateGraphAndHistory]);
  
  const handleLinkClick = useCallback((link: Link) => {
    if (activeTool === 'delete') {
      const nextGraphData = {
        ...graphData,
        links: graphData.links.filter(l => 
          !((l.source === link.source && l.target === link.target) || 
            (!isDirected && l.source === link.target && l.target === link.source))
        )
      };
      updateGraphAndHistory(nextGraphData);
    }
  }, [activeTool, graphData, isDirected, updateGraphAndHistory]);
  
  const handleCanvasClick = useCallback((x: number, y: number) => {
      if (activeTool === 'addNode') {
        const existingNodeNumbers = graphData.nodes
            .map(node => parseInt(node.id, 10))
            .filter(num => !isNaN(num));
        
        const nextNodeNumber = existingNodeNumbers.length > 0 ? Math.max(...existingNodeNumbers) + 1 : 1;
        const newNodeId = `${nextNodeNumber}`;

        const newNode: Node = { id: newNodeId, x, y, fx: x, fy: y };
        const nextGraphData = {
            ...graphData,
            nodes: [...graphData.nodes, newNode]
        };
        updateGraphAndHistory(nextGraphData);
      }
  }, [activeTool, graphData, updateGraphAndHistory]);
  
  const handleBackgroundClick = useCallback(() => {
    setHighlightedNodeId(null);
    if (linkSourceNodeId) {
        setLinkSourceNodeId(null);
    }
  }, [linkSourceNodeId]);
  
  const handleNewNetwork = useCallback(() => {
    const initialGraph = { nodes: [], links: [] };
    setGraphData(initialGraph);
    setHistory([initialGraph]);
    setHistoryIndex(0);
    setCustomData('');
    setCurrentNetworkName('新网络');
    clearResults();
    setHighlightedNodeId(null);
    setActiveTool('addNode');
    setZoomResetKey(k => k + 1);
  }, []);
  
  const handleEnterEditingMode = useCallback(() => {
    setHistory([graphData]);
    setHistoryIndex(0);
    setActiveTool('select');
  }, [graphData]);

  const handleFinishEditing = useCallback(() => {
    setActiveTool(null);
    setLinkSourceNodeId(null);
    clearHistory();
    setHighlightedNodeId(null);
    const edgeList = graphData.links.map(l => `${l.source} ${l.target}`).join('\n');
    setCustomData(edgeList);
    // Re-enrich with degree data
    setGraphData(prev => enrichNodesWithDegrees(prev, isDirected));
  }, [graphData, isDirected]);
  
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setGraphData(history[newIndex]);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setGraphData(history[newIndex]);
    }
  }, [history, historyIndex]);


  const handleCloseModal = () => {
    setSelectedNode(null);
  };

  const handleCalculateCentrality = useCallback(async (algorithm: CentralityAlgorithm) => {
    if (graphData.nodes.length === 0) {
      setError("没有加载图数据，无法计算中心性。");
      return;
    }
    setIsCalculatingCentrality(true);
    setError(null);
    setCentralityResults(null);
    setLinkPredictionResults(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      const resultsPackage = calculateCentrality(graphData, algorithm, isDirected);

      if ('authority' in resultsPackage) {
        // Handle HITS result
        const { authority, hub } = resultsPackage;
        authority.sort((a, b) => b.score - a.score);
        hub.sort((a, b) => b.score - a.score);

        const authorityMap = new Map(authority.map(r => [r.nodeId, r.score]));
        const hubMap = new Map(hub.map(r => [r.nodeId, r.score]));

        setGraphData(prevData => ({
          ...prevData,
          nodes: prevData.nodes.map(node => ({
            ...node,
            attributes: {
              ...node.attributes,
              [CentralityAlgorithm.HITS_AUTHORITY]: authorityMap.get(node.id) ?? 0,
              [CentralityAlgorithm.HITS_HUB]: hubMap.get(node.id) ?? 0,
            }
          }))
        }));

        if (algorithm === CentralityAlgorithm.HITS_AUTHORITY) {
          setCentralityResults({ algorithm, results: authority });
          setColorizationMode(ColorizationMode.AUTHORITY);
        } else {
          setCentralityResults({ algorithm, results: hub });
          setColorizationMode(ColorizationMode.HUB);
        }
      } else {
        // Handle other centrality results
        const results = resultsPackage;
        results.sort((a, b) => b.score - a.score);
        setCentralityResults({ algorithm, results });
        
        const scoreMap = new Map(results.map(r => [r.nodeId, r.score]));
        
        setGraphData(prevData => ({
            ...prevData,
            nodes: prevData.nodes.map(node => ({
                ...node,
                attributes: {
                    ...node.attributes,
                    [algorithm]: scoreMap.get(node.id) ?? 0,
                }
            }))
        }));
        
        // Automatically switch color mode to the calculated centrality
        switch (algorithm) {
          case CentralityAlgorithm.IN_DEGREE:
            setColorizationMode(ColorizationMode.IN_DEGREE);
            break;
          case CentralityAlgorithm.OUT_DEGREE:
            setColorizationMode(ColorizationMode.OUT_DEGREE);
            break;
          case CentralityAlgorithm.CLOSENESS:
            setColorizationMode(ColorizationMode.CLOSENESS);
            break;
          case CentralityAlgorithm.BETWEENNESS:
            setColorizationMode(ColorizationMode.BETWEENNESS);
            break;
          case CentralityAlgorithm.PAGERANK:
            setColorizationMode(ColorizationMode.PAGERANK);
            break;
        }
      }
    } catch (e: any) {
        console.error("Centrality calculation failed:", e);
        setError(`计算中心性时出错: ${e.message}`);
    } finally {
        setIsCalculatingCentrality(false);
    }
  }, [graphData, isDirected]);
  
  const handleClearCentrality = useCallback(() => {
    setCentralityResults(null);
  }, []);
  
  const handleCalculateLinkPrediction = useCallback(async (algorithm: LinkPredictionAlgorithm) => {
    if (graphData.nodes.length === 0) {
      setError("没有加载图数据，无法进行链路预测。");
      return;
    }
    setIsCalculatingLinkPrediction(true);
    setError(null);
    setLinkPredictionResults(null);
    setCentralityResults(null);

    try {
        await new Promise(resolve => setTimeout(resolve, 0));
        const results = calculateLinkPrediction(graphData, algorithm);
        results.sort((a, b) => b.score - a.score);
        setLinkPredictionResults(results);
    } catch (e: any) {
        console.error("Link prediction failed:", e);
        setError(`链路预测时出错: ${e.message}`);
    } finally {
        setIsCalculatingLinkPrediction(false);
    }
  }, [graphData]);
  
  const handleHoverPredictedLink = useCallback((link: { source: string; target: string } | null) => {
    setHoveredPredictedLink(link);
  }, []);

  const handleSaveNetwork = useCallback(() => {
    if (graphData.nodes.length === 0) {
      setError("无法保存空网络。");
      setTimeout(() => setError(null), 3000);
      return;
    }
    setSaveStatus('saving');
    try {
      const currentEdgeList = graphData.links.map(l => {
        const sourceId = typeof l.source === 'object' ? (l.source as Node).id : l.source;
        const targetId = typeof l.target === 'object' ? (l.target as Node).id : l.target;
        return `${sourceId} ${targetId}`;
      }).join('\n');

      const dataToSave = {
        edgeList: currentEdgeList,
        isDirected: isDirected,
      };
      localStorage.setItem(SAVED_NETWORK_KEY, JSON.stringify(dataToSave));
      setHasSavedNetwork(true);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      setError("无法将网络保存到本地存储。存储空间可能已满。");
      setTimeout(() => setError(null), 3000);
      setSaveStatus('idle');
      console.error("Save error:", e);
    }
  }, [graphData, isDirected]);

  const handleLoadSavedNetwork = useCallback(() => {
    const savedDataString = localStorage.getItem(SAVED_NETWORK_KEY);
    if (savedDataString) {
      try {
        const savedData = JSON.parse(savedDataString);
        const { edgeList, isDirected: savedIsDirected } = savedData;

        setCustomData(edgeList);
        
        const parsedData = parseEdgeList(edgeList);
        const enrichedData = enrichNodesWithDegrees(parsedData, savedIsDirected);
        resetGraph(enrichedData, "已保存的网络", null, savedIsDirected);

      } catch (e) {
        setError("加载或解析已保存的网络失败。");
        setTimeout(() => setError(null), 3000);
        console.error("Load error:", e);
      }
    } else {
      setError("在本地存储中未找到已保存的网络。");
      setTimeout(() => setError(null), 3000);
    }
  }, []);
  
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;


  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <Header theme={theme} setTheme={setTheme} />
      <div className="flex flex-grow min-h-0">
        <aside className="w-1/3 lg:w-1/4 h-full flex-shrink-0">
          <ControlPanel
            graphData={graphData}
            customData={customData}
            setCustomData={setCustomData}
            selectedAlgorithm={selectedAlgorithm}
            setSelectedAlgorithm={setSelectedAlgorithm}
            onParse={handleParseCustomData}
            onLoadBenchmark={handleLoadBenchmark}
            onNewNetwork={handleNewNetwork}
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
            centralityResults={centralityResults}
            onCalculateCentrality={handleCalculateCentrality}
            onClearCentrality={handleClearCentrality}
            isCalculatingCentrality={isCalculatingCentrality}
            linkPredictionResults={linkPredictionResults}
            onCalculateLinkPrediction={handleCalculateLinkPrediction}
            isCalculatingLinkPrediction={isCalculatingLinkPrediction}
            onHoverPredictedLink={handleHoverPredictedLink}
            isDirected={isDirected}
            setIsDirected={setIsDirected}
            onSaveNetwork={handleSaveNetwork}
            onLoadSavedNetwork={handleLoadSavedNetwork}
            hasSavedNetwork={hasSavedNetwork}
            saveStatus={saveStatus}
          />
        </aside>

        <main className="flex-grow h-full min-w-0 bg-gray-200 dark:bg-black relative">
           {activeTool && (
                <EditingToolbar
                    activeTool={activeTool}
                    setActiveTool={setActiveTool}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                />
            )}
           {(graphData.nodes.length > 0 || activeTool) && (
                <button
                    onClick={() => activeTool ? handleFinishEditing() : handleEnterEditingMode()}
                    className={`absolute top-4 right-4 z-10 font-semibold py-2 px-4 rounded-lg shadow-lg transition-all border flex items-center
                    ${activeTool 
                        ? 'bg-green-600 hover:bg-green-500 text-white border-green-700' 
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700'}`
                    }
                >
                   {activeTool ? (
                       <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 mr-2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>完成编辑</>
                   ) : (
                       <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>编辑网络</>
                   )}
                </button>
            )}
          {isParsing ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm z-10">
                  <div className="text-center">
                      <svg className="animate-spin h-12 w-12 text-cyan-600 dark:text-cyan-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">正在处理大型网络数据...</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">这可能需要一些时间，请稍候。</p>
                  </div>
              </div>
          ) : (graphData.nodes.length > 0 || activeTool) ? (
            <GraphVisualizer 
              graphData={graphData} 
              scaleNodeSizeByDegree={scaleNodeSizeByDegree} 
              showNodeLabels={showNodeLabels}
              groupCommunities={groupCommunities}
              onNodeClick={handleNodeClick}
              onLinkClick={handleLinkClick}
              onCanvasClick={handleCanvasClick}
              onBackgroundClick={handleBackgroundClick}
              layout={layout}
              theme={theme}
              colorizationMode={colorizationMode}
              activeTool={activeTool}
              linkSourceNodeId={linkSourceNodeId}
              resetZoomKey={zoomResetKey}
              isDirected={isDirected}
              highlightedNodeId={highlightedNodeId}
              hoveredPredictedLink={hoveredPredictedLink}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
                <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-24 w-24 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="mt-4 text-lg font-semibold">加载或生成图数据以开始</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">请使用左侧面板选择数据源</p>
                </div>
            </div>
          )}
        </main>
        
        <aside className="w-64 h-full flex-shrink-0 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700/50 flex flex-col">
          <div className="flex-grow p-4 overflow-y-auto">
              <VisualizationControls 
                scaleNodeSizeByDegree={scaleNodeSizeByDegree}
                setScaleNodeSizeByDegree={setScaleNodeSizeByDegree}
                showNodeLabels={showNodeLabels}
                setShowNodeLabels={setShowNodeLabels}
                groupCommunities={groupCommunities}
                setGroupCommunities={setGroupCommunities}
                layout={layout}
                setLayout={setLayout}
                colorizationMode={colorizationMode}
                setColorizationMode={setColorizationMode}
                graphData={graphData}
              />
          </div>
          <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700/50">
             {showLegend && graphData.nodes.length > 0 && (
                <Legend graphData={graphData} colorizationMode={colorizationMode} theme={theme} />
              )}
              <label htmlFor="show-legend-toggle" className="flex items-center cursor-pointer mt-4">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-3">显示图例</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      id="show-legend-toggle"
                      className="sr-only peer"
                      checked={showLegend}
                      onChange={(e) => setShowLegend(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer-checked:bg-cyan-600 transition-colors"></div>
                    <div className="absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-full"></div>
                  </div>
                </label>
          </div>
        </aside>
      </div>

      {selectedNode && (
        <CharacterDetailModal node={selectedNode} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default App;