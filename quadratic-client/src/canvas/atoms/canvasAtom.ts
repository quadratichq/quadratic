import type {
  AddNodeArgs,
  CanvasEdge,
  CanvasNode,
  CanvasNodeData,
  ChatMessage,
  ConnectNodesArgs,
  NodeCategory,
  RemoveNodeArgs,
  UpdateNodeArgs,
} from '@/canvas/types';
import { atom, selector, DefaultValue } from 'recoil';
import { v4 as uuidv4 } from 'uuid';

// Default positions for auto-layout
const COLUMN_SPACING = 400;
const INITIAL_X = 50;
const INITIAL_Y = 50;
const NODE_PADDING = 20; // Vertical padding between nodes

// Estimated heights for different node types (used for auto-layout)
const NODE_HEIGHT_ESTIMATES: Record<string, number> = {
  // Input nodes
  cell: 80,
  connection: 100,
  file: 80,
  webSearch: 80,
  html: 100,
  dataTable: 220, // Has table with max-height 200px + header
  // Transform nodes
  code: 280, // Header + description/code preview + result area
  formula: 120,
  // Output nodes
  table: 200,
  chart: 250,
  htmlOutput: 200,
};

export interface CanvasState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  selectedNodeId: string | null;
  chatMessages: ChatMessage[];
  loading: boolean;
  teamUuid: string;
  // Streaming state
  streamingContent: string;
  streamingToolCalls: { id: string; name: string; arguments: string; processed?: boolean }[];
}

export const defaultCanvasState: CanvasState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  chatMessages: [],
  loading: false,
  teamUuid: '',
  streamingContent: '',
  streamingToolCalls: [],
};

export const canvasAtom = atom<CanvasState>({
  key: 'canvasAtom',
  default: defaultCanvasState,
});

// Selectors for individual state pieces
export const canvasNodesAtom = selector<CanvasNode[]>({
  key: 'canvasNodesAtom',
  get: ({ get }) => get(canvasAtom).nodes,
  set: ({ set }, newValue) => {
    set(canvasAtom, (prev) => ({
      ...prev,
      nodes: newValue instanceof DefaultValue ? prev.nodes : newValue,
    }));
  },
});

export const canvasEdgesAtom = selector<CanvasEdge[]>({
  key: 'canvasEdgesAtom',
  get: ({ get }) => get(canvasAtom).edges,
  set: ({ set }, newValue) => {
    set(canvasAtom, (prev) => ({
      ...prev,
      edges: newValue instanceof DefaultValue ? prev.edges : newValue,
    }));
  },
});

export const canvasSelectedNodeIdAtom = selector<string | null>({
  key: 'canvasSelectedNodeIdAtom',
  get: ({ get }) => get(canvasAtom).selectedNodeId,
  set: ({ set }, newValue) => {
    set(canvasAtom, (prev) => ({
      ...prev,
      selectedNodeId: newValue instanceof DefaultValue ? null : newValue,
    }));
  },
});

export const canvasSelectedNodeAtom = selector<CanvasNode | null>({
  key: 'canvasSelectedNodeAtom',
  get: ({ get }) => {
    const state = get(canvasAtom);
    if (!state.selectedNodeId) return null;
    return state.nodes.find((n) => n.id === state.selectedNodeId) ?? null;
  },
});

export const canvasChatMessagesAtom = selector<ChatMessage[]>({
  key: 'canvasChatMessagesAtom',
  get: ({ get }) => get(canvasAtom).chatMessages,
  set: ({ set }, newValue) => {
    set(canvasAtom, (prev) => ({
      ...prev,
      chatMessages: newValue instanceof DefaultValue ? prev.chatMessages : newValue,
    }));
  },
});

export const canvasLoadingAtom = selector<boolean>({
  key: 'canvasLoadingAtom',
  get: ({ get }) => get(canvasAtom).loading,
  set: ({ set }, newValue) => {
    set(canvasAtom, (prev) => ({
      ...prev,
      loading: newValue instanceof DefaultValue ? prev.loading : newValue,
    }));
  },
});

export const canvasTeamUuidAtom = selector<string>({
  key: 'canvasTeamUuidAtom',
  get: ({ get }) => get(canvasAtom).teamUuid,
  set: ({ set }, newValue) => {
    set(canvasAtom, (prev) => ({
      ...prev,
      teamUuid: newValue instanceof DefaultValue ? prev.teamUuid : newValue,
    }));
  },
});

export const canvasStreamingContentAtom = selector<string>({
  key: 'canvasStreamingContentAtom',
  get: ({ get }) => get(canvasAtom).streamingContent,
});

export const canvasStreamingToolCallsAtom = selector<{ id: string; name: string; arguments: string }[]>({
  key: 'canvasStreamingToolCallsAtom',
  get: ({ get }) => get(canvasAtom).streamingToolCalls,
});

// Get estimated height for a node based on its type
function getNodeHeight(node: CanvasNode): number {
  const nodeType = node.data.nodeType;
  return NODE_HEIGHT_ESTIMATES[nodeType] || 120;
}

// Helper to calculate position based on category, avoiding overlaps
function getPositionForCategory(
  category: NodeCategory,
  existingNodes: CanvasNode[],
  nodeType?: string
): { x: number; y: number } {
  const categoryColumn: Record<NodeCategory, number> = {
    input: 0,
    transform: 1,
    output: 2,
  };

  const column = categoryColumn[category];
  const columnX = INITIAL_X + column * COLUMN_SPACING;

  // Get all nodes in this column
  const nodesInColumn = existingNodes.filter((n) => n.data.category === category);

  if (nodesInColumn.length === 0) {
    return { x: columnX, y: INITIAL_Y };
  }

  // Sort nodes by y position to find the bottom-most position
  const sortedNodes = [...nodesInColumn].sort((a, b) => a.position.y - b.position.y);

  // Find the next y position after the last node (accounting for its height)
  let nextY = INITIAL_Y;
  for (const node of sortedNodes) {
    const nodeBottom = node.position.y + getNodeHeight(node) + NODE_PADDING;
    if (nodeBottom > nextY) {
      nextY = nodeBottom;
    }
  }

  return { x: columnX, y: nextY };
}

// Action to add a node
export function addNode(currentState: CanvasState, args: AddNodeArgs): { nodes: CanvasNode[]; newNodeId: string } {
  const { nodeType, label, data, position } = args;

  // Determine category from node type
  let category: NodeCategory;
  if (['connection', 'file', 'cell', 'dataTable', 'webSearch', 'html'].includes(nodeType)) {
    category = 'input';
  } else if (['formula', 'code'].includes(nodeType)) {
    category = 'transform';
  } else {
    category = 'output';
  }

  const nodeId = uuidv4();
  const nodePosition = position ?? getPositionForCategory(category, currentState.nodes, nodeType);

  // Use special type for dataTable inputs (different component)
  const reactFlowType = nodeType === 'dataTable' ? 'dataTableInput' : category;

  const newNode: CanvasNode = {
    id: nodeId,
    type: reactFlowType, // This maps to our custom node components
    position: nodePosition,
    data: {
      label,
      category,
      nodeType,
      createdBy: 'ai',
      ...data,
    } as CanvasNodeData,
  };

  return {
    nodes: [...currentState.nodes, newNode],
    newNodeId: nodeId,
  };
}

// Action to remove a node
export function removeNode(currentState: CanvasState, args: RemoveNodeArgs): CanvasState {
  const { nodeId } = args;
  return {
    ...currentState,
    nodes: currentState.nodes.filter((n) => n.id !== nodeId),
    edges: currentState.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    selectedNodeId: currentState.selectedNodeId === nodeId ? null : currentState.selectedNodeId,
  };
}

// Action to connect nodes
export function connectNodes(
  currentState: CanvasState,
  args: ConnectNodesArgs
): { edges: CanvasEdge[]; newEdgeId: string } {
  const { sourceNodeId, targetNodeId, label } = args;

  // Check if edge already exists
  const existingEdge = currentState.edges.find((e) => e.source === sourceNodeId && e.target === targetNodeId);
  if (existingEdge) {
    return { edges: currentState.edges, newEdgeId: existingEdge.id };
  }

  const edgeId = uuidv4();
  const newEdge: CanvasEdge = {
    id: edgeId,
    source: sourceNodeId,
    target: targetNodeId,
    label,
    type: 'dependency',
    animated: true,
  };

  return {
    edges: [...currentState.edges, newEdge],
    newEdgeId: edgeId,
  };
}

// Action to update a node
export function updateNode(currentState: CanvasState, args: UpdateNodeArgs): CanvasNode[] {
  const { nodeId, updates } = args;
  return currentState.nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        data: {
          ...node.data,
          ...updates,
        } as CanvasNodeData,
      };
    }
    return node;
  });
}

// Action to update node positions (for drag and drop)
export function updateNodePositions(
  currentState: CanvasState,
  positionUpdates: { id: string; position: { x: number; y: number } }[]
): CanvasNode[] {
  const positionMap = new Map(positionUpdates.map((p) => [p.id, p.position]));
  return currentState.nodes.map((node) => {
    const newPosition = positionMap.get(node.id);
    if (newPosition) {
      return { ...node, position: newPosition };
    }
    return node;
  });
}

// Action to add a chat message
export function addChatMessage(
  currentState: CanvasState,
  message: Omit<ChatMessage, 'id' | 'timestamp'>
): ChatMessage[] {
  const newMessage: ChatMessage = {
    ...message,
    id: uuidv4(),
    timestamp: Date.now(),
  };
  return [...currentState.chatMessages, newMessage];
}

// Action to clear the canvas
export function clearCanvas(): Partial<CanvasState> {
  return {
    nodes: [],
    edges: [],
    selectedNodeId: null,
  };
}
