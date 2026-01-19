import type { Response } from 'express';
import express from 'express';
import { param, validationResult } from 'express-validator';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import type { Request } from '../../types/Request';

export const validateUUID = () => param('uuid').isUUID(4);

const router = express.Router();

router.get('/file/:uuid/checkpoint', validateM2MAuth(), validateUUID(), async (req: Request, res: Response) => {
  // Validate request parameters
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const fileUuid = req.params.uuid;

  // Get the most recent checkpoint for the file
  const result = await dbClient.file.findUnique({
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

  if (!result) {
    return res.status(404).json({ error: 'File not found' });
  }

  const checkpoint = result.FileCheckpoint[0];

  if (!checkpoint) {
    return res.status(404).json({ error: 'No checkpoint found for file' });
  }

  return res.status(200).json({
    fileUuid: fileUuid,
    lastCheckpoint: {
      sequenceNumber: checkpoint.sequenceNumber,
      version: checkpoint.version,
      s3Key: checkpoint.s3Key,
      s3Bucket: checkpoint.s3Bucket,
    },
  });
});

export default router;
