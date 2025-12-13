import type {
  AddNodeArgs,
  AiSpreadsheetEdge,
  AiSpreadsheetNode,
  AiSpreadsheetNodeData,
  ChatMessage,
  ConnectNodesArgs,
  NodeCategory,
  RemoveNodeArgs,
  UpdateNodeArgs,
} from '@/aiSpreadsheet/types';
import { atom, selector, DefaultValue } from 'recoil';
import { v4 as uuidv4 } from 'uuid';

// Default positions for auto-layout
const COLUMN_SPACING = 350;
const ROW_SPACING = 80;
const INITIAL_X = 50;
const INITIAL_Y = 50;

export interface AiSpreadsheetState {
  nodes: AiSpreadsheetNode[];
  edges: AiSpreadsheetEdge[];
  selectedNodeId: string | null;
  chatMessages: ChatMessage[];
  loading: boolean;
  teamUuid: string;
  // Streaming state
  streamingContent: string;
  streamingToolCalls: { id: string; name: string; arguments: string; processed?: boolean }[];
}

export const defaultAiSpreadsheetState: AiSpreadsheetState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  chatMessages: [],
  loading: false,
  teamUuid: '',
  streamingContent: '',
  streamingToolCalls: [],
};

export const aiSpreadsheetAtom = atom<AiSpreadsheetState>({
  key: 'aiSpreadsheetAtom',
  default: defaultAiSpreadsheetState,
});

// Selectors for individual state pieces
export const aiSpreadsheetNodesAtom = selector<AiSpreadsheetNode[]>({
  key: 'aiSpreadsheetNodesAtom',
  get: ({ get }) => get(aiSpreadsheetAtom).nodes,
  set: ({ set }, newValue) => {
    set(aiSpreadsheetAtom, (prev) => ({
      ...prev,
      nodes: newValue instanceof DefaultValue ? prev.nodes : newValue,
    }));
  },
});

export const aiSpreadsheetEdgesAtom = selector<AiSpreadsheetEdge[]>({
  key: 'aiSpreadsheetEdgesAtom',
  get: ({ get }) => get(aiSpreadsheetAtom).edges,
  set: ({ set }, newValue) => {
    set(aiSpreadsheetAtom, (prev) => ({
      ...prev,
      edges: newValue instanceof DefaultValue ? prev.edges : newValue,
    }));
  },
});

export const aiSpreadsheetSelectedNodeIdAtom = selector<string | null>({
  key: 'aiSpreadsheetSelectedNodeIdAtom',
  get: ({ get }) => get(aiSpreadsheetAtom).selectedNodeId,
  set: ({ set }, newValue) => {
    set(aiSpreadsheetAtom, (prev) => ({
      ...prev,
      selectedNodeId: newValue instanceof DefaultValue ? null : newValue,
    }));
  },
});

export const aiSpreadsheetSelectedNodeAtom = selector<AiSpreadsheetNode | null>({
  key: 'aiSpreadsheetSelectedNodeAtom',
  get: ({ get }) => {
    const state = get(aiSpreadsheetAtom);
    if (!state.selectedNodeId) return null;
    return state.nodes.find((n) => n.id === state.selectedNodeId) ?? null;
  },
});

export const aiSpreadsheetChatMessagesAtom = selector<ChatMessage[]>({
  key: 'aiSpreadsheetChatMessagesAtom',
  get: ({ get }) => get(aiSpreadsheetAtom).chatMessages,
  set: ({ set }, newValue) => {
    set(aiSpreadsheetAtom, (prev) => ({
      ...prev,
      chatMessages: newValue instanceof DefaultValue ? prev.chatMessages : newValue,
    }));
  },
});

export const aiSpreadsheetLoadingAtom = selector<boolean>({
  key: 'aiSpreadsheetLoadingAtom',
  get: ({ get }) => get(aiSpreadsheetAtom).loading,
  set: ({ set }, newValue) => {
    set(aiSpreadsheetAtom, (prev) => ({
      ...prev,
      loading: newValue instanceof DefaultValue ? prev.loading : newValue,
    }));
  },
});

export const aiSpreadsheetTeamUuidAtom = selector<string>({
  key: 'aiSpreadsheetTeamUuidAtom',
  get: ({ get }) => get(aiSpreadsheetAtom).teamUuid,
  set: ({ set }, newValue) => {
    set(aiSpreadsheetAtom, (prev) => ({
      ...prev,
      teamUuid: newValue instanceof DefaultValue ? prev.teamUuid : newValue,
    }));
  },
});

export const aiSpreadsheetStreamingContentAtom = selector<string>({
  key: 'aiSpreadsheetStreamingContentAtom',
  get: ({ get }) => get(aiSpreadsheetAtom).streamingContent,
});

export const aiSpreadsheetStreamingToolCallsAtom = selector<{ id: string; name: string; arguments: string }[]>({
  key: 'aiSpreadsheetStreamingToolCallsAtom',
  get: ({ get }) => get(aiSpreadsheetAtom).streamingToolCalls,
});

// Helper to calculate position based on category
function getPositionForCategory(category: NodeCategory, existingNodes: AiSpreadsheetNode[]): { x: number; y: number } {
  const categoryColumn: Record<NodeCategory, number> = {
    input: 0,
    transform: 1,
    output: 2,
  };

  const nodesInColumn = existingNodes.filter((n) => n.data.category === category);
  const column = categoryColumn[category];

  return {
    x: INITIAL_X + column * COLUMN_SPACING,
    y: INITIAL_Y + nodesInColumn.length * ROW_SPACING,
  };
}

// Action to add a node
export function addNode(
  currentState: AiSpreadsheetState,
  args: AddNodeArgs
): { nodes: AiSpreadsheetNode[]; newNodeId: string } {
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
  const nodePosition = position ?? getPositionForCategory(category, currentState.nodes);

  // Use special type for dataTable inputs (different component)
  const reactFlowType = nodeType === 'dataTable' ? 'dataTableInput' : category;

  const newNode: AiSpreadsheetNode = {
    id: nodeId,
    type: reactFlowType, // This maps to our custom node components
    position: nodePosition,
    data: {
      label,
      category,
      nodeType,
      createdBy: 'ai',
      ...data,
    } as AiSpreadsheetNodeData,
  };

  return {
    nodes: [...currentState.nodes, newNode],
    newNodeId: nodeId,
  };
}

// Action to remove a node
export function removeNode(currentState: AiSpreadsheetState, args: RemoveNodeArgs): AiSpreadsheetState {
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
  currentState: AiSpreadsheetState,
  args: ConnectNodesArgs
): { edges: AiSpreadsheetEdge[]; newEdgeId: string } {
  const { sourceNodeId, targetNodeId, label } = args;

  // Check if edge already exists
  const existingEdge = currentState.edges.find((e) => e.source === sourceNodeId && e.target === targetNodeId);
  if (existingEdge) {
    return { edges: currentState.edges, newEdgeId: existingEdge.id };
  }

  const edgeId = uuidv4();
  const newEdge: AiSpreadsheetEdge = {
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
export function updateNode(currentState: AiSpreadsheetState, args: UpdateNodeArgs): AiSpreadsheetNode[] {
  const { nodeId, updates } = args;
  return currentState.nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        data: {
          ...node.data,
          ...updates,
        } as AiSpreadsheetNodeData,
      };
    }
    return node;
  });
}

// Action to add a chat message
export function addChatMessage(
  currentState: AiSpreadsheetState,
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
export function clearCanvas(): Partial<AiSpreadsheetState> {
  return {
    nodes: [],
    edges: [],
    selectedNodeId: null,
  };
}
