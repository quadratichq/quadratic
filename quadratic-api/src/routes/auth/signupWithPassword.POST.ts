import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { signupWithPassword } from '../../auth/auth';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';

const schema = z.object({
  body: ApiSchemas['/auth/signupWithPassword.POST.request'],
});

const signupWithPasswordRouter = express.Router();

signupWithPasswordRouter.post(
  '/signupWithPassword',
  async (req: Request, res: Response<ApiTypes['/auth/signupWithPassword.POST.response']>) => {
    try {
      const {
        body: { email, password, firstName, lastName },
      } = parseRequest(req, schema);

      const { refreshToken } = await signupWithPassword({ email, password, firstName, lastName });
      res.cookie('refresh-token', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      });
      return res.status(200).json({ message: 'Signup successful' });
    } catch {
      return res.status(401).json({ message: 'Signup failed' });
    }
  }
);

export default signupWithPasswordRouter;
