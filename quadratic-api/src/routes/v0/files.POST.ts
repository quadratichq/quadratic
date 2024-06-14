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
    body: { name, contents, version, teamUuid, isPersonal },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;

  // Check that the team exists and the user can create in it
  const {
    team: { id: teamId },
    userMakingRequest,
  } = await getTeam({ uuid: teamUuid, userId });

  // Can you even create a file in this team?
  if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'User does not have permission to create a file in this team.');
  }

  const dbFile = await createFile({ name, userId, teamId, contents, version, isPersonal });

  return res.status(201).json({
    file: { uuid: dbFile.uuid, name: dbFile.name },
    team: {
      // TODO: (team-schema) we can change this to dbFile.ownerTeam.uuid once we
      // update the team schema so ownerTeam is required
      uuid: teamUuid, // dbFile.ownerTeam.uuid
    },
  });
}
