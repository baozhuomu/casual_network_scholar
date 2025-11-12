import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink } from '../types';
import { SearchIcon } from './icons/SearchIcon';
import { CenterIcon } from './icons/CenterIcon';

interface GraphPanelProps {
  graphData: GraphData;
}

type DisplayMode = 'all' | 'core';

const GraphPanel: React.FC<GraphPanelProps> = ({ graphData }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  const filteredData = useMemo(() => {
    if (displayMode === 'core') {
      const coreNodes = new Set(graphData.nodes.filter(n => n.isCore).map(n => n.id));
      const coreLinks = graphData.links.filter(l => {
          const sourceId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
          const targetId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
          return coreNodes.has(sourceId) && coreNodes.has(targetId);
      });
      return { nodes: graphData.nodes.filter(n => n.isCore), links: coreLinks };
    }
    return graphData;
  }, [graphData, displayMode]);

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!svgRef.current || !currentContainer || !filteredData.nodes.length) {
        if (svgRef.current) d3.select(svgRef.current).selectAll("*").remove();
        return;
    };

    const { width, height } = currentContainer.getBoundingClientRect();
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    const color = d3.scaleOrdinal(d3.schemeCategory10);
    
    const links: GraphLink[] = filteredData.links.map(d => ({...d}));
    const nodes: GraphNode[] = filteredData.nodes.map(d => ({...d}));

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05));
    
    simulationRef.current = simulation;

    svg.append('defs').selectAll('marker')
      .data(['end'])
      .enter().append('marker')
      .attr('id', String)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');

    const link = g.append("g")
      .attr("class", "links")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5)
      .attr('marker-end', 'url(#end)');

    const node = g.append("g")
      .attr("class", "nodes")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 10)
      .attr("fill", d => color(d.group))
      .call(drag(simulation) as any)
      .on('mouseover', (event, d) => setHoveredNode(d as GraphNode))
      .on('mouseout', () => setHoveredNode(null))
      .on('click', (event, d) => {
        setSelectedNode(selectedNode?.id === d.id ? null : d as GraphNode);
        event.stopPropagation();
      });

    const label = g.append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(nodes)
      .enter().append("text")
      .attr("text-anchor", "middle")
      .attr("dy", -15)
      .attr("fill", "currentColor")
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .text(d => d.id);

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      node.attr("cx", d => d.x!).attr("cy", d => d.y!);
      label.attr("x", d => d.x!).attr("y", d => d.y!);
    });
    
    const zoomHandler = d3.zoom<SVGSVGElement, unknown>()
        .extent([[0, 0], [width, height]])
        .scaleExtent([0.2, 5])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    svg.call(zoomHandler);
    zoomRef.current = zoomHandler;
    svg.on('click', () => setSelectedNode(null));

    const resizeObserver = new ResizeObserver(entries => {
        const entry = entries[0];
        const { width: newWidth, height: newHeight } = entry.contentRect;
        
        if (simulationRef.current) {
            simulationRef.current.force("center", d3.forceCenter(newWidth / 2, newHeight / 2));
            simulationRef.current.alpha(0.3).restart();
        }
        if (zoomRef.current) {
            zoomRef.current.extent([[0, 0], [newWidth, newHeight]]);
        }
    });

    resizeObserver.observe(currentContainer);

    return () => {
        resizeObserver.disconnect();
    };

  }, [filteredData]);
  
  useEffect(() => {
    if (!svgRef.current) return;
    const g = d3.select(svgRef.current).select('g');
    const nodes = g.selectAll<SVGCircleElement, GraphNode>('.nodes circle');
    const links = g.selectAll<SVGLineElement, GraphLink>('.links line');
    const labels = g.selectAll<SVGTextElement, GraphNode>('.labels text');

    if (selectedNode) {
      const adjacentNodeIds = new Set([selectedNode.id]);
      filteredData.links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
        if (sourceId === selectedNode.id) adjacentNodeIds.add(targetId);
        if (targetId === selectedNode.id) adjacentNodeIds.add(sourceId);
      });

      nodes.attr('opacity', d => adjacentNodeIds.has((d as GraphNode).id) ? 1 : 0.1);
      labels.attr('opacity', d => adjacentNodeIds.has((d as GraphNode).id) ? 1 : 0.1);
      links.attr('stroke-opacity', d => {
          const sourceId = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
          const targetId = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
          return (sourceId === selectedNode.id || targetId === selectedNode.id) ? 0.9 : 0.1
      });

    } else {
      nodes.attr('opacity', 1);
      labels.attr('opacity', 1);
      links.attr('stroke-opacity', 0.6);
    }
  }, [selectedNode, filteredData]);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm || !containerRef.current) return;
    const node = filteredData.nodes.find(n => n.id.toLowerCase().includes(searchTerm.toLowerCase()));

    if (node && svgRef.current && zoomRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const svg = d3.select(svgRef.current);
        const transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(1.5).translate(-(node.x || 0), -(node.y || 0));
        svg.transition().duration(750).call(zoomRef.current.transform, transform);
        setSelectedNode(node);
    }
  };

  const handleRecenter = () => {
    if (svgRef.current && zoomRef.current) {
        const svg = d3.select(svgRef.current);
        svg.transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };


  const drag = (simulation: d3.Simulation<GraphNode, undefined>) => {
    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event: any, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    return d3.drag<SVGCircleElement, GraphNode>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-full flex flex-col">
      <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">因果关系网络</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <form onSubmit={handleSearch} className="relative w-full sm:w-auto">
                <input 
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="搜索变量..."
                    className="pl-8 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 w-full"
                />
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                    <SearchIcon className="w-4 h-4 text-gray-400" />
                </div>
            </form>
            <div className="flex bg-gray-200 dark:bg-gray-700 rounded-md p-0.5">
                <button onClick={() => setDisplayMode('all')} className={`px-2 py-0.5 text-xs rounded ${displayMode === 'all' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>全量变量</button>
                <button onClick={() => setDisplayMode('core')} className={`px-2 py-0.5 text-xs rounded ${displayMode === 'core' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}>核心变量</button>
            </div>
             <button onClick={handleRecenter} className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="居中视图">
                <CenterIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-full flex-grow relative overflow-hidden">
        {filteredData.nodes.length > 0 ? (
          <svg ref={svgRef} className="w-full h-full"></svg>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <p>分析后将在此处显示图谱。</p>
          </div>
        )}
        {hoveredNode && !selectedNode && (
          <div className="absolute bottom-2 left-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-2 rounded-lg text-xs shadow-lg pointer-events-none">
            <p className="font-bold">{hoveredNode.id}</p>
            <p>分组: {hoveredNode.group}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphPanel;