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
    body: { name, ownerUserId },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;
  const {
    userMakingRequest: { filePermissions, id: userMakingRequestId },
  } = await getFile({ uuid, userId });

  // Can't change both at once
  if (ownerUserId && name) {
    return res.status(400).json({ error: { message: 'You can only change one thing at a time' } });
  }

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

  // Do you have permission to move? (You can't move someone else's private file, for example)
  if (!filePermissions.includes(FILE_MOVE)) {
    throw new ApiError(403, 'Permission denied');
  }

  // Moving to a user's private (team) files?
  if (ownerUserId) {
    // The specified user must be the same person making the request
    if (ownerUserId !== userMakingRequestId) {
      throw new ApiError(400, 'You can only move your own files');
    }

    const modifiedFile = await dbClient.file.update({
      where: {
        uuid,
      },
      data: {
        ownerUserId,
      },
    });
    if (!modifiedFile.ownerUserId) {
      throw new ApiError(500, 'Failed to move file. Make sure the specified file and user exist.');
    }
    return res.status(200).json({ ownerUserId: modifiedFile.ownerUserId });
  }

  // Moving to a team's public files?
  if (ownerUserId === null) {
    const modifiedFile = await dbClient.file.update({
      where: {
        uuid,
      },
      data: {
        ownerUserId: null,
      },
    });
    if (modifiedFile.ownerUserId !== null) {
      throw new ApiError(500, 'Failed to move file. Make sure the specified team and user exist.');
    }
    return res.status(200).json({ ownerUserId: undefined });
  }

  // We don’t know what you're asking for
  return res.status(400).json({ error: { message: 'Invalid request' } });
}
