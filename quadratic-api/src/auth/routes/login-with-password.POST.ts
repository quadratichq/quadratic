import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import { clearCookies, loginWithPassword } from '../providers/auth';

const schema = z.object({
  body: ApiSchemas['/v0/auth/login-with-password.POST.request'],
});

const loginWithPasswordRouter = express.Router();

loginWithPasswordRouter.post(
  '/',
  async (req: Request, res: Response<ApiTypes['/v0/auth/login-with-password.POST.response']>) => {
    try {
      const {
        body: { email, password },
      } = parseRequest(req, schema);

      const { pendingAuthenticationToken } = await loginWithPassword({ email, password, res });

      return res.status(200).json({ message: 'Login successful', pendingAuthenticationToken });
    } catch {
      clearCookies({ res });

      return res.status(401).json({ message: 'Login failed', pendingAuthenticationToken: undefined });
    }
  }
);

export default loginWithPasswordRouter;
