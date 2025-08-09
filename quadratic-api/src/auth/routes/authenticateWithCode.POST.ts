import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import { authenticateWithCode, clearCookies } from '../providers/auth';

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

      const { pendingAuthenticationToken } = await authenticateWithCode({ code, res });

      return res.status(200).json({ message: 'Authentication successful', pendingAuthenticationToken });
    } catch {
      clearCookies({ res });

      return res.status(401).json({ message: 'Authentication failed', pendingAuthenticationToken: undefined });
    }
  }
);

export default authenticateWithCodeRouter;
