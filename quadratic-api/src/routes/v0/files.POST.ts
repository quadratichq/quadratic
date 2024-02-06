import { Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { uploadStringAsFileS3 } from '../../aws/s3';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/files.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files.POST.response']>) {
  const {
    body: { name, contents, version, teamUuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  // Trying to create a file in a team?
  let teamId = undefined;
  if (teamUuid) {
    // Check that the team exists and the user can create in it
    const {
      team: { id },
      userMakingRequest,
    } = await getTeam({ uuid: teamUuid, userId });
    teamId = id;

    // Can you even create a file in this team?
    if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
      throw new ApiError(403, 'User does not have permission to create a file in this team.');
    }
  }

  // Create file in db
  const dbFile = await dbClient.file.create({
    data: {
      creatorUserId: userId,
      name,
      // Team file or personal file?
      ...(teamId ? { ownerTeamId: teamId } : { ownerUserId: userId }),
    },
    select: {
      id: true,
      uuid: true,
      name: true,
      createdDate: true,
      updatedDate: true,
    },
  });

  // Upload file contents to S3 and create a checkpoint
  const { uuid, id: fileId } = dbFile;
  const response = await uploadStringAsFileS3(`${uuid}-0.grid`, contents);

  await dbClient.fileCheckpoint.create({
    data: {
      fileId,
      sequenceNumber: 0,
      s3Bucket: response.bucket,
      s3Key: response.key,
      version: version,
    },
  });

  return res.status(201).json({
    ...dbFile,
    createdDate: dbFile.createdDate.toISOString(),
    updatedDate: dbFile.updatedDate.toISOString(),
  });
}
