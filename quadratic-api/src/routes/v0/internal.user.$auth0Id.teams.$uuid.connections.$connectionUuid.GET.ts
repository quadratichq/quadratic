import type { Request, Response } from 'express';
import z from 'zod';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { getTeamConnection } from '../../middleware/getTeamConnection';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { ApiError } from '../../utils/ApiError';
import { decryptFromEnv } from '../../utils/crypto';

export default [validateM2MAuth(), handler];

const schema = z.object({
  params: z.object({ auth0Id: z.string(), uuid: z.string().uuid(), connectionUuid: z.string().uuid() }),
});

async function handler(req: Request, res: Response) {
  const {
    params: { auth0Id, uuid: teamUuid, connectionUuid },
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

  // Get the connection
  const { connection, team } = await getTeamConnection({ connectionUuid, teamUuid, userId: user.id });

  // Do you have permission?
  if (!team.userMakingRequest.permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to view this connection.');
  }

  const typeDetails = JSON.parse(decryptFromEnv(connection.typeDetails.toString('utf-8')));

  if (typeDetails.useSsh && team.team.sshPrivateKey) {
    typeDetails.sshKey = decryptFromEnv(team.team.sshPrivateKey.toString('utf-8'));
  }

  // Return the data
  const data = {
    uuid: connection.uuid,
    name: connection.name,
    type: connection.type,
    createdDate: connection.createdDate.toISOString(),
    updatedDate: connection.updatedDate.toISOString(),
    typeDetails,
  };

  return res.status(200).json(data);
}
