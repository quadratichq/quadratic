import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import logger from '../../utils/logger';
import { auth_rate_limiter } from '../middleware/authRateLimiter';
import { clearCookies, sendMagicAuthCode } from '../providers/auth';

const schema = z.object({
  body: ApiSchemas['/v0/auth/send-magic-auth-code.POST.request'],
});

const resetPasswordRouter = express.Router();

resetPasswordRouter.post(
  '/',
  auth_rate_limiter,
  async (req: Request, res: Response<ApiTypes['/v0/auth/send-magic-auth-code.POST.response']>) => {
    try {
      const {
        body: { email },
      } = parseRequest(req, schema);

      const { pendingAuthenticationToken } = await sendMagicAuthCode({ email, res });

      return res.status(200).json({ message: 'Magic auth code sent', email, pendingAuthenticationToken });
    } catch (error) {
      logger.info('/v0/auth/send-magic-auth-code.POST.response', error);

      clearCookies({ res });

      return res.status(401).json({ message: 'Magic auth code failed', pendingAuthenticationToken: undefined });
    }
  }
);

export default resetPasswordRouter;
