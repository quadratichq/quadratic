import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid';
import type {
  AIAgent,
  AIAgentDefinition,
  AIMultiplayerChatMessage,
  AIMultiplayerEvent,
  AIMultiplayerSession,
  AIMultiplayerSessionConfig,
  AIMultiplayerSessionStatus,
} from 'quadratic-shared/ai/multiplayerSession';
import { atom, DefaultValue, selector } from 'recoil';

// ============================================================================
// State Interface
// ============================================================================

export interface AIMultiplayerSessionState {
  // Session state
  session: AIMultiplayerSession | null;

  // UI state
  showSetupModal: boolean;
  showControls: boolean;

  // Connection state
  isConnecting: boolean;
  connectionError: string | null;

  // Event stream
  eventSource: EventSource | null;
  lastEvent: AIMultiplayerEvent | null;

  // Chat messages with agent attribution
  messages: AIMultiplayerChatMessage[];

  // Pending agent definitions (before session starts)
  pendingAgents: AIAgentDefinition[];

  // Session config
  pendingConfig: Partial<AIMultiplayerSessionConfig>;
}

export const defaultAIMultiplayerSessionState: AIMultiplayerSessionState = {
  session: null,
  showSetupModal: false,
  showControls: false,
  isConnecting: false,
  connectionError: null,
  eventSource: null,
  lastEvent: null,
  messages: [],
  pendingAgents: [],
  pendingConfig: {},
};

// ============================================================================
// Main Atom
// ============================================================================

export const aiMultiplayerSessionAtom = atom<AIMultiplayerSessionState>({
  key: 'aiMultiplayerSessionAtom',
  default: defaultAIMultiplayerSessionState,
  effects: [
    ({ onSet }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) {
          return;
        }

        // Clean up event source when session ends
        if (oldValue.session && !newValue.session) {
          oldValue.eventSource?.close();
          focusGrid();
        }

        // Emit events for session state changes
        if (!oldValue.session && newValue.session) {
          events.emit('aiMultiplayerSessionStarted', newValue.session);
        }

        if (oldValue.session && !newValue.session) {
          events.emit('aiMultiplayerSessionEnded');
        }

        if (
          oldValue.session?.currentTurnAgentId !== newValue.session?.currentTurnAgentId &&
          newValue.session?.currentTurnAgentId
        ) {
          const agent = newValue.session.agents.find((a) => a.id === newValue.session?.currentTurnAgentId);
          if (agent) {
            events.emit('aiMultiplayerTurnChanged', agent);
          }
        }
      });
    },
  ],
});

// ============================================================================
// Selectors
// ============================================================================

// Session selectors
export const aiMultiplayerSessionSelector = selector<AIMultiplayerSession | null>({
  key: 'aiMultiplayerSessionSelector',
  get: ({ get }) => get(aiMultiplayerSessionAtom).session,
  set: ({ set }, newValue) => {
    set(aiMultiplayerSessionAtom, (prev) => ({
      ...prev,
      session: newValue instanceof DefaultValue ? prev.session : newValue,
    }));
  },
});

export const aiMultiplayerSessionActiveAtom = selector<boolean>({
  key: 'aiMultiplayerSessionActiveAtom',
  get: ({ get }) => {
    const session = get(aiMultiplayerSessionSelector);
    return session !== null && (session.status === 'running' || session.status === 'paused');
  },
});

export const aiMultiplayerSessionStatusAtom = selector<AIMultiplayerSessionStatus | null>({
  key: 'aiMultiplayerSessionStatusAtom',
  get: ({ get }) => get(aiMultiplayerSessionSelector)?.status ?? null,
});

// Agent selectors
export const aiMultiplayerAgentsAtom = selector<AIAgent[]>({
  key: 'aiMultiplayerAgentsAtom',
  get: ({ get }) => get(aiMultiplayerSessionSelector)?.agents ?? [],
});

export const aiMultiplayerCurrentTurnAgentAtom = selector<AIAgent | null>({
  key: 'aiMultiplayerCurrentTurnAgentAtom',
  get: ({ get }) => {
    const session = get(aiMultiplayerSessionSelector);
    if (!session?.currentTurnAgentId) return null;
    return session.agents.find((a) => a.id === session.currentTurnAgentId) ?? null;
  },
});

export const aiMultiplayerAgentByIdAtom = (agentId: string) =>
  selector<AIAgent | null>({
    key: `aiMultiplayerAgentByIdAtom-${agentId}`,
    get: ({ get }) => {
      const agents = get(aiMultiplayerAgentsAtom);
      return agents.find((a) => a.id === agentId) ?? null;
    },
  });

// UI selectors
export const aiMultiplayerShowSetupModalAtom = selector<boolean>({
  key: 'aiMultiplayerShowSetupModalAtom',
  get: ({ get }) => get(aiMultiplayerSessionAtom).showSetupModal,
  set: ({ set }, newValue) => {
    set(aiMultiplayerSessionAtom, (prev) => ({
      ...prev,
      showSetupModal: newValue instanceof DefaultValue ? prev.showSetupModal : newValue,
    }));
  },
});

export const aiMultiplayerShowControlsAtom = selector<boolean>({
  key: 'aiMultiplayerShowControlsAtom',
  get: ({ get }) => get(aiMultiplayerSessionAtom).showControls,
  set: ({ set }, newValue) => {
    set(aiMultiplayerSessionAtom, (prev) => ({
      ...prev,
      showControls: newValue instanceof DefaultValue ? prev.showControls : newValue,
    }));
  },
});

// Connection selectors
export const aiMultiplayerIsConnectingAtom = selector<boolean>({
  key: 'aiMultiplayerIsConnectingAtom',
  get: ({ get }) => get(aiMultiplayerSessionAtom).isConnecting,
});

export const aiMultiplayerConnectionErrorAtom = selector<string | null>({
  key: 'aiMultiplayerConnectionErrorAtom',
  get: ({ get }) => get(aiMultiplayerSessionAtom).connectionError,
});

// Messages selectors
export const aiMultiplayerMessagesAtom = selector<AIMultiplayerChatMessage[]>({
  key: 'aiMultiplayerMessagesAtom',
  get: ({ get }) => get(aiMultiplayerSessionAtom).messages,
  set: ({ set }, newValue) => {
    set(aiMultiplayerSessionAtom, (prev) => ({
      ...prev,
      messages: newValue instanceof DefaultValue ? prev.messages : newValue,
    }));
  },
});

// Pending agents (setup) selectors
export const aiMultiplayerPendingAgentsAtom = selector<AIAgentDefinition[]>({
  key: 'aiMultiplayerPendingAgentsAtom',
  get: ({ get }) => get(aiMultiplayerSessionAtom).pendingAgents,
  set: ({ set }, newValue) => {
    set(aiMultiplayerSessionAtom, (prev) => ({
      ...prev,
      pendingAgents: newValue instanceof DefaultValue ? prev.pendingAgents : newValue,
    }));
  },
});

export const aiMultiplayerPendingConfigAtom = selector<Partial<AIMultiplayerSessionConfig>>({
  key: 'aiMultiplayerPendingConfigAtom',
  get: ({ get }) => get(aiMultiplayerSessionAtom).pendingConfig,
  set: ({ set }, newValue) => {
    set(aiMultiplayerSessionAtom, (prev) => ({
      ...prev,
      pendingConfig: newValue instanceof DefaultValue ? prev.pendingConfig : newValue,
    }));
  },
});

// Turn tracking selectors
export const aiMultiplayerTurnNumberAtom = selector<number>({
  key: 'aiMultiplayerTurnNumberAtom',
  get: ({ get }) => get(aiMultiplayerSessionSelector)?.turnNumber ?? 0,
});

export const aiMultiplayerTurnHistoryAtom = selector<AIMultiplayerSession['turnHistory']>({
  key: 'aiMultiplayerTurnHistoryAtom',
  get: ({ get }) => get(aiMultiplayerSessionSelector)?.turnHistory ?? [],
});

// Events selector
export const aiMultiplayerLastEventAtom = selector<AIMultiplayerEvent | null>({
  key: 'aiMultiplayerLastEventAtom',
  get: ({ get }) => get(aiMultiplayerSessionAtom).lastEvent,
});

// ============================================================================
// Helper Functions for State Updates
// ============================================================================

export function updateAgentInSession(
  session: AIMultiplayerSession,
  agentId: string,
  updates: Partial<AIAgent>
): AIMultiplayerSession {
  return {
    ...session,
    agents: session.agents.map((agent) => (agent.id === agentId ? { ...agent, ...updates } : agent)),
    updatedAt: Date.now(),
  };
}

export function addMessageToSession(
  state: AIMultiplayerSessionState,
  message: AIMultiplayerChatMessage
): AIMultiplayerSessionState {
  return {
    ...state,
    messages: [...state.messages, message],
  };
}

export function updateSessionStatus(
  session: AIMultiplayerSession,
  status: AIMultiplayerSessionStatus
): AIMultiplayerSession {
  return {
    ...session,
    status,
    updatedAt: Date.now(),
    endedAt: status === 'ended' || status === 'completed' ? Date.now() : session.endedAt,
  };
}
