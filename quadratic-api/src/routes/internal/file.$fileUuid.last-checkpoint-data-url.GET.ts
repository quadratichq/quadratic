import type { Response } from 'express';
import express from 'express';
import { param, validationResult } from 'express-validator';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { getFileUrl } from '../../storage/storage';
import type { Request } from '../../types/Request';

export const validateUUID = () => param('uuid').isUUID(4);

const router = express.Router();

router.get(
  '/file/:uuid/last-checkpoint-data-url',
  validateM2MAuth(),
  validateUUID(),
  async (req: Request, res: Response) => {
    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const fileUuid = req.params.uuid;

    // Get the most recent checkpoint for the file
    const result = await dbClient.file.findUniqueOrThrow({
      where: {
        uuid: fileUuid,
      },
      select: {
        FileCheckpoint: {
          orderBy: {
            sequenceNumber: 'desc',
          },
          take: 1,
        },
      },
    });

    const checkpoint = result.FileCheckpoint[0];

    const lastCheckpointDataUrl = await getFileUrl(checkpoint.s3Key);

    return res.status(200).send(lastCheckpointDataUrl);
  }
);

export default router;
