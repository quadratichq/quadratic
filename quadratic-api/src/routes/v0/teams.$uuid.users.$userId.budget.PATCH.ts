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
    userId: z.coerce.number(),
  }),
  body: z.object({
    monthlyBudgetLimit: z.number().positive().nullable(),
  }),
});

export default [validateAccessToken, userMiddleware, handler];

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/users/:userId/budget.PATCH.response'] | ResponseError>
) {
  const { id: currentUserId } = req.user;
  const {
    params: { uuid, userId },
    body: { monthlyBudgetLimit },
  } = parseRequest(req, schema);
  const { userMakingRequest, team } = await getTeam({ uuid, userId: currentUserId });

  // Only team owners can set user budget limits
  if (!userMakingRequest.permissions.includes('TEAM_MANAGE')) {
    return res.status(403).json({ error: { message: 'Only team owners can set user budget limits.' } });
  }

  // Verify the user is a member of the team
  const userTeamRole = await dbClient.userTeamRole.findUnique({
    where: {
      userId_teamId: {
        userId,
        teamId: team.id,
      },
    },
  });

  if (!userTeamRole) {
    return res.status(404).json({ error: { message: 'User is not a member of this team.' } });
  }

  // Budget limits are only available for Business plan
  const isBusiness = isBusinessPlan(team);
  if (!isBusiness) {
    return res.status(400).json({
      error: { message: 'User budget limits are only available for Business plan.' },
    });
  }

  if (monthlyBudgetLimit === null) {
    // Remove budget limit
    await dbClient.userBudgetLimit.deleteMany({
      where: {
        userId,
        teamId: team.id,
      },
    });

    return res.status(200).json({
      monthlyBudgetLimit: null,
    });
  }

  // Upsert budget limit
  const budgetLimit = await dbClient.userBudgetLimit.upsert({
    where: {
      userId_teamId: {
        userId,
        teamId: team.id,
      },
    },
    create: {
      userId,
      teamId: team.id,
      monthlyBudgetLimit,
    },
    update: {
      monthlyBudgetLimit,
      updatedDate: new Date(),
    },
  });

  const data: ApiTypes['/v0/teams/:uuid/users/:userId/budget.PATCH.response'] = {
    monthlyBudgetLimit: budgetLimit.monthlyBudgetLimit,
  };

  return res.status(200).json(data);
}
