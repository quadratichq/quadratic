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
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      });
      return res.sendStatus(200);
    } catch {
      return res.sendStatus(401);
    }
  }
);

export default loginWithPasswordRouter;
