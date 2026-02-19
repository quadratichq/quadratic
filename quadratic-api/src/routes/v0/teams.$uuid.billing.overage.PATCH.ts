import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { isBusinessPlan } from '../../billing/planHelpers';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: z.object({
    allowOveragePayments: z.boolean(),
  }),
});

export default [validateAccessToken, userMiddleware, handler];

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/billing/overage.PATCH.response'] | ResponseError>
) {
  const { id: userId } = req.user;
  const {
    params: { uuid },
    body: { allowOveragePayments },
  } = parseRequest(req, schema);
  const { userMakingRequest, team } = await getTeam({ uuid, userId });

  // Only team owners can toggle overage payments
  if (!userMakingRequest.permissions.includes('TEAM_MANAGE')) {
    return res.status(403).json({ error: { message: 'Only team owners can toggle overage payments.' } });
  }

  // Overage payments are only available for Business plan
  const isBusiness = isBusinessPlan(team);
  if (!isBusiness) {
    return res.status(400).json({
      error: { message: 'Overage payments are only available for Business plan.' },
    });
  }

  await dbClient.team.update({
    where: { uuid },
    data: {
      allowOveragePayments,
    },
  });

  const data: ApiTypes['/v0/teams/:uuid/billing/overage.PATCH.response'] = {
    allowOveragePayments,
  };

  return res.status(200).json(data);
}
