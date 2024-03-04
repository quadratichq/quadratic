import { Response } from 'express';
import { ApiSchemas, ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ResponseError } from '../../types/Response';
import { ApiError } from '../../utils/ApiError';
const { FILE_EDIT, FILE_MOVE } = FilePermissionSchema.enum;

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: ApiSchemas['/v0/files/:uuid.PATCH.request'],
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/files/:uuid.PATCH.response'] | ResponseError>
) {
  const {
    params: { uuid },
    body: { name, ownerUserId, ownerTeamId },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;
  const {
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId });

  // Can they edit this file?
  if (!filePermissions.includes(FILE_EDIT)) {
    return res.status(403).json({ error: { message: 'Permission denied' } });
  }

  //
  // Updating the name?
  //
  if (name) {
    const { name: newName } = await dbClient.file.update({
      where: {
        uuid,
      },
      data: {
        name,
      },
    });
    return res.status(200).json({ name: newName });
  }

  //
  // Moving the file?
  //

  // We won't accept a request to do both. That's invalid.
  if (ownerUserId && ownerTeamId) {
    throw new ApiError(400, 'Cannot move to both a user and a team');
  }

  // Ensure that either the specified user or team exists
  if (ownerUserId) {
    const user = await dbClient.user.findUnique({ where: { id: ownerUserId } });
    if (!user) {
      throw new ApiError(400, 'User does not exist');
    }
  }
  if (ownerTeamId) {
    const team = await dbClient.team.findUnique({ where: { id: ownerTeamId } });
    if (!team) {
      throw new ApiError(400, 'Team does not exist');
    }
  }

  // Do you have permission to move?
  // (Permissions must come after knowing a team exists otherwise you get
  // a 403 for a team that doesn’t exist)
  if (!filePermissions.includes(FILE_MOVE)) {
    throw new ApiError(403, 'Permission denied');
  }

  // Moving to a user?
  if (ownerUserId) {
    const newFile = await dbClient.file.update({
      where: {
        uuid,
      },
      data: {
        ownerUserId,
        ownerTeamId: null,
      },
    });
    if (!newFile.ownerUserId) {
      throw new ApiError(500, 'Failed to move file. Make sure the specified file and user exist.');
    }
    return res.status(200).json({ ownerUserId: newFile.ownerUserId });
  }

  // Moving to a team?
  if (ownerTeamId) {
    const newFile = await dbClient.file.update({
      where: {
        uuid,
      },
      data: {
        ownerUserId: null,
        ownerTeamId,
      },
    });
    if (!newFile.ownerTeamId) {
      throw new ApiError(500, 'Failed to move file. Make sure the specified team and user exist.');
    }
    return res.status(200).json({ ownerTeamId: newFile.ownerTeamId });
  }

  // We don’t know what you're asking for
  return res.status(400).json({ error: { message: 'Invalid request' } });
}
