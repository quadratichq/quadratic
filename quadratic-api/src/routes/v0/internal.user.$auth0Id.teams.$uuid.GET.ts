import type { Request, Response } from 'express';
import z from 'zod';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { getTeam } from '../../middleware/getTeam';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { ApiError } from '../../utils/ApiError';
import { decryptSshKeys } from '../../utils/teams';

export default [validateM2MAuth(), handler];

const schema = z.object({
  params: z.object({ auth0Id: z.string(), uuid: z.string().uuid() }),
});

async function handler(req: Request, res: Response) {
  const {
    params: { auth0Id, uuid },
  } = parseRequest(req, schema);

  // Get the user
  const user = await dbClient.user.findUnique({
    where: {
      auth0Id,
    },
  });
  if (!user) {
    throw new ApiError(400, 'The user with that auth0 ID could not be found.');
  }

  // Get the team
  const { team, userMakingRequest } = await getTeam({ uuid, userId: user.id });

  // decrypt the ssh keys
  const decryptedTeam = decryptSshKeys(team);

  // Do you have permission?
  if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to view this connection.');
  }

  // Return the data
  const data = {
    ...decryptedTeam,
  };

  return res.status(200).json(data);
}
