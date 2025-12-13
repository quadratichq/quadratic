import type { Edge } from '@xyflow/react';

// Node categories
export type NodeCategory = 'input' | 'transform' | 'output';

// Input node types
export type InputNodeType = 'connection' | 'file' | 'cell' | 'dataTable' | 'webSearch' | 'html';

// Transform node types
export type TransformNodeType = 'formula' | 'code';

// Output node types
export type OutputNodeType = 'table' | 'chart' | 'htmlOutput';

// Combined node type
export type AiNodeType = InputNodeType | TransformNodeType | OutputNodeType;

// Base data for all nodes
export interface BaseNodeData {
  label: string;
  category: NodeCategory;
  nodeType: AiNodeType;
  createdBy: string; // 'ai' or 'user'
}

// Input node data types
export interface ConnectionNodeData extends BaseNodeData {
  category: 'input';
  nodeType: 'connection';
  connectionUuid: string;
  connectionName: string;
  connectionType: string;
  query?: string;
}

export interface FileNodeData extends BaseNodeData {
  category: 'input';
  nodeType: 'file';
  fileName: string;
  fileType: string;
  fileSize?: number;
}

export interface CellNodeData extends BaseNodeData {
  category: 'input';
  nodeType: 'cell';
  value: string;
}

export interface DataTableNodeData extends BaseNodeData {
  category: 'input';
  nodeType: 'dataTable';
  columns: string[];
  rows: string[][];
}

export interface WebSearchNodeData extends BaseNodeData {
  category: 'input';
  nodeType: 'webSearch';
  query: string;
  results?: string[];
}

export interface HtmlInputNodeData extends BaseNodeData {
  category: 'input';
  nodeType: 'html';
  htmlContent: string;
}

// Transform node data types
export interface FormulaNodeData extends BaseNodeData {
  category: 'transform';
  nodeType: 'formula';
  formula: string;
}

export interface CodeNodeData extends BaseNodeData {
  category: 'transform';
  nodeType: 'code';
  language: 'python' | 'javascript';
  code: string;
}

// Output node data types
export interface TableNodeData extends BaseNodeData {
  category: 'output';
  nodeType: 'table';
  columns: string[];
  rows: string[][];
  totalRows?: number;
}

export interface ChartNodeData extends BaseNodeData {
  category: 'output';
  nodeType: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'scatter';
  config?: Record<string, unknown>;
}

export interface HtmlOutputNodeData extends BaseNodeData {
  category: 'output';
  nodeType: 'htmlOutput';
  htmlContent: string;
}

// Union of all node data types
export type AiSpreadsheetNodeData =
  | ConnectionNodeData
  | FileNodeData
  | CellNodeData
  | DataTableNodeData
  | WebSearchNodeData
  | HtmlInputNodeData
  | FormulaNodeData
  | CodeNodeData
  | TableNodeData
  | ChartNodeData
  | HtmlOutputNodeData;

// React Flow node type (using a looser type to work with React Flow)
export interface AiSpreadsheetNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: AiSpreadsheetNodeData;
  selected?: boolean;
}

// Edge with optional label
export interface AiSpreadsheetEdge extends Edge {
  label?: string;
}

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
}

// AI tool types for modifying the canvas
export type AiToolName = 'add_node' | 'remove_node' | 'connect_nodes' | 'update_node';

export interface AddNodeArgs {
  nodeType: AiNodeType;
  label: string;
  data: Partial<AiSpreadsheetNodeData>;
  position?: { x: number; y: number };
}

export interface RemoveNodeArgs {
  nodeId: string;
}

export interface ConnectNodesArgs {
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
}

export interface UpdateNodeArgs {
  nodeId: string;
  updates: Partial<AiSpreadsheetNodeData>;
}
