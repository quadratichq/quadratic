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
  '/file/:uuid/last-file-checkpoint',
  validateM2MAuth(),
  validateUUID(),
  async (req: Request, res: Response) => {
    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      params: { uuid: fileUuid },
    } = req;

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

    const { s3Key, sequenceNumber } = result.FileCheckpoint[0];

    const presignedUrl = await getFileUrl(s3Key);

    return res.status(200).json({ presignedUrl, sequenceNumber });
  }
);

export default router;
