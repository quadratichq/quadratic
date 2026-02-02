import type { Response } from 'express';
import { getNextAgentId, type AIMultiplayerEvent } from 'quadratic-shared/ai/multiplayerSession';
import { z } from 'zod';
import { broadcastSessionEvent, getSession, updateSession } from '../../ai/multiplayer/sessionStore';
import { executeTurn } from '../../ai/multiplayer/turnCoordinator';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    sessionId: z.string().uuid(),
  }),
  body: z.object({
    agentId: z.string().uuid().optional(),
  }),
});

async function handler(req: RequestWithUser, res: Response) {
  const {
    user: { id: userId },
  } = req;

  const {
    params: { sessionId },
    body: { agentId: requestedAgentId },
  } = parseRequest(req, schema);

  // Get the session
  const session = getSession(sessionId);
  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  // Verify user owns the session
  if (session.userId !== userId) {
    throw new ApiError(403, 'Not authorized to access this session');
  }

  // Check session status
  if (session.status !== 'running' && session.status !== 'paused') {
    throw new ApiError(400, `Cannot execute turn: session status is ${session.status}`);
  }

  // Determine which agent should take the turn
  const agentId = requestedAgentId ?? getNextAgentId(session);
  const agent = session.agents.find((a) => a.id === agentId);
  if (!agent) {
    throw new ApiError(404, 'Agent not found in session');
  }

  // Check if we've exceeded turn limits
  if (session.turnNumber >= session.config.maxTotalTurns) {
    session.status = 'completed';
    updateSession(session);

    const endEvent: AIMultiplayerEvent = {
      type: 'session_ended',
      sessionId: session.id,
      data: { reason: 'max_turns_reached' },
      timestamp: Date.now(),
    };
    broadcastSessionEvent(session.id, endEvent);

    throw new ApiError(400, 'Maximum turns reached');
  }

  if (agent.turnsCompleted >= session.config.maxTurnsPerAgent) {
    throw new ApiError(400, `Agent ${agent.name} has reached maximum turns`);
  }

  // Set up SSE response for streaming the turn
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Execute the turn with streaming
  try {
    await executeTurn(session, agent, res);
    res.end();
  } catch (error) {
    console.error('[AIMultiplayerSession] Turn execution error:', error);

    const errorEvent: AIMultiplayerEvent = {
      type: 'error',
      sessionId: session.id,
      agentId: agent.id,
      data: { error: error instanceof Error ? error.message : 'Unknown error' },
      timestamp: Date.now(),
    };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
  }
}
