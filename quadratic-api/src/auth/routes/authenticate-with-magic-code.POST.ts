import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import { authenticateWithMagicCode, clearCookies } from '../providers/auth';

const schema = z.object({
  body: ApiSchemas['/v0/auth/authenticate-with-magic-code.POST.request'],
});

const authenticateWithMagicCodeRouter = express.Router();

authenticateWithMagicCodeRouter.post(
  '/',
  async (req: Request, res: Response<ApiTypes['/v0/auth/authenticate-with-magic-code.POST.response']>) => {
    try {
      const {
        body: { email, code },
      } = parseRequest(req, schema);

      const { pendingAuthenticationToken } = await authenticateWithMagicCode({ email, code, res });

      return res.status(200).json({ message: 'Authentication successful', pendingAuthenticationToken });
    } catch {
      clearCookies({ res });

      return res.status(401).json({ message: 'Authentication failed', pendingAuthenticationToken: undefined });
    }
  }
);

export default authenticateWithMagicCodeRouter;
