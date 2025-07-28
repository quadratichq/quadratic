import type { Response } from 'express';
import express from 'express';
import z from 'zod';
import { logoutSession } from '../../auth/auth';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';

const schema = z.object({
  query: z.object({
    session_id: z.string(),
  }),
});

const logoutRouter = express.Router();

logoutRouter.get('/sessions/logout', async (req: Request, res: Response) => {
  try {
    const { query } = parseRequest(req, schema);
    const { session_id } = query;
    await logoutSession({ sessionId: session_id });
    return res.status(200).json({ message: 'Logout successful' });
  } catch {
    return res.status(401).json({ message: 'Logout failed' });
  }
});

export default logoutRouter;
