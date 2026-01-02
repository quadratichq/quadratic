import type { Response } from 'express';
import express from 'express';
import { param, validationResult } from 'express-validator';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { getFileUrl } from '../../storage/storage';
import type { Request } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export const validateUUID = () => param('uuid').isUUID(4);

const router = express.Router();

router.get('/file/:uuid/init-data', validateM2MAuth(), validateUUID(), async (req: Request, res: Response) => {
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
      timezone: true,
      creator: {
        select: {
          email: true,
        },
      },
      ownerTeam: {
        select: {
          uuid: true,
        },
      },
      FileCheckpoint: {
        orderBy: {
          sequenceNumber: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!result.creator) {
    throw new ApiError(400, `File ${fileUuid} does not have a creator user.`);
  }

  const { s3Key, sequenceNumber } = result.FileCheckpoint[0];
  const presignedUrl = await getFileUrl(s3Key);

  return res.status(200).json({
    teamId: result.ownerTeam.uuid,
    email: result.creator.email,
    sequenceNumber,
    presignedUrl,
    timezone: result.timezone,
  });
});

export default router;
