import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import { clearCookies, sendResetPassword } from '../providers/auth';

const schema = z.object({
  body: ApiSchemas['/auth/sendResetPassword.POST.request'],
});

const sendResetPasswordRouter = express.Router();

sendResetPasswordRouter.post(
  '/sendResetPassword',
  async (req: Request, res: Response<ApiTypes['/auth/sendResetPassword.POST.response']>) => {
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
