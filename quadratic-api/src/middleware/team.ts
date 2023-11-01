import { NextFunction, Response } from 'express';
import { z } from 'zod';
import dbClient from '../dbClient';
import { Request, RequestWithTeam, RequestWithUser } from '../types/Request';
import { ResponseError } from '../types/Response';
import { getTeamAccess } from '../utils/access';

const teamUuidSchema = z.string().uuid();

/**
 * Ensures that:
 * 1. Team request is valid
 * 2. Team exists
 * 3. User has access to the team
 * And attaches data to the request about the team and the user's relationship to the team
 */
export const teamMiddleware = async (
  req: Request & RequestWithUser & RequestWithTeam,
  res: Response<ResponseError>,
  next: NextFunction
) => {
  // Validate the team UUID
  const teamUuid = req.params.uuid;
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
        userId: req.user.id,
        teamId: team.id,
      },
    },
  });
  if (userMakingRequest === null) {
    return res.status(404).json({ error: { message: 'Team not found' } });
  }

  // TODO if the team is deleted

  // Attach info about the team and the user's access to the team on the request
  req.teamUser = {
    role: userMakingRequest.role,
    access: getTeamAccess(userMakingRequest.role),
  };
  req.team = team;

  next();
};
