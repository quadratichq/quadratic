import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { clearCookies, signupWithPassword } from '../../auth/auth';
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

      await signupWithPassword({ email, password, firstName, lastName, res });

      return res.status(200).json({ message: 'Signup successful' });
    } catch {
      clearCookies({ res });

      return res.status(401).json({ message: 'Signup failed' });
    }
  }
);

export default signupWithPasswordRouter;
