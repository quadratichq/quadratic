import express, { Response } from 'express';
import { param, validationResult } from 'express-validator';
import dbClient from '../../dbClient';
import { Request } from '../../types/Request';
import { validateM2MAuth } from '../../internal/validateM2MAuth';

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
