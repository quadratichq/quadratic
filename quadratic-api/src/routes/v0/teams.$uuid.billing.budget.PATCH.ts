import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { reportAndTrackOverage } from '../../billing/aiCostTracking.helper';
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
    teamMonthlyBudgetLimit: z.number().positive().nullable(),
  }),
});

export default [validateAccessToken, userMiddleware, handler];

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/billing/budget.PATCH.response'] | ResponseError>
) {
  const { id: userId } = req.user;
  const {
    params: { uuid },
    body: { teamMonthlyBudgetLimit },
  } = parseRequest(req, schema);
  const { userMakingRequest, team } = await getTeam({ uuid, userId });

  if (!userMakingRequest.permissions.includes('TEAM_MANAGE')) {
    return res.status(403).json({ error: { message: 'You do not have permission to set budget limits.' } });
  }

  // Budget limits are only available for Business plan
  const isBusiness = isBusinessPlan(team);
  if (!isBusiness) {
    return res.status(400).json({
      error: { message: 'Budget limits are only available for Business plan.' },
    });
  }

  const updatedTeam = await dbClient.team.update({
    where: { uuid },
    data: {
      teamMonthlyBudgetLimit: teamMonthlyBudgetLimit,
    },
  });

  // Bill any previously unbilled overage that now falls within the new limit
  await reportAndTrackOverage(updatedTeam.id);

  const data: ApiTypes['/v0/teams/:uuid/billing/budget.PATCH.response'] = {
    teamMonthlyBudgetLimit,
  };

  return res.status(200).json(data);
}
