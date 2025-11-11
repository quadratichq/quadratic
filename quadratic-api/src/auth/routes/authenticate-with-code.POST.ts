import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import logger from '../../utils/logger';
import { authenticateWithCode, clearCookies } from '../providers/auth';

const schema = z.object({
  body: ApiSchemas['/v0/auth/authenticate-with-code.POST.request'],
});

const authenticateWithCodeRouter = express.Router();

authenticateWithCodeRouter.post(
  '/',
  async (req: Request, res: Response<ApiTypes['/v0/auth/authenticate-with-code.POST.response']>) => {
    try {
      const {
        body: { code },
      } = parseRequest(req, schema);

      const { pendingAuthenticationToken } = await authenticateWithCode({ code, res });

      return res.status(200).json({ message: 'Authentication successful', pendingAuthenticationToken });
    } catch (error) {
      logger.info('/v0/auth/authenticate-with-code.POST.response', error);

      clearCookies({ res });

      return res.status(401).json({ message: 'Authentication failed', pendingAuthenticationToken: undefined });
    }
  }
);

export default authenticateWithCodeRouter;
