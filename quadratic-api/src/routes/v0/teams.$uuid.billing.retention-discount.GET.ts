import type { Request, Response } from 'express';
import z from 'zod';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getTeamRetentionDiscountEligibility } from '../../utils/teams';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response) {
  const {
    params: { uuid },
    user: { id: userId },
  } = req as RequestWithUser;
  const { userMakingRequest, team } = await getTeam({ uuid, userId });

  // Can the user do this?
  if (!userMakingRequest.permissions.includes('TEAM_MANAGE')) {
    throw new ApiError(403, 'User does not have permission to access billing for this team.');
  }

  // Get team eligibility & return it
  const { isEligible } = await getTeamRetentionDiscountEligibility(team);
  return res.status(200).json({ isEligible });
}
