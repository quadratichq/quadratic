import type { Response } from 'express';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import {
  AI_AGENT_PERSONA_CONFIG,
  getAgentSystemPrompt,
  type AIAgent,
  type AIMultiplayerChatMessage,
  type AIMultiplayerEvent,
  type AIMultiplayerSession,
} from 'quadratic-shared/ai/multiplayerSession';
import type { AIModelKey, AIRequestHelperArgs, ChatMessage } from 'quadratic-shared/typesAndSchemasAI';
import { v4 as uuidv4 } from 'uuid';
import { handleAIRequest } from '../handler/ai.handler';
import { broadcastSessionEvent, updateSession } from './sessionStore';

/**
 * Build the system prompt for an agent, including collaboration context.
 */
function buildAgentSystemPrompt(agent: AIAgent, session: AIMultiplayerSession): string {
  const personaConfig = AI_AGENT_PERSONA_CONFIG[agent.persona];
  const basePrompt = getAgentSystemPrompt(agent);

  // Add collaboration context
  const otherAgents = session.agents.filter((a) => a.id !== agent.id);
  const otherAgentNames = otherAgents.map((a) => `${a.name} (${AI_AGENT_PERSONA_CONFIG[a.persona].displayName})`);

  const collaborationContext = `
## Collaboration Context

You are in a multi-agent AI session with the following collaborators:
${otherAgentNames.map((name) => `- ${name}`).join('\n')}

Current turn: ${session.turnNumber + 1}
Your turns completed: ${agent.turnsCompleted}

## Communication Guidelines

1. **Share your thinking**: Before making changes, explain what you're planning to do in the chat.
2. **Acknowledge others' work**: If building on another agent's work, mention it.
3. **Yield appropriately**: After completing a logical unit of work (e.g., a chart, a data transformation), yield your turn to let others contribute.
4. **Coordinate on shared areas**: If you notice another agent is working on something related, coordinate via chat.
5. **Be constructive**: When reviewing others' work, provide helpful feedback.

## User Influence

${
  session.pendingUserInfluence.length > 0
    ? `The user has provided the following guidance that you should incorporate:
${session.pendingUserInfluence.map((i) => `- "${i.message}"`).join('\n')}`
    : 'No specific user guidance at this time.'
}

## Turn Structure

Your turn should follow this structure:
1. First, post a brief message explaining what you'll work on
2. Execute your actions (read data, make changes, create visualizations, etc.)
3. Post a summary of what you accomplished
4. The turn ends automatically when you stop producing output

Remember: This is a collaborative session. Take turns, share insights, and build on each other's work.
`;

  return `${basePrompt}\n\n${collaborationContext}`;
}

/**
 * Build the messages array for an agent's turn, including context from other agents.
 */
function buildAgentMessages(
  session: AIMultiplayerSession,
  agent: AIAgent,
  chatHistory: AIMultiplayerChatMessage[]
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // Add the agent's system prompt as a system message
  const systemPrompt = buildAgentSystemPrompt(agent, session);
  messages.push({
    role: 'user' as const,
    content: [createTextContent(systemPrompt)],
    contextType: 'quadraticDocs' as const,
  });

  // Add chat history from other agents and previous turns
  // Filter to only include recent messages (last 20) to keep context manageable
  const recentHistory = chatHistory.slice(-20);
  for (const chatMessage of recentHistory) {
    if (chatMessage.multiplayerContext) {
      const { agentId, agentName, isUserInfluence } = chatMessage.multiplayerContext;

      // Add a context note about who sent this message
      const prefix = isUserInfluence
        ? `[User Guidance]: `
        : agentId === agent.id
          ? `[Your previous message]: `
          : `[${agentName}]: `;

      // Transform the message to include attribution
      if (chatMessage.role === 'user' && chatMessage.contextType === 'userPrompt') {
        messages.push({
          ...chatMessage,
          content: chatMessage.content.map((c) => (c.type === 'text' ? { ...c, text: `${prefix}${c.text}` } : c)),
        });
      } else if (chatMessage.role === 'assistant') {
        messages.push(chatMessage);
      }
    }
  }

  return messages;
}

/**
 * Execute a single turn for an agent.
 */
export async function executeTurn(session: AIMultiplayerSession, agent: AIAgent, response: Response): Promise<void> {
  const turnStartTime = Date.now();

  // Update session state
  session.currentTurnAgentId = agent.id;
  session.agents = session.agents.map((a) =>
    a.id === agent.id ? { ...a, status: 'thinking' as const, lastActiveAt: Date.now() } : a
  );
  updateSession(session);

  // Broadcast turn started event
  const turnStartedEvent: AIMultiplayerEvent = {
    type: 'turn_started',
    sessionId: session.id,
    agentId: agent.id,
    turnNumber: session.turnNumber + 1,
    timestamp: Date.now(),
  };
  broadcastSessionEvent(session.id, turnStartedEvent);
  response.write(`data: ${JSON.stringify(turnStartedEvent)}\n\n`);

  // Build the request arguments
  const args: AIRequestHelperArgs = {
    source: 'AIAnalyst',
    messages: buildAgentMessages(session, agent, []),
    useStream: true,
    useToolsPrompt: true,
    useQuadraticContext: true,
  };

  // Abort controller for this turn
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, session.config.turnTimeoutMs);

  try {
    // Update agent status to acting
    session.agents = session.agents.map((a) => (a.id === agent.id ? { ...a, status: 'acting' as const } : a));
    updateSession(session);

    // Execute the AI request
    const parsedResponse = await handleAIRequest({
      modelKey: agent.modelKey as AIModelKey,
      args,
      isOnPaidPlan: true, // Multiplayer sessions require paid plan
      exceededBillingLimit: false,
      response,
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    // Process the response
    if (parsedResponse) {
      const responseContent = parsedResponse.responseMessage.content;
      const toolCalls = parsedResponse.responseMessage.toolCalls;

      // Create a chat message from the agent's response
      const agentMessage: AIMultiplayerChatMessage = {
        role: 'assistant',
        content: responseContent,
        contextType: 'userPrompt',
        toolCalls,
        modelKey: agent.modelKey,
        multiplayerContext: {
          agentId: agent.id,
          agentName: agent.name,
          agentColor: agent.color,
          turnNumber: session.turnNumber + 1,
          isUserInfluence: false,
        },
      };

      // Broadcast the agent's message
      const messageEvent: AIMultiplayerEvent = {
        type: 'agent_message',
        sessionId: session.id,
        agentId: agent.id,
        turnNumber: session.turnNumber + 1,
        data: agentMessage,
        timestamp: Date.now(),
      };
      broadcastSessionEvent(session.id, messageEvent);

      // Update agent stats
      session.agents = session.agents.map((a) =>
        a.id === agent.id
          ? {
              ...a,
              status: 'idle' as const,
              turnsCompleted: a.turnsCompleted + 1,
              totalTokensUsed:
                a.totalTokensUsed + (parsedResponse.usage.inputTokens ?? 0) + (parsedResponse.usage.outputTokens ?? 0),
            }
          : a
      );
    }

    // Mark any pending user influence as acknowledged
    session.pendingUserInfluence = session.pendingUserInfluence.map((i) => ({
      ...i,
      acknowledged: true,
    }));

    // Update turn history
    session.turnHistory.push({
      turnNumber: session.turnNumber + 1,
      agentId: agent.id,
      agentName: agent.name,
      startedAt: turnStartTime,
      endedAt: Date.now(),
      tokensUsed: parsedResponse?.usage
        ? (parsedResponse.usage.inputTokens ?? 0) + (parsedResponse.usage.outputTokens ?? 0)
        : undefined,
      toolCallsCount: parsedResponse?.responseMessage.toolCalls.length ?? 0,
    });

    // Increment turn number
    session.turnNumber += 1;
    session.currentTurnAgentId = null;
    updateSession(session);

    // Broadcast turn ended event
    const turnEndedEvent: AIMultiplayerEvent = {
      type: 'turn_ended',
      sessionId: session.id,
      agentId: agent.id,
      turnNumber: session.turnNumber,
      data: {
        duration: Date.now() - turnStartTime,
        tokensUsed: parsedResponse?.usage
          ? (parsedResponse.usage.inputTokens ?? 0) + (parsedResponse.usage.outputTokens ?? 0)
          : 0,
      },
      timestamp: Date.now(),
    };
    broadcastSessionEvent(session.id, turnEndedEvent);
    response.write(`data: ${JSON.stringify(turnEndedEvent)}\n\n`);
  } catch (error) {
    clearTimeout(timeoutId);

    // Update agent status to error
    session.agents = session.agents.map((a) => (a.id === agent.id ? { ...a, status: 'error' as const } : a));

    // If auto-pause on error is enabled, pause the session
    if (session.config.autoPauseOnError) {
      session.status = 'paused';
      broadcastSessionEvent(session.id, {
        type: 'session_paused',
        sessionId: session.id,
        data: { reason: 'error', error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now(),
      });
    }

    updateSession(session);
    throw error;
  }
}
