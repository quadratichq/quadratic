import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas, TeamClientDataKvSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
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
    body: { name, clientDataKv, settings },
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;
  const {
    userMakingRequest: { permissions },
    team: { clientDataKv: exisitingClientDataKv },
  } = await getTeam({ uuid, userId });

  // Can they make the edits they’re trying to make?
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'User does not have permission to edit this team.');
  }
  if (settings && !permissions.includes('TEAM_MANAGE')) {
    throw new ApiError(403, 'User does not have permission to edit this team’s settings.');
  }

  // Validate exisiting data in the db
  const validatedExisitingClientDataKv = validateClientDataKv(exisitingClientDataKv);

  // Update the team with supplied data
  const newTeam = await dbClient.team.update({
    where: {
      uuid,
    },
    data: {
      ...(name ? { name } : {}),
      ...(clientDataKv ? { clientDataKv: { ...validatedExisitingClientDataKv, ...clientDataKv } } : {}),
      ...(settings ? { settingAnalyticsAi: settings.analyticsAi } : {}),
    },
  });

  // Return the new data
  const newClientDataKv = validateClientDataKv(newTeam.clientDataKv);

  return res.status(200).json({
    name: newTeam.name,
    clientDataKv: newClientDataKv,
    settings: {
      analyticsAi: newTeam.settingAnalyticsAi,
    },
  });
}

function validateClientDataKv(clientDataKv: unknown) {
  const parseResult = TeamClientDataKvSchema.safeParse(clientDataKv);
  if (!parseResult.success) {
    throw new ApiError(500, '`clientDataKv` must be a valid JSON object');
  }
  return parseResult.data;
}
