import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { authenticateWithCode } from '../../auth/auth';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';

const schema = z.object({
  body: ApiSchemas['/auth/authenticateWithCode.POST.request'],
});

const authenticateWithCodeRouter = express.Router();

authenticateWithCodeRouter.post(
  '/authenticateWithCode',
  async (req: Request, res: Response<ApiTypes['/auth/authenticateWithCode.POST.response']>) => {
    try {
      const {
        body: { code },
      } = parseRequest(req, schema);

      const { refreshToken } = await authenticateWithCode(code);
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

export default authenticateWithCodeRouter;
