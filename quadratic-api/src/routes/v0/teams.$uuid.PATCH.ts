import { Response } from 'express';
import { ApiSchemas, ApiTypes, TeamClientDataKvSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  body: ApiSchemas['/v0/teams/:uuid.PATCH.request'],
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid.PATCH.response']>) {
  const {
    body: { name, clientDataKv },
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;
  const {
    userMakingRequest: { permissions },
    team: { clientDataKv: exisitingClientDataKv },
  } = await getTeam({ uuid, userId });

  // Can the user even edit this team?
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'User does not have permission to edit this team.');
  }

  // Have they supplied _something_?
  if (!name && !clientDataKv) {
    throw new ApiError(400, '`name` or `clientDataKv` are required');
  }

  // Validate exisiting data in the db
  const validatedExisitingClientDataKv = validateClientDataKv(exisitingClientDataKv);

  console.log();
  // Update the team with supplied data
  const newTeam = await dbClient.team.update({
    where: {
      uuid,
    },
    data: {
      ...(name ? { name } : {}),
      ...(clientDataKv ? { clientDataKv: { ...validatedExisitingClientDataKv, ...clientDataKv } } : {}),
    },
  });

  // Return the new data
  const newClientDataKv = validateClientDataKv(newTeam.clientDataKv);
  return res.status(200).json({
    name: newTeam.name,
    clientDataKv: newClientDataKv,
  });
}

function validateClientDataKv(clientDataKv: unknown) {
  const parseResult = TeamClientDataKvSchema.safeParse(clientDataKv);
  if (!parseResult.success) {
    // TODO: log to sentry, this is a corrupdated data problem
    throw new ApiError(400, '`clientDataKv` must be a valid JSON object');
  }
  return parseResult.data;
}
