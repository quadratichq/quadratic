import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import { auth_signup_rate_limiter } from '../middleware/authRateLimiter';
import { clearCookies, verifyEmail } from '../providers/auth';

const schema = z.object({
  body: ApiSchemas['/v0/auth/verify-email.POST.request'],
});

const verifyEmailRouter = express.Router();

verifyEmailRouter.post(
  '/',
  auth_signup_rate_limiter,
  async (req: Request, res: Response<ApiTypes['/v0/auth/verify-email.POST.response']>) => {
    try {
      const {
        body: { pendingAuthenticationToken, code },
      } = parseRequest(req, schema);

      await verifyEmail({ pendingAuthenticationToken, code, res });

      return res.status(200).json({ message: 'Email verified' });
    } catch {
      clearCookies({ res });

      return res.status(401).json({ message: 'Email verification failed' });
    }
  }
);

export default verifyEmailRouter;
