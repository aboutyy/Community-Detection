
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, Node as NodeType, Link as LinkType } from '../types';

interface GraphVisualizerProps {
  graphData: GraphData;
  scaleNodeSizeByDegree: boolean;
  showNodeLabels: boolean;
  groupCommunities: boolean;
  onNodeClick: (node: NodeType) => void;
}

// Fix: Define a type for links that is compatible with d3's simulation, which expects source and target to be nodes.
type SimulationLink = d3.SimulationLinkDatum<NodeType>;

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ graphData, scaleNodeSizeByDegree, showNodeLabels, groupCommunities, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Fix: Correctly type the simulation ref. The original LinkType was not compatible.
  // Fix: The `useRef` hook requires an initial value when a type argument is provided.
  const simulationRef = useRef<d3.Simulation<NodeType, SimulationLink> | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    // Fix: Directly use svgRef.current to get dimensions to avoid an error on svg.node().
    const width = svgRef.current.getBoundingClientRect().width || 800;
    const height = svgRef.current.getBoundingClientRect().height || 600;

    svg.selectAll("*").remove(); // Clear previous render

    const container = svg.append("g");
    
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const nodes: NodeType[] = JSON.parse(JSON.stringify(graphData.nodes));
    const links: LinkType[] = JSON.parse(JSON.stringify(graphData.links));

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
        // Fix: Use the correct SimulationLink type for the simulation and forces.
        simulationRef.current = d3.forceSimulation<NodeType, SimulationLink>()
            .force("link", d3.forceLink<NodeType, SimulationLink>().id(d => d.id).distance(50))
            .force("charge", d3.forceManyBody().strength(-100))
            .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05));
    }
    const simulation = simulationRef.current;
    
    // Add/Remove clustering forces based on toggle & add collision
    if (groupCommunities) {
        simulation
            .force("x", d3.forceX<NodeType>(getClusterX).strength(0.1))
            .force("y", d3.forceY<NodeType>(getClusterY).strength(0.1));
    } else {
        simulation.force("x", null);
        simulation.force("y", null);
    }
    
    simulation.force("collide", d3.forceCollide<NodeType>().radius(d => getNodeRadius(d) + 2).strength(0.8));


    const link = container
      .append("g")
      .attr("stroke", "#4b5563") // gray-600
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      // Fix: Cast links data to the simulation-compatible type.
      .data(links as unknown as SimulationLink[])
      .join("line")
      .attr("stroke-width", d => Math.sqrt(2));

    const node = container
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (event, d) => onNodeClick(d))
      .call(dragHandler(simulation));

    const circles = node.append("circle")
      .attr("r", getNodeRadius)
      .attr("fill", d => d.community !== undefined ? color(d.community.toString()) : "#6b7280") // gray-500
      .attr("stroke", d => d.isMisclassified ? '#facc15' : '#fff') // yellow-400 for misclassified
      .attr("stroke-width", d => d.isMisclassified ? 3 : 1.5);
      
    const labels = node.append("text")
        .text(d => d.id)
        .attr('x', d => getNodeRadius(d) + 4)
        .attr('y', 4)
        .attr('fill', '#d1d5db') // gray-300
        .style('font-size', '12px')
        .style('display', showNodeLabels ? 'block' : 'none');

    node.append("title")
        .text(d => {
            let text = `Node: ${d.id}\nDegree: ${degrees.get(d.id) ?? 0}`;
            text += `\nDetected Community: ${d.community ?? 'N/A'}`;
            if (d.groundTruthCommunity !== undefined) {
                text += `\nGround Truth Community: ${d.groundTruthCommunity}`;
            }
            if (d.isMisclassified) {
                text += `\n(Misclassified)`;
            }
            return text;
        });

    simulation.nodes(nodes);
    // Fix: Cast links to the compatible type for the simulation force.
    simulation.force<d3.ForceLink<NodeType, SimulationLink>>("link")?.links(links as unknown as SimulationLink[]);

    const ticked = () => {
      // Fix: Remove 'any' cast and use typesafe access to node positions.
      // After simulation starts, source/target are node objects with x/y properties.
      link
        .attr("x1", d => (d.source as NodeType).x || 0)
        .attr("y1", d => (d.source as NodeType).y || 0)
        .attr("x2", d => (d.target as NodeType).x || 0)
        .attr("y2", d => (d.target as NodeType).y || 0);

      node.attr("transform", d => `translate(${d.x || 0},${d.y || 0})`);
    };

    simulation.on("tick", ticked);
    simulation.alpha(1).restart();
    
    // Zoom functionality
    const zoom = d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
        container.attr('transform', event.transform);
    });
    svg.call(zoom);

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
        d.fx = null;
        d.fy = null;
      }
      // Fix: Specify the correct generic types for d3.drag to resolve the error.
      // The first argument is the DOM element type being dragged (SVGGElement), the
      // second is the datum type (NodeType), and the third is the subject type, which
      // must match the event handlers.
      return d3.drag<SVGGElement, NodeType, NodeType>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
    
    return () => {
      simulation.stop();
    };

  }, [graphData, scaleNodeSizeByDegree, showNodeLabels, groupCommunities, onNodeClick]);

  return <svg ref={svgRef} className="w-full h-full min-h-0"></svg>;
};

export default GraphVisualizer;
