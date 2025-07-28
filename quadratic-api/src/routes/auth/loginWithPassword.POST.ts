import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { loginWithPassword } from '../../auth/auth';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';

const schema = z.object({
  body: ApiSchemas['/auth/loginWithPassword.POST.request'],
});

const loginWithPasswordRouter = express.Router();

loginWithPasswordRouter.post(
  '/loginWithPassword',
  async (req: Request, res: Response<ApiTypes['/auth/loginWithPassword.POST.response']>) => {
    try {
      const {
        body: { email, password },
      } = parseRequest(req, schema);

      const { refreshToken } = await loginWithPassword({ email, password });
      res.cookie('refresh-token', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      });
      return res.status(200).json({ message: 'Login successful' });
    } catch {
      return res.status(401).json({ message: 'Login failed' });
    }
  }
);

export default loginWithPasswordRouter;
