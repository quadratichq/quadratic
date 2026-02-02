import {
  aiMultiplayerMessagesAtom,
  aiMultiplayerPendingAgentsAtom,
  aiMultiplayerPendingConfigAtom,
  aiMultiplayerSessionAtom,
  aiMultiplayerSessionSelector,
  aiMultiplayerShowSetupModalAtom,
  defaultAIMultiplayerSessionState,
} from '@/app/atoms/aiMultiplayerSessionAtom';
import { editorInteractionStateFileUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { authClient } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import type {
  AIAgentDefinition,
  AIMultiplayerChatMessage,
  AIMultiplayerEvent,
  AIMultiplayerSession,
  AIMultiplayerSessionConfig,
  CreateAIMultiplayerSessionRequest,
  CreateAIMultiplayerSessionResponse,
} from 'quadratic-shared/ai/multiplayerSession';
import { useCallback } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

const API_BASE = '/v0/ai/multiplayer';

export function useAIMultiplayerSession() {
  const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
  const [state, setState] = useRecoilState(aiMultiplayerSessionAtom);
  const setSession = useSetRecoilState(aiMultiplayerSessionSelector);
  const setShowSetupModal = useSetRecoilState(aiMultiplayerShowSetupModalAtom);
  const setMessages = useSetRecoilState(aiMultiplayerMessagesAtom);
  const setPendingAgents = useSetRecoilState(aiMultiplayerPendingAgentsAtom);
  const setPendingConfig = useSetRecoilState(aiMultiplayerPendingConfigAtom);

  // ============================================================================
  // Session Setup
  // ============================================================================

  const openSetupModal = useCallback(() => {
    setShowSetupModal(true);
  }, [setShowSetupModal]);

  const closeSetupModal = useCallback(() => {
    setShowSetupModal(false);
    setPendingAgents([]);
    setPendingConfig({});
  }, [setShowSetupModal, setPendingAgents, setPendingConfig]);

  const addPendingAgent = useCallback(
    (agent: AIAgentDefinition) => {
      setPendingAgents((prev) => [...prev, agent]);
    },
    [setPendingAgents]
  );

  const removePendingAgent = useCallback(
    (index: number) => {
      setPendingAgents((prev) => prev.filter((_, i) => i !== index));
    },
    [setPendingAgents]
  );

  const updatePendingConfig = useCallback(
    (config: Partial<AIMultiplayerSessionConfig>) => {
      setPendingConfig((prev) => ({ ...prev, ...config }));
    },
    [setPendingConfig]
  );

  // ============================================================================
  // API Helpers
  // ============================================================================

  const getAuthHeaders = useCallback(async () => {
    const token = await authClient.getTokenOrRedirect();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  // ============================================================================
  // Session Management
  // ============================================================================

  const startSession = useRecoilCallback(
    ({ snapshot, set }) =>
      async (agents: AIAgentDefinition[], config?: Partial<AIMultiplayerSessionConfig>, initialPrompt?: string) => {
        const fileId = await snapshot.getPromise(editorInteractionStateFileUuidAtom);
        if (!fileId) {
          console.error('[AIMultiplayerSession] No file UUID available');
          return;
        }

        set(aiMultiplayerSessionAtom, (prev) => ({
          ...prev,
          isConnecting: true,
          connectionError: null,
        }));

        try {
          const headers = await getAuthHeaders();
          const body: CreateAIMultiplayerSessionRequest = {
            fileId,
            agents,
            config: config as AIMultiplayerSessionConfig | undefined,
            initialPrompt,
          };

          const response = await fetch(`${apiClient.getApiUrl()}${API_BASE}/session`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create session');
          }

          const data: CreateAIMultiplayerSessionResponse = await response.json();

          set(aiMultiplayerSessionAtom, (prev) => ({
            ...prev,
            session: data.session,
            isConnecting: false,
            showSetupModal: false,
            showControls: true,
            pendingAgents: [],
            pendingConfig: {},
            messages: [],
          }));

          // Connect to the event stream
          connectToEventStream(data.session.id);

          return data.session;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          set(aiMultiplayerSessionAtom, (prev) => ({
            ...prev,
            isConnecting: false,
            connectionError: errorMessage,
          }));
          console.error('[AIMultiplayerSession] Failed to start session:', error);
        }
      },
    [getAuthHeaders]
  );

  const connectToEventStream = useCallback(
    async (sessionId: string) => {
      const token = await authClient.getTokenOrRedirect();
      const eventSource = new EventSource(
        `${apiClient.getApiUrl()}${API_BASE}/session/${sessionId}/events?token=${encodeURIComponent(token)}`
      );

      eventSource.onmessage = (event) => {
        try {
          const aiEvent: AIMultiplayerEvent = JSON.parse(event.data);
          handleEvent(aiEvent);
        } catch (error) {
          console.error('[AIMultiplayerSession] Failed to parse event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[AIMultiplayerSession] EventSource error:', error);
        setState((prev) => ({
          ...prev,
          connectionError: 'Connection lost. Attempting to reconnect...',
        }));
      };

      setState((prev) => ({
        ...prev,
        eventSource,
      }));
    },
    [setState]
  );

  const handleEvent = useCallback(
    (event: AIMultiplayerEvent) => {
      setState((prev) => ({
        ...prev,
        lastEvent: event,
      }));

      switch (event.type) {
        case 'turn_started':
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              currentTurnAgentId: event.agentId ?? null,
              agents: prev.agents.map((agent) =>
                agent.id === event.agentId ? { ...agent, status: 'thinking' as const } : agent
              ),
            };
          });
          break;

        case 'agent_message':
          if (event.data) {
            const message: AIMultiplayerChatMessage = event.data;
            setMessages((prev) => [...prev, message]);
          }
          break;

        case 'agent_cursor_move':
          if (event.agentId && event.data) {
            setSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                agents: prev.agents.map((agent) =>
                  agent.id === event.agentId ? { ...agent, cursorPosition: event.data } : agent
                ),
              };
            });
          }
          break;

        case 'turn_ended':
          setSession((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              turnNumber: event.turnNumber ?? prev.turnNumber + 1,
              agents: prev.agents.map((agent) =>
                agent.id === event.agentId
                  ? { ...agent, status: 'idle' as const, turnsCompleted: agent.turnsCompleted + 1 }
                  : agent
              ),
            };
          });
          break;

        case 'session_paused':
          setSession((prev) => {
            if (!prev) return prev;
            return { ...prev, status: 'paused' };
          });
          break;

        case 'session_ended':
          setSession((prev) => {
            if (!prev) return prev;
            return { ...prev, status: 'ended', endedAt: Date.now() };
          });
          break;

        case 'error':
          console.error('[AIMultiplayerSession] Session error:', event.data);
          break;
      }
    },
    [setState, setSession, setMessages]
  );

  // ============================================================================
  // Turn Management
  // ============================================================================

  const executeTurn = useRecoilCallback(
    ({ snapshot }) =>
      async (agentId?: string) => {
        const currentState = await snapshot.getPromise(aiMultiplayerSessionAtom);
        const session = currentState.session;
        if (!session) {
          console.error('[AIMultiplayerSession] No active session');
          return;
        }

        try {
          const headers = await getAuthHeaders();
          const response = await fetch(`${apiClient.getApiUrl()}${API_BASE}/session/${session.id}/turn`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ sessionId: session.id, agentId }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to execute turn');
          }
        } catch (error) {
          console.error('[AIMultiplayerSession] Failed to execute turn:', error);
        }
      },
    [getAuthHeaders]
  );

  const runContinuously = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        const currentState = await snapshot.getPromise(aiMultiplayerSessionAtom);
        const session = currentState.session;
        if (!session) return;

        set(aiMultiplayerSessionSelector, {
          ...session,
          status: 'running',
        });

        // Execute first turn - subsequent turns will be triggered by turn_ended events
        await executeTurn();
      },
    [executeTurn]
  );

  // ============================================================================
  // User Influence
  // ============================================================================

  const sendUserInfluence = useRecoilCallback(
    ({ snapshot }) =>
      async (message: string) => {
        const currentState = await snapshot.getPromise(aiMultiplayerSessionAtom);
        const session = currentState.session;
        if (!session) {
          console.error('[AIMultiplayerSession] No active session');
          return;
        }

        try {
          const headers = await getAuthHeaders();
          const response = await fetch(`${apiClient.getApiUrl()}${API_BASE}/session/${session.id}/influence`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ sessionId: session.id, message }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to send influence');
          }
        } catch (error) {
          console.error('[AIMultiplayerSession] Failed to send influence:', error);
        }
      },
    [getAuthHeaders]
  );

  // ============================================================================
  // Session Control
  // ============================================================================

  const pauseSession = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        const currentState = await snapshot.getPromise(aiMultiplayerSessionAtom);
        const session = currentState.session;
        if (!session) return;

        set(aiMultiplayerSessionSelector, {
          ...session,
          status: 'paused',
        });
      },
    []
  );

  const resumeSession = useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        const currentState = await snapshot.getPromise(aiMultiplayerSessionAtom);
        const session = currentState.session;
        if (!session || session.status !== 'paused') return;

        await runContinuously();
      },
    [runContinuously]
  );

  const endSession = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        const currentState = await snapshot.getPromise(aiMultiplayerSessionAtom);
        const session = currentState.session;
        if (!session) return;

        try {
          const headers = await getAuthHeaders();
          await fetch(`${apiClient.getApiUrl()}${API_BASE}/session/${session.id}`, {
            method: 'DELETE',
            headers,
          });
        } catch (error) {
          console.error('[AIMultiplayerSession] Failed to end session:', error);
        }

        // Close event source and reset state
        currentState.eventSource?.close();
        set(aiMultiplayerSessionAtom, defaultAIMultiplayerSessionState);
      },
    [getAuthHeaders]
  );

  return {
    // State
    session: state.session,
    isConnecting: state.isConnecting,
    connectionError: state.connectionError,
    messages: state.messages,
    showSetupModal: state.showSetupModal,
    pendingAgents: state.pendingAgents,
    pendingConfig: state.pendingConfig,

    // Setup
    openSetupModal,
    closeSetupModal,
    addPendingAgent,
    removePendingAgent,
    updatePendingConfig,

    // Session management
    startSession,
    endSession,

    // Turn management
    executeTurn,
    runContinuously,

    // User influence
    sendUserInfluence,

    // Session control
    pauseSession,
    resumeSession,
  };
}
