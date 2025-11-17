import { ConnectionType } from '@prisma/client';
import type { Response } from 'express';
import express from 'express';
import { query, validationResult } from 'express-validator';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ConnectionTypeDetailsSchema, ConnectionTypeSchema } from 'quadratic-shared/typesAndSchemasConnections';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import type { Request } from '../../types/Request';
import { decryptFromEnv } from '../../utils/crypto';

// validate the type is a valid connection type
export const validateType = () => query('type').optional().isString().isIn(Object.values(ConnectionType));

export const SyncedConnectionSchema = z.object({
  id: z.number(),
  connectionId: z.number(),
  percentCompleted: z.number(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DELETED']),
  updatedDate: z.string().datetime(),
  type: ConnectionTypeSchema,
  typeDetails: ConnectionTypeDetailsSchema,
  uuid: z.string().uuid(),
});

const router = express.Router();

router.get(
  '/synced-connection',
  validateM2MAuth(),
  validateType(),
  async (req: Request, res: Response<ApiTypes['/v0/internal/synced-connection.GET.response'][]>) => {
    const {
      query: { type },
    } = req;

    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).end();
    }

    // Get the synced connections
    // If no type is provided, get all synced connections
    const syncedConnections = await dbClient.syncedConnection.findMany({
      where: {
        connection: {
          ...(type ? { type: type as ConnectionType } : {}),
        },
      },
      include: {
        connection: {
          select: {
            type: true,
            uuid: true,
            typeDetails: true,
          },
        },
      },
    });

    const data = syncedConnections.map((syncedConnection) => ({
      id: syncedConnection.id,
      uuid: syncedConnection.connection.uuid,
      connectionId: syncedConnection.connectionId,
      percentCompleted: syncedConnection.percentCompleted,
      status: syncedConnection.status,
      updatedDate: syncedConnection.updatedDate.toISOString(),
      type: syncedConnection.connection.type,
      typeDetails: JSON.parse(decryptFromEnv(Buffer.from(syncedConnection.connection.typeDetails).toString('utf-8'))),
    }));

    return res.status(200).json(data);
  }
);

export default router;
