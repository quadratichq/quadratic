import { ConnectionType } from '@prisma/client';
import type { Response } from 'express';
import express from 'express';
import { query, validationResult } from 'express-validator';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import type { Request } from '../../types/Request';
import { decryptFromEnv } from '../../utils/crypto';

// validate the type is a valid connection type
export const validateType = () => query('type').isString().isIn(Object.values(ConnectionType));

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
    const connections = await dbClient.connection.findMany({
      where: {
        type: type as ConnectionType,
      },
      include: {
        team: { select: { uuid: true } },
      },
    });

    const data: ApiTypes['/v0/internal/connection.GET.response'] = connections.map((connection) => ({
      uuid: connection.uuid,
      name: connection.name,
      type: connection.type,
      teamId: connection.team.uuid,
      typeDetails: JSON.parse(decryptFromEnv(connection.typeDetails.toString())),
    }));

    return res.status(200).json(data);
  }
);

export default router;
