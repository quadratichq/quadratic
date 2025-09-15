import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import logger from '../../utils/logger';
import { auth_rate_limiter } from '../middleware/authRateLimiter';
import { clearCookies, signupWithPassword } from '../providers/auth';

const schema = z.object({
  body: ApiSchemas['/v0/auth/signup-with-password.POST.request'],
});

const signupWithPasswordRouter = express.Router();

signupWithPasswordRouter.post(
  '/',
  auth_rate_limiter,
  async (req: Request, res: Response<ApiTypes['/v0/auth/signup-with-password.POST.response']>) => {
    try {
      const {
        body: { email, password, firstName, lastName },
      } = parseRequest(req, schema);

      const { pendingAuthenticationToken } = await signupWithPassword({ email, password, firstName, lastName, res });

      return res.status(200).json({ message: 'Signup successful', pendingAuthenticationToken });
    } catch (error) {
      logger.info('/v0/auth/signup-with-password.POST.response', error);

      clearCookies({ res });

      return res.status(401).json({ message: 'Signup failed', pendingAuthenticationToken: undefined });
    }
  }
);

export default signupWithPasswordRouter;
