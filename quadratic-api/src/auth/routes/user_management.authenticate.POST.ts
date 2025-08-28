import type { Response } from 'express';
import express from 'express';
import type { Request } from '../../types/Request';
import logger from '../../utils/logger';
import { authenticateWithRefreshToken, clearCookies } from '../providers/auth';

const authenticateRouter = express.Router();

authenticateRouter.post('/', async (req: Request, res: Response) => {
  try {
    const response = await authenticateWithRefreshToken({ req, res });

    return res.status(200).json(response);
  } catch (error) {
    logger.info('/v0/auth/user_management/authenticate.POST.response', error);

    clearCookies({ res });

    return res.status(401).json({ message: 'Authentication failed' });
  }
});

export default authenticateRouter;
