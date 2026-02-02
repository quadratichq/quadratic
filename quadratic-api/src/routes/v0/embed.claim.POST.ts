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

  const jwt = req.header('Authorization');
  if (!jwt) {
    throw new ApiError(401, 'Authorization header required');
  }

  // Find the unclaimed file
  const unclaimedFile = await dbClient.unclaimedFile.findUnique({
    where: { claimToken },
  });

  if (!unclaimedFile) {
    throw new ApiError(404, 'Claim token not found or has already been used');
  }

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

  // Download the file from storage (with retries since upload may still be in progress)
  let fileBuffer: Buffer | null = null;
  const maxRetries = 10;
  const retryDelayMs = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      fileBuffer = await getUnclaimedFile(unclaimedFile.storageKey);
      break; // Success, exit loop
    } catch (err) {
      if (attempt < maxRetries - 1) {
        // File not ready yet, wait and retry
        logger.info('File not ready, retrying...', {
          storageKey: unclaimedFile.storageKey,
          attempt: attempt + 1,
          maxRetries,
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      } else {
        // Final attempt failed
        logger.error('Failed to download unclaimed file from storage after retries', {
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

  // Create the file in the user's team (as a private file)
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
