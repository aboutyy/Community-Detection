

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, Node as NodeType, Link as LinkType, Layout, ColorizationMode, CentralityAlgorithm, ActiveTool } from '../types';

interface GraphVisualizerProps {
  graphData: GraphData;
  scaleNodeSizeByDegree: boolean;
  showNodeLabels: boolean;
  groupCommunities: boolean;
  onNodeClick: (node: NodeType) => void;
  onLinkClick: (link: LinkType) => void;
  onCanvasClick: (x: number, y: number) => void;
  onBackgroundClick: () => void;
  layout: Layout;
  theme: 'light' | 'dark';
  colorizationMode: ColorizationMode;
  activeTool: ActiveTool | null;
  linkSourceNodeId: string | null;
  resetZoomKey: number;
  isDirected: boolean;
  highlightedNodeId: string | null;
  hoveredPredictedLink: { source: string, target: string } | null;
}

// Fix: Define a type for links that is compatible with d3's simulation, which expects source and target to be nodes.
type SimulationLink = d3.SimulationLinkDatum<NodeType>;

// Fix: Create a stable mapping from the UI's colorization mode to the data attribute key.
// The previous string manipulation was brittle and only worked for PageRank.
const colorModeToAttrKey: { [key: string]: CentralityAlgorithm | string | undefined } = {
    [ColorizationMode.IN_DEGREE]: CentralityAlgorithm.IN_DEGREE,
    [ColorizationMode.OUT_DEGREE]: CentralityAlgorithm.OUT_DEGREE,
    [ColorizationMode.CLOSENESS]: CentralityAlgorithm.CLOSENESS,
    [ColorizationMode.BETWEENNESS]: CentralityAlgorithm.BETWEENNESS,
    [ColorizationMode.PAGERANK]: CentralityAlgorithm.PAGERANK,
    [ColorizationMode.AUTHORITY]: CentralityAlgorithm.HITS_AUTHORITY,
    [ColorizationMode.HUB]: CentralityAlgorithm.HITS_HUB,
};


const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ graphData, scaleNodeSizeByDegree, showNodeLabels, groupCommunities, onNodeClick, onLinkClick, onCanvasClick, onBackgroundClick, layout, theme, colorizationMode, activeTool, linkSourceNodeId, resetZoomKey, isDirected, highlightedNodeId, hoveredPredictedLink }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Fix: Correctly type the simulation ref. The original LinkType was not compatible.
  // Fix: The `useRef` hook requires an initial value when a type argument is provided.
  const simulationRef = useRef<d3.Simulation<NodeType, SimulationLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const lastResetKey = useRef<number | null>(null);


  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(containerRef.current).select<HTMLDivElement>('#graph-tooltip');
    
    const isNewGraph = resetZoomKey !== lastResetKey.current;

    // Cache current node positions and velocities before the re-render, but only if it's not a new graph.
    // This prevents the layout from "jumping" when data attributes change (e.g., centrality scores).
    const oldNodesMap = new Map<string, { x?: number; y?: number; vx?: number; vy?: number }>();
    if (!isNewGraph && simulationRef.current) {
        simulationRef.current.nodes().forEach(node => {
            oldNodesMap.set(node.id, { x: node.x, y: node.y, vx: node.vx, vy: node.vy });
        });
    }

    // Fix: Directly use svgRef.current to get dimensions to avoid an error on svg.node().
    const width = svgRef.current.getBoundingClientRect().width || 800;
    const height = svgRef.current.getBoundingClientRect().height || 600;

    svg.selectAll("*").remove(); // Clear previous render

    const container = svg.append("g");
    
    // Theme-aware colors
    const linkColor = theme === 'dark' ? '#4b5563' : '#d1d5db'; // gray-600 dark, gray-300 light
    const labelColor = theme === 'dark' ? '#d1d5db' : '#374151'; // gray-300 dark, gray-700 light
    const defaultNodeColor = theme === 'dark' ? '#6b7280' : '#9ca3af'; // gray-500 dark, gray-400 light
    const nodeStrokeColor = theme === 'dark' ? '#fff' : '#1f2937'; // white dark, gray-800 light
    const linkSourceStrokeColor = theme === 'dark' ? '#2dd4bf' : '#0d9488'; // teal-400 dark, teal-600 light
    const deleteHoverColor = '#ef4444'; // red-500
    const nodeHoverStrokeColor = theme === 'dark' ? '#5eead4' : '#14b8a6'; // teal-300 dark, teal-500 light
    const predictedLinkHoverStrokeColor = '#a855f7'; // purple-500
    
    // Add arrow marker definition for directed graphs
    if (isDirected) {
      svg.append('defs').append('marker')
          .attr('id', 'arrowhead')
          .attr('viewBox', '-0 -5 10 10')
          .attr('refX', 9)
          .attr('refY', 0)
          .attr('orient', 'auto')
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('xoverflow', 'visible')
        .append('svg:path')
          .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
          .attr('fill', linkColor)
          .style('stroke', 'none');
    }

    const nodes: NodeType[] = JSON.parse(JSON.stringify(graphData.nodes));
    const links: LinkType[] = JSON.parse(JSON.stringify(graphData.links));

    // Apply cached positions and velocities to the new nodes array to ensure continuity.
    if (oldNodesMap.size > 0) {
        nodes.forEach(node => {
            const oldNodeState = oldNodesMap.get(node.id);
            if (oldNodeState) {
                node.x = oldNodeState.x;
                node.y = oldNodeState.y;
                node.vx = oldNodeState.vx;
                node.vy = oldNodeState.vy;
            }
        });
    }

    // --- Start of Node Sizing Logic ---
    const degrees = new Map<string, number>();
    nodes.forEach(node => degrees.set(node.id, 0));
    // FIX: The type of link.source/target can be ambiguous (string, number, or Node object)
    // from d3's perspective, and potentially null. Added checks to handle this robustly.
    links.forEach(link => {
      const { source, target } = link;
      if (source == null || target == null) {
        return;
      }

      // Resolve node ID whether source/target is an ID string/number or a full Node object.
      const sourceId = typeof source === 'object' ? (source as NodeType).id : source;
      const targetId = typeof target === 'object' ? (target as NodeType).id : target;

      // Ensure IDs are strings before using as map keys.
      const sourceKey = String(sourceId);
      const targetKey = String(targetId);

      degrees.set(sourceKey, (degrees.get(sourceKey) || 0) + 1);
      degrees.set(targetKey, (degrees.get(targetKey) || 0) + 1);
    });

    let radiusScale: d3.ScalePower<number, number, never> | null = null;
    if (scaleNodeSizeByDegree) {
        const degreeValues = Array.from(degrees.values());
        if (degreeValues.length > 0) {
            const minDegree = Math.min(...degreeValues);
            const maxDegree = Math.max(...degreeValues);

            if (minDegree !== maxDegree) {
                radiusScale = d3.scaleSqrt()
                    .domain([minDegree, maxDegree])
                    .range([5, 25]); // Range of pixel radii
            }
        }
    }

    const getNodeRadius = (d: NodeType): number => {
        if (scaleNodeSizeByDegree && radiusScale) {
            return radiusScale(degrees.get(d.id) ?? 1);
        }
        return 8; // Default fixed size
    };
    // --- End of Node Sizing Logic ---

    // --- Start of Node Coloring Logic ---
    const communityColor = d3.scaleOrdinal(d3.schemeCategory10);
    let continuousColorScale: d3.ScaleSequential<string, never> | null = null;
    
    // Use the new stable mapping to find the correct attribute key
    const attrKey = colorModeToAttrKey[colorizationMode];

    if (attrKey) {
        const values = nodes.map(n => n.attributes?.[attrKey as string]).filter(v => v !== undefined) as number[];
        if (values.length > 0) {
            const min = d3.min(values) ?? 0;
            const max = d3.max(values) ?? 1;
            // Handle the edge case where all values are the same
            if (Math.abs(min - max) < 1e-9) {
                 continuousColorScale = d3.scaleSequential(d3.interpolateViridis).domain([min - 0.5, max + 0.5]);
            } else {
                 continuousColorScale = d3.scaleSequential(d3.interpolateViridis).domain([min, max]);
            }
        }
    }

    const getNodeColor = (d: NodeType): string => {
        // Check for centrality coloring first
        if (attrKey && continuousColorScale) {
            const value = d.attributes?.[attrKey as string];
            return value !== undefined ? continuousColorScale(value) : defaultNodeColor;
        }
        
        // Fallback to categorical coloring
        switch (colorizationMode) {
            case ColorizationMode.GROUND_TRUTH:
                return d.groundTruthCommunity !== undefined ? communityColor(d.groundTruthCommunity.toString()) : defaultNodeColor;
            case ColorizationMode.COMMUNITY:
            default:
                return d.community !== undefined ? communityColor(d.community.toString()) : defaultNodeColor;
        }
    };
    // --- End of Node Coloring Logic ---


    // --- Start of Community Clustering Logic ---
    const communities = Array.from(new Set(nodes.map(n => n.community).filter(c => c !== undefined)));
    const numCommunities = communities.length;
    const clusterCenters: { [key: number]: { x: number; y: number } } = {};

    if (numCommunities > 1) {
      const radius = Math.min(width, height) / 3;
      communities.forEach((communityId, i) => {
        if (communityId !== undefined) {
          const angle = (i / numCommunities) * 2 * Math.PI;
          clusterCenters[communityId] = {
            x: width / 2 + radius * Math.cos(angle),
            y: height / 2 + radius * Math.sin(angle),
          };
        }
      });
    }

    const getClusterX = (d: NodeType): number => {
      if (d.community !== undefined && clusterCenters[d.community]) {
        return clusterCenters[d.community].x;
      }
      return width / 2;
    };

    const getClusterY = (d: NodeType): number => {
      if (d.community !== undefined && clusterCenters[d.community]) {
        return clusterCenters[d.community].y;
      }
      return height / 2;
    };
    // --- End of Community Clustering Logic ---

    if (!simulationRef.current) {
        // FIX: Reverted to using type casting instead of generic arguments to resolve "Untyped function calls may not accept type arguments" error.
        simulationRef.current = (d3.forceSimulation() as d3.Simulation<NodeType, SimulationLink>)
            .force("link", (d3.forceLink() as d3.ForceLink<NodeType, SimulationLink>).id(d => d.id).distance(isDirected ? 70 : 50));
    }
    const simulation = simulationRef.current;

    // --- Layout-specific forces ---
    // FIX: Use type casting for D3 force functions.
    simulation.force("collide", (d3.forceCollide() as d3.ForceCollide<NodeType>).radius(d => getNodeRadius(d) + 2).strength(0.8));

    if (layout === Layout.CIRCULAR) {
        simulation.force("charge", null);
        simulation.force("center", null);
        simulation.force("x", null);
        simulation.force("y", null);
        // Fix: Use type casting for d3.forceLink to resolve "Untyped function calls may not accept type arguments" error.
        (simulation.force("link") as d3.ForceLink<NodeType, SimulationLink>)?.strength(0.1);

        const radius = Math.min(width, height) / 2.5;
        const angleStep = (2 * Math.PI) / nodes.length;
        
        const sortedNodes = [...nodes].sort((a, b) => {
            const commA = a.community ?? Infinity;
            const commB = b.community ?? Infinity;
            if (commA !== commB) return commA - commB;
            return a.id.localeCompare(b.id, undefined, { numeric: true });
        });

        sortedNodes.forEach((node, i) => {
            const originalNode = nodes.find(n => n.id === node.id);
            if (originalNode) {
                originalNode.fx = width / 2 + radius * Math.cos(angleStep * i);
                originalNode.fy = height / 2 + radius * Math.sin(angleStep * i);
            }
        });

    } else { // Force-directed
        // FIX: Use type casting for D3 force functions.
        simulation.force("charge", (d3.forceManyBody() as d3.ForceManyBody<NodeType>).strength(-100));
        simulation.force("center", (d3.forceCenter(width / 2, height / 2) as d3.ForceCenter<NodeType>).strength(0.05));
        // Fix: Use type casting for d3.forceLink to resolve "Untyped function calls may not accept type arguments" error.
        (simulation.force("link") as d3.ForceLink<NodeType, SimulationLink>)?.strength(1);
        
        // By setting strength to 0 instead of removing the force, D3 can create a smooth
        // transition when the 'groupCommunities' toggle is flipped. The simulation will
        // animate the nodes to their new equilibrium positions based on the updated force strength.
        const clusteringStrength = groupCommunities ? 0.1 : 0;
        simulation
            .force("x", (d3.forceX(getClusterX) as d3.ForceX<NodeType>).strength(clusteringStrength))
            .force("y", (d3.forceY(getClusterY) as d3.ForceY<NodeType>).strength(clusteringStrength));
    }

    // --- Tooltip Positioning Logic ---
    const showTooltip = (content: string, x: number, y: number, offset: number = 0) => {
      const transform = d3.zoomTransform(svg.node()!);
      const [screenX, screenY] = transform.apply([x, y]);

      tooltip.html(content).style('opacity', 1);

      const tooltipNode = tooltip.node();
      if (!tooltipNode) return;

      const tooltipWidth = tooltipNode.offsetWidth;
      const tooltipHeight = tooltipNode.offsetHeight;
      const margin = 12;

      let top = screenY - tooltipHeight - offset - margin;
      let left = screenX - tooltipWidth / 2;

      tooltip.classed('tooltip-bottom', false);
      if (top < 10) { // If it goes off the top edge
          top = screenY + offset + margin;
          tooltip.classed('tooltip-bottom', true);
      }
      
      // Prevent going off left/right edges
      if (left < 10) left = 10;
      if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
      }

      tooltip.style('left', `${left}px`)
             .style('top', `${top}px`);
    };

    // --- Tooltip Handlers for Nodes and Links ---
    const handleNodeMouseOver = (event: MouseEvent, d: NodeType) => {
        let content = `<div class="font-bold text-base mb-1 text-cyan-400">节点 ID: ${d.id}</div>`;
        const details: string[] = [];
        if (d.community !== undefined) {
          details.push(`检测到的社区: <span class="font-semibold">${d.community}</span>`);
        }
        if (d.groundTruthCommunity !== undefined) {
          details.push(`真实社群: <span class="font-semibold">${d.groundTruthCommunity}</span>`);
        }
        if (d.isMisclassified) {
          details.push(`<span class="text-yellow-400 font-semibold">分类错误</span>`);
        }
        if (details.length > 0) {
            content += `<div class="text-xs text-gray-300 space-y-1">${details.join('<br>')}</div>`;
        }

        if (d.attributes) {
            const attributeEntries = Object.entries(d.attributes);
            if (attributeEntries.length > 0) {
                content += `<hr class="border-gray-600/50 my-2">`;
                content += `<div class="font-semibold mb-1 text-gray-200">属性</div>`;
                content += `<ul class="list-none p-0 text-xs space-y-1">`;
                for (const [key, value] of attributeEntries) {
                     content += `<li class="flex justify-between items-center"><span class="text-gray-400 mr-4">${key}:</span><span class="font-mono font-semibold text-cyan-300">${typeof value === 'number' ? value.toFixed(4) : value}</span></li>`;
                }
                content += `</ul>`;
            }
        }
        
        showTooltip(content, d.x ?? 0, d.y ?? 0, getNodeRadius(d) * 1.2); // Use scaled radius
    };

    const handleLinkMouseOver = (event: MouseEvent, d: SimulationLink) => {
        const sourceNode = d.source as NodeType;
        const targetNode = d.target as NodeType;

        let content = `<div class="font-bold text-base mb-1 text-cyan-400">链接</div>`;
        content += `<div class="text-xs text-gray-300 space-y-1">`;
        content += `<div><strong>源节点:</strong> <span class="font-mono font-semibold">${sourceNode.id}</span></div>`;
        content += `<div><strong>目标节点:</strong> <span class="font-mono font-semibold">${targetNode.id}</span></div>`;
        content += `</div>`;
        
        const midX = ((sourceNode.x ?? 0) + (targetNode.x ?? 0)) / 2;
        const midY = ((sourceNode.y ?? 0) + (targetNode.y ?? 0)) / 2;
        
        showTooltip(content, midX, midY);
    };
    
    const handleMouseOut = () => {
        tooltip.style('opacity', 0);
    };

    const link = container
      .append("g")
      .attr("stroke-opacity", 0.6)
      .selectAll("g")
      .data(links as unknown as SimulationLink[])
      .join("g")
      .style('cursor', activeTool === 'delete' ? 'pointer' : 'default')
      .on('click', (event, d) => {
          if (activeTool === 'delete') {
            event.stopPropagation(); // Prevent canvas click
            // Reconstruct original link since d3 replaces strings with objects
            const originalLink: LinkType = {
              source: (d.source as NodeType).id,
              target: (d.target as NodeType).id,
            };
            onLinkClick(originalLink);
          }
      })
      .on('mouseover', function(event, d) {
        if (activeTool === 'delete') {
            d3.select(this).select('line').attr('stroke', deleteHoverColor);
        } else if (!activeTool) {
            handleLinkMouseOver(event, d);
        }
      })
      .on('mouseout', function() {
        if (activeTool === 'delete') {
            d3.select(this).select('line').attr('stroke', linkColor);
        } else if (!activeTool) {
            handleMouseOut();
        }
      });
      
    link.append("line")
      .attr("stroke", linkColor)
      .attr("stroke-width", 2)
      .attr('marker-end', isDirected ? 'url(#arrowhead)' : null);
      
    const node = container
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .on("click", (event, d) => {
          if (event.defaultPrevented) return; // Ignore clicks that are part of a drag gesture
          event.stopPropagation(); // Prevent canvas click
          handleMouseOut(); // Hide tooltip on click for a cleaner selection experience
          onNodeClick(d);
      })
      .on('mouseover', function(event, d) {
        if (activeTool === 'delete') {
            d3.select(this).select('circle').attr('fill', deleteHoverColor);
        } else if (activeTool === null || activeTool === 'select') {
            // --- Hover Effect ---
            d3.select(this).raise(); // Bring node to front
            d3.select(this).select('circle')
              .transition()
              .duration(150)
              .attr('r', getNodeRadius(d) * 1.2)
              .attr('stroke', nodeHoverStrokeColor)
              .attr('stroke-width', 2.5);

            // --- Tooltip Logic ---
            handleNodeMouseOver(event, d);
        }
      })
      .on('mouseout', function(event, d) {
         if (activeTool === 'delete') {
            d3.select(this).select('circle').attr('fill', getNodeColor(d));
         } else if (activeTool === null || activeTool === 'select') {
            // --- Revert Hover Effect ---
            d3.select(this).select('circle')
              .transition()
              .duration(150)
              .attr('r', d.id === highlightedNodeId ? getNodeRadius(d) * 1.2 : getNodeRadius(d)) // Respect highlight state
              .attr('stroke', (d: NodeType) => { // Re-apply original stroke logic
                  if (hoveredPredictedLink && (d.id === hoveredPredictedLink.source || d.id === hoveredPredictedLink.target)) return predictedLinkHoverStrokeColor;
                  if (d.id === linkSourceNodeId) return linkSourceStrokeColor;
                  if (d.isMisclassified) return '#facc15'; // yellow-400
                  return nodeStrokeColor;
              })
              .attr('stroke-width', (d: NodeType) => { // Re-apply original stroke width
                  if (hoveredPredictedLink && (d.id === hoveredPredictedLink.source || d.id === hoveredPredictedLink.target)) return 4;
                  if (d.isMisclassified || d.id === linkSourceNodeId) return 3;
                  return 1.5;
              });

            // --- Tooltip Logic ---
            handleMouseOut();
         }
      })
      .call(dragHandler(simulation));

    node.style("cursor", () => {
        switch(activeTool) {
            case 'addLink': return 'cell';
            case 'delete': return 'pointer';
            case 'select': return 'grab';
            default: return 'pointer';
        }
    });

    const circles = node.append("circle")
      .attr("r", getNodeRadius)
      .attr("fill", getNodeColor)
      .attr("stroke", d => {
          if (hoveredPredictedLink && (d.id === hoveredPredictedLink.source || d.id === hoveredPredictedLink.target)) return predictedLinkHoverStrokeColor;
          if (d.id === linkSourceNodeId) return linkSourceStrokeColor;
          if (d.isMisclassified) return '#facc15';
          return nodeStrokeColor;
      })
      .attr("stroke-width", d => {
          if (hoveredPredictedLink && (d.id === hoveredPredictedLink.source || d.id === hoveredPredictedLink.target)) return 4;
          if (d.isMisclassified || d.id === linkSourceNodeId) return 3;
          return 1.5;
      });
      
    const labels = node.append("text")
        .text(d => d.id)
        .attr('x', d => getNodeRadius(d) + 4)
        .attr('y', 4)
        .attr('fill', labelColor)
        .style('font-size', '12px')
        .style('display', showNodeLabels ? 'block' : 'none');

    simulation.nodes(nodes);
    // Fix: Cast links to the compatible type for the simulation force.
    // Fix: Use type casting for d3.forceLink to resolve "Untyped function calls may not accept type arguments" error.
    (simulation.force("link") as d3.ForceLink<NodeType, SimulationLink>)?.links(links as unknown as SimulationLink[]);

    const ticked = () => {
      link.selectAll("line")
        .attr("x1", d => (d.source as NodeType).x || 0)
        .attr("y1", d => (d.source as NodeType).y || 0)
        .attr("x2", d => {
            const targetNode = d.target as NodeType;
            if (!isDirected) return targetNode.x || 0;
            
            const sourceNode = d.source as NodeType;
            const dx = (targetNode.x || 0) - (sourceNode.x || 0);
            const dy = (targetNode.y || 0) - (sourceNode.y || 0);
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist === 0) return targetNode.x || 0;
            
            const targetRadius = getNodeRadius(targetNode);
            // Shorten the line by the radius of the target node plus a small gap for the arrowhead
            const offsetX = (dx / dist) * (targetRadius + 5);
            return (targetNode.x || 0) - offsetX;
        })
        .attr("y2", d => {
            const targetNode = d.target as NodeType;
            if (!isDirected) return targetNode.y || 0;

            const sourceNode = d.source as NodeType;
            const dx = (targetNode.x || 0) - (sourceNode.x || 0);
            const dy = (targetNode.y || 0) - (sourceNode.y || 0);
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist === 0) return targetNode.y || 0;

            const targetRadius = getNodeRadius(targetNode);
            const offsetY = (dy / dist) * (targetRadius + 5);
            return (targetNode.y || 0) - offsetY;
        });

      node.attr("transform", d => `translate(${d.x || 0},${d.y || 0})`);
    };

    simulation.on("tick", ticked);
    
    // --- Highlighting Logic ---
    const isHighlighting = !!highlightedNodeId;
    
    const adj = new Map<string, Set<string>>();
    nodes.forEach(n => adj.set(n.id, new Set()));
    links.forEach(l => {
      const sourceId = typeof l.source === 'object' ? (l.source as NodeType).id : l.source as string;
      const targetId = typeof l.target === 'object' ? (l.target as NodeType).id : l.target as string;
      adj.get(sourceId)?.add(targetId);
      adj.get(targetId)?.add(sourceId);
    });
    const neighbors = isHighlighting ? adj.get(highlightedNodeId) ?? new Set() : new Set();
    
    node.select('circle').transition().duration(300)
      .attr('r', d => {
        const baseRadius = getNodeRadius(d);
        if (d.id === highlightedNodeId) return baseRadius * 1.2;
        return baseRadius;
      });

    node.transition().duration(300)
      .style('opacity', d => {
        if (!isHighlighting) return 1.0;
        return d.id === highlightedNodeId || neighbors.has(d.id) ? 1.0 : 0.15;
      });

    link.transition().duration(300)
      .style('opacity', d => {
        if (!isHighlighting) return 0.6;
        const sourceId = typeof d.source === 'object' ? (d.source as NodeType).id : d.source as string;
        const targetId = typeof d.target === 'object' ? (d.target as NodeType).id : d.target as string;
        const isConnected = (sourceId === highlightedNodeId && neighbors.has(targetId)) ||
                            (targetId === highlightedNodeId && neighbors.has(sourceId));
        return isConnected ? 1.0 : 0.1;
      });

    simulation.alpha(1).restart();
    
    // Zoom functionality
    if (!zoomRef.current) {
        zoomRef.current = (d3.zoom() as d3.ZoomBehavior<SVGSVGElement, unknown>).on('zoom', (event) => {
            container.attr('transform', event.transform);
        });
    }

    // When the resetZoomKey changes, it signifies a new graph has been loaded.
    // We must reset the zoom and pan to the default identity transform to ensure
    // the new graph is centered and fully visible, and that coordinate systems align
    // for actions like adding new nodes.
    if (isNewGraph) {
        // The call to .transform() programmatically triggers a zoom event,
        // so we don't need to manually set the container's transform attribute.
        svg.call(zoomRef.current.transform, d3.zoomIdentity);
        lastResetKey.current = resetZoomKey;
    }

    svg.call(zoomRef.current);
    // Disable zoom when a tool is active, except for 'select'
    zoomRef.current.on('zoom', activeTool && activeTool !== 'select' ? null : (event) => {
         container.attr('transform', event.transform);
    });

    // Canvas click for adding nodes or clearing selections
    svg.on('click', (event) => {
        if (event.target !== svg.node()) return; // Ensure click is on the background
        if (activeTool === 'addNode') {
            const transform = d3.zoomTransform(svg.node()!);
            const [x, y] = transform.invert(d3.pointer(event));
            onCanvasClick(x, y);
        } else {
            onBackgroundClick();
        }
    });

    // Drag functionality
    // Fix: Use the correct SimulationLink type for the simulation parameter.
    function dragHandler(simulation: d3.Simulation<NodeType, SimulationLink>) {
      function dragstarted(event: d3.D3DragEvent<SVGGElement, NodeType, NodeType>, d: NodeType) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      function dragged(event: d3.D3DragEvent<SVGGElement, NodeType, NodeType>, d: NodeType) {
        d.fx = event.x;
        d.fy = event.y;
      }
      function dragended(event: d3.D3DragEvent<SVGGElement, NodeType, NodeType>, d: NodeType) {
        if (!event.active) simulation.alphaTarget(0);
        // Only unpin if not in an active editing session and not in circular layout.
        // This allows user-defined positions to be saved during editing.
        if (activeTool === null && layout !== Layout.CIRCULAR) {
            d.fx = null;
            d.fy = null;
        }
      }
      const dragBehavior = (d3.drag() as d3.DragBehavior<SVGGElement, NodeType, NodeType>)
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
        
      // Only enable drag for 'select' tool in edit mode, or always if not in edit mode.
      return (g: any) => g.call(activeTool === null || activeTool === 'select' ? dragBehavior : () => {});
    }
    
    return () => {
      simulation.stop();
      svg.on('click', null); // Clean up canvas click listener
    };

  }, [graphData, scaleNodeSizeByDegree, showNodeLabels, groupCommunities, onNodeClick, onLinkClick, onCanvasClick, onBackgroundClick, layout, theme, colorizationMode, activeTool, linkSourceNodeId, resetZoomKey, isDirected, highlightedNodeId, hoveredPredictedLink]);
  
  const getCursor = () => {
    switch (activeTool) {
        case 'addNode': return 'cursor-crosshair';
        case 'addLink': return 'cursor-cell';
        case 'delete': return 'cursor-pointer'; // Will be overridden on elements
        case 'select': return 'cursor-grab';
        default: return 'cursor-default';
    }
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
        <svg ref={svgRef} className={`w-full h-full min-h-0 ${getCursor()}`}></svg>
        <div 
            id="graph-tooltip"
            className="absolute opacity-0 pointer-events-none bg-gray-900/90 dark:bg-black/80 backdrop-blur-sm text-white text-sm rounded-lg p-3 shadow-2xl transition-opacity duration-200 max-w-xs z-50 border border-gray-700 dark:border-gray-900"
        >
        </div>
    </div>
  );
};

export default GraphVisualizer;