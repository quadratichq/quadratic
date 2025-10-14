import type { Request, Response } from 'express';
import express from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import logger from '../../utils/logger';
import { authenticateWithRefreshToken, clearCookies } from '../providers/auth';

const authenticateRouter = express.Router();

authenticateRouter.post(
  '/',
  async (
    req: Request<ApiTypes['/v0/auth/user_management/authenticate.POST.request']>,
    res: Response<ApiTypes['/v0/auth/user_management/authenticate.POST.response']>
  ) => {
    try {
      const response = await authenticateWithRefreshToken({ req, res });

      return res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && !error.message.includes('Invalid refresh token')) {
        logger.info('/v0/auth/user_management/authenticate.POST.response', error);
      }

      clearCookies({ res });
      return res.status(200).json({ not_logged_in: true });
    }
  }
);

export default authenticateRouter;
