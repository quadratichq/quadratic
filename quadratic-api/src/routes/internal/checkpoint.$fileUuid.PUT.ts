import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import express from 'express';
import { param, validationResult } from 'express-validator';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';

export const validateUUID = () => param('uuid').isUUID(4);

const router = express.Router();

const requestValidationMiddleware = validateRequestSchema(
  z.object({
    body: z.object({
      sequenceNumber: z.number(),
      version: z.string(),
      s3Key: z.string(),
      s3Bucket: z.string(),
      // Require non-empty hash to prevent false positives when querying for duplicates
      transactionsHash: z.string().min(1, 'transactionsHash must not be empty'),
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
    const { sequenceNumber, version, s3Key, s3Bucket, transactionsHash } = req.body;

    const buildResponse = (checkpoint: {
      sequenceNumber: number;
      version: string;
      s3Key: string;
      s3Bucket: string;
    }) => ({
      fileUuid,
      lastCheckpoint: {
        sequenceNumber: checkpoint.sequenceNumber,
        version: checkpoint.version,
        s3Key: checkpoint.s3Key,
        s3Bucket: checkpoint.s3Bucket,
      },
    });

    try {
      const result = await dbClient.$transaction(async (prisma) => {
        // Retrieve the latest checkpoint
        const lastTransactionQuery = await prisma.file.findUniqueOrThrow({
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

        if (latestCheckpoint.sequenceNumber > sequenceNumber) {
          throw new Error('Invalid sequence number.');
        }

        // Create a new checkpoint
        const newCheckpoint = await prisma.fileCheckpoint.create({
          data: {
            file: { connect: { uuid: fileUuid } },
            sequenceNumber,
            s3Bucket,
            s3Key,
            version,
            transactionsHash,
          },
        });

        // Update when the file was last modified
        await prisma.file.update({
          where: { uuid: fileUuid },
          data: { updatedDate: new Date() },
        });

        return newCheckpoint;
      });

      return res.status(200).json(buildResponse(result));
    } catch (error) {
      // Handle unique constraint violation (P2002) which indicates a duplicate checkpoint
      // This can happen when concurrent requests try to create a checkpoint with the same sequenceNumber
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Query for the existing checkpoint by transactionsHash to verify it's a true duplicate
        // Note: There's a small window where another request could have created the checkpoint
        // between the transaction failure and this query, but this is acceptable since we're
        // simply returning the existing checkpoint data in that case.
        const file = await dbClient.file.findUnique({
          where: { uuid: fileUuid },
          include: {
            FileCheckpoint: {
              where: { transactionsHash },
              take: 1,
            },
          },
        });

        const existingCheckpoint = file?.FileCheckpoint[0];

        if (existingCheckpoint) {
          // Duplicate detected - return success with the existing checkpoint
          return res.status(200).json(buildResponse(existingCheckpoint));
        }
      }

      // Not a duplicate - return an appropriate error response
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Checkpoint creation failed:', error);
      return res.status(500).json({ error: `Failed to create checkpoint: ${errorMessage}` });
    }
  }
);

export default router;
