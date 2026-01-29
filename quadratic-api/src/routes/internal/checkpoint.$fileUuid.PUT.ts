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

        if (!latestCheckpoint) {
          throw new Error('No existing checkpoint found for file.');
        }

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
      // Handle unique constraint violation (P2002) on (fileId, sequenceNumber)
      // This can happen when concurrent requests try to create a checkpoint with the same sequenceNumber
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Query for the existing checkpoint by transactionsHash to verify it's a true duplicate.
        // Since sequenceNumber is included in the hash, a matching hash confirms it's the same
        // checkpoint being processed twice (idempotent retry).
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
          // True duplicate - return success with the existing checkpoint
          return res.status(200).json(buildResponse(existingCheckpoint));
        }

        // No matching hash found - this indicates a conflict (different transactions
        // trying to claim the same sequence number)
        return res.status(409).json({
          error: `Sequence number ${sequenceNumber} already exists with different transactions`,
        });
      }

      // Other error - return an appropriate error response
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Checkpoint creation failed:', error);
      return res.status(500).json({ error: `Failed to create checkpoint: ${errorMessage}` });
    }
  }
);

export default router;
