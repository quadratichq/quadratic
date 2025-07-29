import type { Response } from 'express';
import express from 'express';
import { ApiSchemas, type ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { authenticateWithCode, clearCookies } from '../../auth/auth';
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

      await authenticateWithCode({ code, res });

      return res.status(200).json({ message: 'Authentication successful' });
    } catch {
      clearCookies({ res });

      return res.status(401).json({ message: 'Authentication failed' });
    }
  }
);

export default authenticateWithCodeRouter;
