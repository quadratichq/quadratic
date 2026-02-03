import type { Response } from 'express';
import type { AIMultiplayerEvent } from 'quadratic-shared/ai/multiplayerSession';
import { z } from 'zod';
import { getSession, subscribeToSession } from '../../ai/multiplayer/sessionStore';
import { userMiddleware } from '../../middleware/user';
import { validateAccessTokenSSE } from '../../middleware/validateAccessTokenSSE';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

// Use validateAccessTokenSSE to support token in query params (required for EventSource)
export default [validateAccessTokenSSE, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    sessionId: z.string().uuid(),
  }),
});

async function handler(req: RequestWithUser, res: Response) {
  const {
    user: { id: userId },
  } = req;

  const {
    params: { sessionId },
  } = parseRequest(req, schema);

  // Get the session
  const session = getSession(sessionId);
  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  // Verify user owns the session
  if (session.userId !== String(userId)) {
    throw new ApiError(403, 'Not authorized to access this session');
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial session state
  const initialEvent: AIMultiplayerEvent = {
    type: 'session_started',
    sessionId: session.id,
    data: { session },
    timestamp: Date.now(),
  };
  res.write(`data: ${JSON.stringify(initialEvent)}\n\n`);

  // Subscribe to session events
  subscribeToSession(sessionId, res);

  // Send periodic heartbeats to keep connection alive
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (error) {
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  // Clean up on connection close
  res.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}
