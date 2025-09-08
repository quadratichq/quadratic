import type { Response } from 'express';
import express from 'express';
import { param, validationResult } from 'express-validator';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import type { Request } from '../../types/Request';
import { decryptFromEnv } from '../../utils/crypto';

export const validateUUID = () => param('uuid').isUUID(4);

const router = express.Router();

router.get(
  '/connection/:uuid',
  validateM2MAuth(),
  validateUUID(),
  async (req: Request, res: Response<ApiTypes['/v0/teams/:uuid/connections/:connectionUuid.GET.response']>) => {
    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).end();
    }

    const connectionUuid = req.params.uuid;

    // Get the connection
    const connection = await dbClient.connection.findUniqueOrThrow({
      where: {
        uuid: connectionUuid,
      },
    });

    const typeDetails = JSON.parse(decryptFromEnv(connection.typeDetails.toString()));

    return res.status(200).json({
      uuid: connection.uuid,
      name: connection.name,
      type: connection.type,
      createdDate: connection.createdDate.toISOString(),
      updatedDate: connection.updatedDate.toISOString(),
      typeDetails,
    });
  }
);

export default router;
