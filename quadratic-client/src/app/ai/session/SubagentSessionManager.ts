import { debugFlags } from '@/app/debugFlags/debugFlags';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type {
  ChatMessage,
  SubagentSession,
  ToolResultContent,
  ToolResultMessage,
} from 'quadratic-shared/typesAndSchemasAI';
import { v4 } from 'uuid';
import { aiStore, subagentSessionsAtom } from '../atoms/aiAnalystAtoms';
import type { SubagentType } from '../subagent/subagentTypes';
import { parseToolArguments } from '../utils/parseToolArguments';

const subagentDebug = () => debugFlags.getFlag('debugShowAISubagent');

/** Tools that fetch data and may need refreshing when resuming a session */
const REFRESHABLE_TOOLS: AITool[] = [
  AITool.GetCellData,
  AITool.HasCellData,
  AITool.TextSearch,
  AITool.GetDatabaseSchemas,
];

/**
 * SubagentSessionManager manages persistent subagent sessions.
 *
 * Each subagent type has at most one session. Sessions persist across main
 * agent conversations and can be resumed for follow-up questions.
 *
 * When resuming a session, the manager can refresh stale context by re-executing
 * "get-style" tool calls (GetCellData, HasCellData, etc.) to ensure the subagent
 * has up-to-date information.
 */
export class SubagentSessionManager {
  private store = aiStore;

  /**
   * Get all current sessions
   */
  getSessions(): Record<string, SubagentSession> {
    return this.store.get(subagentSessionsAtom);
  }

  /**
   * Get a session by subagent type
   */
  getSession(type: SubagentType): SubagentSession | undefined {
    const sessions = this.getSessions();
    return sessions[type];
  }

  /**
   * Check if a session exists for a subagent type
   */
  hasSession(type: SubagentType): boolean {
    return this.getSession(type) !== undefined;
  }

  /**
   * Create a new session for a subagent type, replacing any existing session
   */
  createSession(type: SubagentType): SubagentSession {
    const session: SubagentSession = {
      id: v4(),
      type,
      messages: [],
      lastUpdated: Date.now(),
    };

    this.updateSession(type, session);
    return session;
  }

  /**
   * Get an existing session or create a new one
   */
  getOrCreateSession(type: SubagentType): SubagentSession {
    const existing = this.getSession(type);
    if (existing) {
      return existing;
    }
    return this.createSession(type);
  }

  /**
   * Reset a session (clear messages, create fresh)
   */
  resetSession(type: SubagentType): SubagentSession {
    if (subagentDebug()) console.log(`[SubagentSessionManager] Resetting session for ${type}`);
    return this.createSession(type);
  }

  /**
   * Update a session in the store
   */
  private updateSession(type: SubagentType, session: SubagentSession): void {
    const sessions = this.getSessions();
    this.store.set(subagentSessionsAtom, {
      ...sessions,
      [type]: session,
    });
  }

  /**
   * Get messages for a session
   */
  getMessages(type: SubagentType): ChatMessage[] {
    const session = this.getSession(type);
    return session?.messages ?? [];
  }

  /**
   * Set messages for a session
   */
  setMessages(type: SubagentType, messages: ChatMessage[]): void {
    const session = this.getSession(type);
    if (!session) {
      if (subagentDebug()) console.warn(`[SubagentSessionManager] No session found for ${type}, creating new one`);
      const newSession = this.createSession(type);
      newSession.messages = messages;
      newSession.lastUpdated = Date.now();
      this.updateSession(type, newSession);
      return;
    }

    this.updateSession(type, {
      ...session,
      messages,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Add a message to a session
   */
  addMessage(type: SubagentType, message: ChatMessage): void {
    const messages = this.getMessages(type);
    this.setMessages(type, [...messages, message]);
  }

  /**
   * Update the last summary returned to the main agent
   */
  setLastSummary(type: SubagentType, summary: string): void {
    const session = this.getSession(type);
    if (session) {
      this.updateSession(type, {
        ...session,
        lastSummary: summary,
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Refresh the context of a session by re-executing get-style tool calls.
   *
   * This is called when resuming a session to ensure the subagent has fresh data.
   * It finds all tool results from refreshable tools and re-executes them with
   * the same parameters, replacing the old results.
   */
  async refreshContext(type: SubagentType): Promise<void> {
    const session = this.getSession(type);
    if (!session) {
      if (subagentDebug()) console.warn(`[SubagentSessionManager] No session to refresh for ${type}`);
      return;
    }

    if (subagentDebug()) console.log(`[SubagentSessionManager] Refreshing context for ${type}`);

    // Find all tool calls that need refreshing
    const toolCallsToRefresh = this.findRefreshableToolCalls(session.messages);

    if (toolCallsToRefresh.length === 0) {
      if (subagentDebug()) console.log(`[SubagentSessionManager] No tool calls to refresh`);
      return;
    }

    if (subagentDebug())
      console.log(`[SubagentSessionManager] Found ${toolCallsToRefresh.length} tool calls to refresh`);

    const { aiToolsActions } = await import('../tools/aiToolsActions');

    // Re-execute each tool call and collect new results
    const newResults: Map<string, { id: string; content: ToolResultContent }> = new Map();
    const failedToolIds = new Set<string>();

    for (const toolCall of toolCallsToRefresh) {
      const parsed = parseToolArguments(toolCall.arguments);
      if (!parsed.ok) {
        console.error(`[SubagentSessionManager] Invalid JSON for tool call ${toolCall.name}:`, parsed.error);
        newResults.set(toolCall.id, {
          id: toolCall.id,
          content: [createTextContent(`Error refreshing: ${parsed.error}`)],
        });
        failedToolIds.add(toolCall.id);
        continue;
      }

      try {
        // REFRESHABLE_TOOLS are get-style tools only; they don't use agentType/fileUuid/teamUuid/modelKey.
        // DelegateToSubagent needs that metadata but is not refreshable (subagents cannot delegate).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await aiToolsActions[toolCall.name as AITool](parsed.value as any, {
          source: 'AIAnalyst',
          chatId: session.id,
          messageIndex: 0,
        });
        newResults.set(toolCall.id, { id: toolCall.id, content: result });
      } catch (error) {
        console.error(`[SubagentSessionManager] Error refreshing tool call ${toolCall.name}:`, error);
        newResults.set(toolCall.id, {
          id: toolCall.id,
          content: [createTextContent(`Error refreshing: ${error}`)],
        });
        failedToolIds.add(toolCall.id);
      }
    }

    // Update tool results in the message history
    const updatedMessages = this.replaceToolResults(session.messages, newResults);

    const refreshNote =
      failedToolIds.size > 0
        ? '(Context refreshed. Some data could not be refreshed—see tool results above for details; that part may be missing or stale.)'
        : '(Context has been refreshed with the latest data from the spreadsheet.)';

    const refreshMessage: ChatMessage = {
      role: 'user',
      content: [createTextContent(refreshNote)],
      contextType: 'quadraticDocs',
    };

    this.setMessages(type, [...updatedMessages, refreshMessage]);
    if (subagentDebug()) console.log(`[SubagentSessionManager] Context refresh complete for ${type}`);
  }

  /**
   * Find all tool calls in the message history that should be refreshed
   */
  private findRefreshableToolCalls(
    messages: ChatMessage[]
  ): Array<{ id: string; name: string; arguments: string | undefined }> {
    const toolCalls: Array<{ id: string; name: string; arguments: string | undefined }> = [];

    for (const message of messages) {
      if (message.role === 'assistant' && 'toolCalls' in message && message.toolCalls) {
        for (const toolCall of message.toolCalls) {
          if (REFRESHABLE_TOOLS.includes(toolCall.name as AITool)) {
            toolCalls.push({
              id: toolCall.id,
              name: toolCall.name,
              arguments: toolCall.arguments,
            });
          }
        }
      }
    }

    return toolCalls;
  }

  /**
   * Replace tool results in the message history with new results
   */
  private replaceToolResults(
    messages: ChatMessage[],
    newResults: Map<string, { id: string; content: ToolResultContent }>
  ): ChatMessage[] {
    return messages.map((message) => {
      if (message.role === 'user' && message.contextType === 'toolResult') {
        const toolResultMessage = message as ToolResultMessage;
        const updatedContent = toolResultMessage.content.map((result) => {
          const newResult = newResults.get(result.id);
          if (newResult) {
            return {
              id: result.id,
              content: newResult.content,
            };
          }
          return result;
        });

        return {
          ...toolResultMessage,
          content: updatedContent,
        } as ToolResultMessage;
      }
      return message;
    });
  }

  /**
   * Clear all subagent sessions
   */
  clearAllSessions(): void {
    this.store.set(subagentSessionsAtom, {});
  }

  /**
   * Get session info for debugging/display
   */
  getSessionInfo(type: SubagentType): { messageCount: number; lastUpdated: number; hasSession: boolean } {
    const session = this.getSession(type);
    return {
      hasSession: !!session,
      messageCount: session?.messages.length ?? 0,
      lastUpdated: session?.lastUpdated ?? 0,
    };
  }
}

// Singleton instance
export const subagentSessionManager = new SubagentSessionManager();
