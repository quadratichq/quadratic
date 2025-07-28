import type { Response } from 'express';
import express from 'express';
import { authenticateWithRefreshToken } from '../../auth/auth';
import type { Request } from '../../types/Request';

const authenticateRouter = express.Router();

authenticateRouter.post('/authenticate', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.['refresh-token'];
    if (!refreshToken) {
      throw new Error('No refresh token found');
    }
    const response = await authenticateWithRefreshToken({ refreshToken });
    return res.status(200).json(response);
  } catch {
    return res.sendStatus(401);
  }
});

export default authenticateRouter;
