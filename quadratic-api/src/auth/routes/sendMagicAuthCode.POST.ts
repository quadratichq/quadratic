import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import { clearCookies, sendMagicAuthCode } from '../providers/auth';

const schema = z.object({
  body: ApiSchemas['/auth/sendMagicAuthCode.POST.request'],
});

const resetPasswordRouter = express.Router();

resetPasswordRouter.post(
  '/sendMagicAuthCode',
  async (req: Request, res: Response<ApiTypes['/auth/sendMagicAuthCode.POST.response']>) => {
    try {
      const {
        body: { email },
      } = parseRequest(req, schema);

      await sendMagicAuthCode({ email, res });

      return res.status(200).json({ message: 'Magic auth code sent' });
    } catch {
      clearCookies({ res });

      return res.status(401).json({ message: 'Magic auth code failed' });
    }
  }
);

export default resetPasswordRouter;
