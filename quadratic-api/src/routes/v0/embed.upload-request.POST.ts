import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { deleteUnclaimedFile, getUnclaimedFileUploadUrl } from '../../storage/storage';
import { ApiError } from '../../utils/ApiError';
import logger from '../../utils/logger';

// No authentication required - this endpoint is for anonymous embed users
export default [handler];

const schema = z.object({
  body: ApiSchemas['/v0/embed/upload-request.POST.request'],
});

async function handler(req: Request, res: Response<ApiTypes['/v0/embed/upload-request.POST.response']>) {
  const {
    body: { version },
  } = parseRequest(req, schema);

  const claimToken = crypto.randomUUID();
  logger.info('[Embed Upload] Received upload request', { claimToken, version });

  const storageKey = `unclaimed/${claimToken}.grid`;
  logger.info('[Embed Upload] Storage key:', { storageKey });

  // Set expiration to 24 hours from now
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await dbClient.unclaimedFile.create({
    data: {
      claimToken,
      storageKey,
      version,
      expiresAt,
    },
  });
  logger.info('[Embed Upload] Database record created');

  const uploadUrl = await getUnclaimedFileUploadUrl(storageKey);
  logger.info('[Embed Upload] Upload URL generated');

  void cleanupExpiredUnclaimedFiles().catch((err) => {
    logger.error('Failed to cleanup expired unclaimed files', err);
  });

  return res.status(200).json({
    uploadUrl,
    claimToken,
  });
}

/**
 * Opportunistic cleanup of expired unclaimed files.
 * Runs asynchronously without blocking the main request.
 * Limits to 10 records per cleanup to avoid long-running operations.
 */
async function cleanupExpiredUnclaimedFiles(): Promise<void> {
  const expired = await dbClient.unclaimedFile.findMany({
    where: { expiresAt: { lt: new Date() } },
    take: 10,
  });

  for (const file of expired) {
    try {
      // Delete the storage object
      await deleteUnclaimedFile(file.storageKey);
    } catch (err) {
      // Storage object may not exist (upload never completed), continue with DB cleanup
      logger.warn('Failed to delete storage object for unclaimed file', { storageKey: file.storageKey, error: err });
    }

    // Delete the database record (deleteMany is idempotent if another request already deleted it)
    await dbClient.unclaimedFile.deleteMany({ where: { id: file.id } });
  }

  if (expired.length > 0) {
    logger.info(`Cleaned up ${expired.length} expired unclaimed files`);
  }
}
