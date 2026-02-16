import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { deleteUnclaimedFile, getUnclaimedFile } from '../../storage/storage';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { createFile } from '../../utils/createFile';
import logger from '../../utils/logger';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/embed/claim.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/embed/claim.POST.response']>) {
  const {
    body: { claimToken },
  } = parseRequest(req, schema);
  const { user } = req;

  logger.info('[Embed Claim] Received claim request', { claimToken, userId: user.id });

  const jwt = req.header('Authorization');
  if (!jwt) {
    throw new ApiError(401, 'Authorization header required');
  }

  // Find the unclaimed file
  logger.info('[Embed Claim] Looking up unclaimed file in database...');
  const unclaimedFile = await dbClient.unclaimedFile.findUnique({
    where: { claimToken },
  });

  if (!unclaimedFile) {
    logger.warn('[Embed Claim] Claim token not found', { claimToken });
    throw new ApiError(404, 'Claim token not found or has already been used');
  }

  logger.info('[Embed Claim] Found unclaimed file record', {
    storageKey: unclaimedFile.storageKey,
    version: unclaimedFile.version,
    expiresAt: unclaimedFile.expiresAt,
  });

  // Check if the file has expired
  if (unclaimedFile.expiresAt < new Date()) {
    // Clean up the expired record
    try {
      await deleteUnclaimedFile(unclaimedFile.storageKey);
    } catch (err) {
      logger.warn('Failed to delete expired storage object', { storageKey: unclaimedFile.storageKey, error: err });
    }
    await dbClient.unclaimedFile.delete({ where: { id: unclaimedFile.id } });
    throw new ApiError(410, 'Claim token has expired');
  }

  // Get the user's first team (sorted by creation date)
  const userTeamRole = await dbClient.userTeamRole.findFirst({
    where: { userId: user.id },
    orderBy: { team: { createdDate: 'asc' } },
    select: {
      team: {
        select: {
          id: true,
          uuid: true,
        },
      },
    },
  });

  if (!userTeamRole) {
    throw new ApiError(400, 'User does not belong to any team');
  }

  const team = userTeamRole.team;

  // Download the file from storage (with retries since upload may still be in progress).
  // Uses exponential backoff with jitter to avoid predictable timing.
  logger.info('[Embed Claim] Starting file download with retries...');
  let fileBuffer: Buffer | null = null;
  const maxRetries = 8;
  const baseDelayMs = 500;
  const maxDelayMs = 5000;

  // If the record was created recently, the upload is likely still in progress
  const recordAgeMs = Date.now() - unclaimedFile.createdDate.getTime();
  const skipRetries = recordAgeMs > 60_000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      logger.info('[Embed Claim] Attempt to download file', {
        attempt: attempt + 1,
        storageKey: unclaimedFile.storageKey,
      });
      fileBuffer = await getUnclaimedFile(unclaimedFile.storageKey);
      logger.info('[Embed Claim] File downloaded successfully', { size: fileBuffer.length });
      break;
    } catch (err) {
      // If the record is old, the file should already be uploaded — don't retry
      if (skipRetries) {
        logger.error('[Embed Claim] File not found and record is old, skipping retries', {
          storageKey: unclaimedFile.storageKey,
          recordAgeMs,
          error: String(err),
        });
        throw new ApiError(500, 'Failed to retrieve file data.');
      }

      if (attempt < maxRetries - 1) {
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * baseDelayMs;
        const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

        logger.info('[Embed Claim] File not ready, retrying...', {
          storageKey: unclaimedFile.storageKey,
          attempt: attempt + 1,
          maxRetries,
          delayMs: Math.round(delay),
          error: String(err),
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error('[Embed Claim] Failed to download unclaimed file from storage after retries', {
          storageKey: unclaimedFile.storageKey,
          error: err,
        });
        throw new ApiError(500, 'Failed to retrieve file data. The file may still be uploading.');
      }
    }
  }

  if (!fileBuffer) {
    throw new ApiError(500, 'Failed to retrieve file data');
  }

  // Convert to base64 for createFile
  const contents = fileBuffer.toString('base64');
  logger.info('[Embed Claim] File converted to base64', { base64Length: contents.length });

  // Create the file in the user's team (as a private file)
  logger.info('[Embed Claim] Creating file in database...', { teamId: team.id, userId: user.id });
  const fileName = 'Imported Spreadsheet';
  const dbFile = await createFile({
    name: fileName,
    userId: user.id,
    teamId: team.id,
    contents,
    version: unclaimedFile.version,
    isPrivate: true,
    jwt,
  });
  logger.info('[Embed Claim] File created successfully', { fileUuid: dbFile.uuid });

  // Clean up the unclaimed file
  try {
    await deleteUnclaimedFile(unclaimedFile.storageKey);
  } catch (err) {
    logger.warn('Failed to delete claimed storage object', { storageKey: unclaimedFile.storageKey, error: err });
  }
  await dbClient.unclaimedFile.delete({ where: { id: unclaimedFile.id } });

  logger.info('File claimed successfully', { fileUuid: dbFile.uuid, userId: user.id });

  const redirectUrl = `/file/${dbFile.uuid}`;

  return res.status(201).json({
    file: {
      uuid: dbFile.uuid,
      name: dbFile.name,
    },
    team: {
      uuid: team.uuid,
    },
    redirectUrl,
  });
}
