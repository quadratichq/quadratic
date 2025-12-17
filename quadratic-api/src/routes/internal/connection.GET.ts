import { ConnectionType } from '@prisma/client';
import type { Response } from 'express';
import express from 'express';
import { validationResult } from 'express-validator';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import type { Request } from '../../types/Request';
import { getConnections, validateType } from '../../utils/connections';

const router = express.Router();

router.get(
  '/connection',
  validateM2MAuth(),
  validateType(),
  async (req: Request, res: Response<ApiTypes['/v0/internal/connection.GET.response']>) => {
    const {
      query: { type },
    } = req;

    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).end();
    }

    // Get the connections
    const connections = await getConnections(type as ConnectionType);

    return res.status(200).json(connections);
  }
);

export default router;
