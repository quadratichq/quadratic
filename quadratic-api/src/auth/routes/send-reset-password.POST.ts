import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import { auth_signup_rate_limiter } from '../middleware/authRateLimiter';
import { clearCookies, sendResetPassword } from '../providers/auth';

const schema = z.object({
  body: ApiSchemas['/v0/auth/send-reset-password.POST.request'],
});

const sendResetPasswordRouter = express.Router();

sendResetPasswordRouter.post(
  '/',
  auth_signup_rate_limiter,
  async (req: Request, res: Response<ApiTypes['/v0/auth/send-reset-password.POST.response']>) => {
    try {
      const {
        body: { email },
      } = parseRequest(req, schema);

      await sendResetPassword({ email, res });

      return res.status(200).json({ message: 'Reset password email sent' });
    } catch {
      clearCookies({ res });

      return res.status(401).json({ message: 'Reset password email failed' });
    }
  }
);

export default sendResetPasswordRouter;
