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

// Fix: Redefine GraphLink to allow `source` and `target` to be either string IDs or resolved GraphNode objects,
// which is necessary before and after d3 simulation runs. This avoids a type conflict with the base d3.SimulationLinkDatum interface
// and resolves downstream compilation errors.
export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  index?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface TopicSuggestion {
  topic: string;
  hypothesis: string;
  innovation: string;
  feasibility: string;
}

export interface Concept {
  id: string;
  name: string;
  children: GraphNode[];
}