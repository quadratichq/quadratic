import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import dbClient from '../dbClient';
import { RequestWithTeam, RequestWithUser } from '../types/Request';
import { ResponseError } from '../types/Response';
import { getTeamPermissions } from '../utils/permissions';
import { userMiddleware } from './user';
import { validateAccessToken } from './validateAccessToken';

const teamUuidSchema = z.string().uuid();

export const teamMiddleware = [validateAccessToken, userMiddleware, middleware];

/**
 * Ensures that:
 * 1. Team request is valid
 * 2. Team exists
 * 3. User has access to the team
 * And attaches data to the request about the team and the user's relationship to the team
 */
async function middleware(req: Request, res: Response<ResponseError>, next: NextFunction) {
  const {
    params: { uuid: teamUuid },
    user,
  } = req as RequestWithUser;

  // Validate the team UUID
  try {
    teamUuidSchema.parse(teamUuid);
  } catch (zodError) {
    return res.status(400).json({ error: { message: 'Invalid team UUID', meta: zodError } });
  }

  // Lookup the team
  const team = await dbClient.team.findUnique({
    where: {
      uuid: req.params.uuid,
    },
  });
  if (team === null) {
    return res.status(404).json({ error: { message: 'Team not found' } });
  }

  // Check if the user making the request has access to the team
  const userMakingRequest = await dbClient.userTeamRole.findUnique({
    where: {
      userId_teamId: {
        userId: user.id,
        teamId: team.id,
      },
    },
  });
  if (userMakingRequest === null) {
    return res.status(404).json({ error: { message: 'Team not found' } });
  }

  // TODO if the team is deleted

  // Attach info about the team and the user's access to the team on the request
  // @ts-expect-error
  (req.team as RequestWithTeam) = {
    data: team,
    user: {
      // @ts-expect-error fix types
      role: userMakingRequest.role,
      permissions: getTeamPermissions(userMakingRequest.role),
    },
  };

  next();
}
