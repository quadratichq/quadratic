import type { Response } from 'express';
import type { AIMultiplayerEvent } from 'quadratic-shared/ai/multiplayerSession';
import { z } from 'zod';
import { broadcastSessionEvent, deleteSession, getSession } from '../../ai/multiplayer/sessionStore';
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

  // Broadcast session ended event before deletion
  const event: AIMultiplayerEvent = {
    type: 'session_ended',
    sessionId: session.id,
    data: { reason: 'user_ended' },
    timestamp: Date.now(),
  };
  broadcastSessionEvent(session.id, event);

  // Delete the session
  deleteSession(sessionId);

  res.status(200).json({ success: true });
}
