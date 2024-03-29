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

  const dbFile = await createFile({ name, userId, teamId, contents, version });

  return res.status(201).json({
    file: { uuid: dbFile.uuid, name: dbFile.name },
    team: dbFile.ownerTeam ? { uuid: dbFile.ownerTeam.uuid } : undefined,
  });
}
