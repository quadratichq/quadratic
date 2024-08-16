import { Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { createFile } from '../../utils/createFile';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/files.POST.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files.POST.response']>) {
  const {
    body: { name, contents, version, teamUuid, isPrivate },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  // Check that the team exists and the user can create in it
  const {
    team: { id: teamId },
    userMakingRequest: { permissions: teamPermissions },
  } = await getTeam({ uuid: teamUuid, userId });
  const canView = teamPermissions.includes('TEAM_VIEW');
  const canEdit = teamPermissions.includes('TEAM_EDIT');

  // Can they view OR edit the team?
  if (!(canView || canEdit)) {
    throw new ApiError(403, 'User does not have permission to create a file in this team.');
  }

  // If they can only view the team, are they trying to create a public file?
  if (!canEdit && !isPrivate) {
    throw new ApiError(403, 'User does not have permission to create a public file in this team.');
  }

  try {
    // Ok, create it!
    const dbFile = await createFile({ name, userId, teamId, contents, version, isPrivate });
    return res.status(201).json({
      file: { uuid: dbFile.uuid, name: dbFile.name },
      team: {
        uuid: (dbFile.ownerTeam as any).uuid,
      },
    });
  } catch (e) {
    throw new ApiError(500, 'Failed to create file', e);
  }
}
