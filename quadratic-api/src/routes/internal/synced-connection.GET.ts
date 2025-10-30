import { ConnectionType } from '@prisma/client';
import type { Response } from 'express';
import express from 'express';
import { query, validationResult } from 'express-validator';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import type { Request } from '../../types/Request';

// validate the type is a valid connection type
export const validateType = () => query('type').isString().isIn(Object.values(ConnectionType));

const router = express.Router();

router.get(
  '/synced-connections/:syncedConnectionId',
  validateM2MAuth(),
  validateType(),
  async (req: Request, res: Response<ApiTypes['/v0/internal/synced-connections.GET.response'][]>) => {
    const {
      params: { type },
    } = req;

    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).end();
    }

    // Get the synced connections
    const syncedConnections = await dbClient.syncedConnection.findMany({
      where: {
        connection: {
          type: type as ConnectionType,
        },
      },
      include: {
        connection: {
          select: {
            type: true,
          },
        },
      },
    });

    const data = syncedConnections.map((syncedConnection) => ({
      id: syncedConnection.id,
      connectionId: syncedConnection.connectionId,
      percentCompleted: syncedConnection.percentCompleted,
      status: syncedConnection.status,
      updatedDate: syncedConnection.updatedDate.toISOString(),
    }));

    return res.status(200).json(data);
  }
);

export default router;
