import type { Response } from 'express';
import type { AIMultiplayerEvent } from 'quadratic-shared/ai/multiplayerSession';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { broadcastSessionEvent, getSession, updateSession } from '../../ai/multiplayer/sessionStore';
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
    message: z.string().min(1),
  }),
});

async function handler(req: RequestWithUser, res: Response) {
  const {
    user: { id: userId },
  } = req;

  const {
    params: { sessionId },
    body: { message },
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

  // Check session status
  if (session.status === 'ended' || session.status === 'completed') {
    throw new ApiError(400, 'Cannot send influence to ended session');
  }

  // Add the user influence to the session
  const influence = {
    id: uuidv4(),
    message,
    createdAt: Date.now(),
    acknowledged: false,
  };
  session.pendingUserInfluence.push(influence);
  updateSession(session);

  // Broadcast the influence event
  const event: AIMultiplayerEvent = {
    type: 'user_influence_received',
    sessionId: session.id,
    data: { influence },
    timestamp: Date.now(),
  };
  broadcastSessionEvent(session.id, event);

  res.status(200).json({ success: true, influenceId: influence.id });
}
