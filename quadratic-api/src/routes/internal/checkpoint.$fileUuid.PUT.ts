import express, { Response } from 'express';
import { param, validationResult } from 'express-validator';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { Request } from '../../types/Request';
import { validateM2MAuth } from '../../internal/validateM2MAuth';

export const validateUUID = () => param('uuid').isUUID(4);

const router = express.Router();

const requestValidationMiddleware = validateRequestSchema(
  z.object({
    body: z.object({
      sequenceNumber: z.number(),
      version: z.string(),
      s3Key: z.string(),
      s3Bucket: z.string(),
    }),
    params: z.object({
      uuid: z.string().uuid(),
    }),
  })
);

router.put(
  '/file/:uuid/checkpoint',
  validateM2MAuth(),
  requestValidationMiddleware,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const fileUuid = req.params.uuid;

    const result = await dbClient.$transaction(async (prisma) => {
      // Retrieve the latest checkpoint
      const lastTransactionQuery = await dbClient.file.findUniqueOrThrow({
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

      const latestCheckpoint = lastTransactionQuery.FileCheckpoint[0];

      if (latestCheckpoint.sequenceNumber > req.body.sequenceNumber) {
        throw new Error('Invalid sequence number.');
      }

      // Create a new checkpoint

      const newCheckpoint = await prisma.fileCheckpoint.create({
        data: {
          file: { connect: { uuid: fileUuid } },
          sequenceNumber: req.body.sequenceNumber,
          s3Bucket: req.body.s3Bucket,
          s3Key: req.body.s3Key,
          version: req.body.version,
        },
      });

      return newCheckpoint;
    });

    return res.status(200).json({
      fileUuid: fileUuid,
      lastCheckpoint: {
        sequenceNumber: result.sequenceNumber,
        version: result.version,
        s3Key: result.s3Key,
        s3Bucket: result.s3Bucket,
      },
    });
  }
);

export default router;
