import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import { clearCookies, resetPassword } from '../providers/auth';

const schema = z.object({
  body: ApiSchemas['/auth/resetPassword.POST.request'],
});

const resetPasswordRouter = express.Router();

resetPasswordRouter.post(
  '/resetPassword',
  async (req: Request, res: Response<ApiTypes['/auth/resetPassword.POST.response']>) => {
    try {
      const {
        body: { token, password },
      } = parseRequest(req, schema);

      await resetPassword({ token, password, res });

      return res.status(200).json({ message: 'Password reset successful' });
    } catch {
      clearCookies({ res });

      return res.status(401).json({ message: 'Password reset failed' });
    }
  }
);

export default resetPasswordRouter;
