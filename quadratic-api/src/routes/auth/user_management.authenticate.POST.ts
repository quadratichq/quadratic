import type { Response } from 'express';
import express from 'express';
import { authenticateWithRefreshToken, clearCookies } from '../../auth/auth';
import type { Request } from '../../types/Request';

const authenticateRouter = express.Router();

authenticateRouter.post('/authenticate', async (req: Request, res: Response) => {
  try {
    const response = await authenticateWithRefreshToken({ req, res });

    return res.status(200).json(response);
  } catch {
    clearCookies({ res });

    return res.status(401).json({ message: 'Authentication failed' });
  }
});

export default authenticateRouter;
