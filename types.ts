// Fix: Import d3 to provide type definitions for d3 specific interfaces.
import * as d3 from 'd3';

export enum AppStep {
  Upload = "Upload",
  Extract = "Extract",
  Visualize = "Visualize",
  Generate = "Generate",
}

export interface Paper {
  id: string;
  name: string;
  status: 'parsing' | 'ready' | 'error' | 'ocr';
  content?: string;
  message?: string;
  progress?: number;
}

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  group: string;
  isCore: boolean;
  // Fix: Explicitly add d3 simulation properties to resolve TypeScript errors.
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

// Fix: Correct GraphLink to extend the base d3.SimulationLinkDatum interface. This ensures type compatibility
// with d3's force simulation and resolves ambiguous type errors during compilation, such as on Array.prototype.filter.
export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface TopicSuggestion {
  topic: string;
  hypothesis: string;
  innovationScore: number;
  feasibility: string;
}

export interface Concept {
  id: string;
  name: string;
  children: GraphNode[];
}
