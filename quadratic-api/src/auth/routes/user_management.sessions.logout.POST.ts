import type { Response } from 'express';
import express from 'express';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import logger from '../../utils/logger';
import { clearCookies, logoutSession } from '../providers/auth';

const schema = z.object({
  query: z.object({
    session_id: z.string(),
  }),
});

const logoutRouter = express.Router();

logoutRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { query } = parseRequest(req, schema);
    const { session_id } = query;

    await logoutSession({ sessionId: session_id, res });

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    logger.info('/v0/auth/user_management/sessions/logout.POST.response', error);

    clearCookies({ res });

    return res.status(401).json({ message: 'Logout failed' });
  }
});

export default logoutRouter;
