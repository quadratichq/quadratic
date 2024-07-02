import { Request, Response } from 'express';
import z from 'zod';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { getConnection } from '../../middleware/getConnection';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { ApiError } from '../../utils/ApiError';

export default [validateM2MAuth(), handler];

const schema = z.object({
  params: z.object({ auth0Id: z.string(), uuid: z.string().uuid() }),
});

async function handler(req: Request, res: Response) {
  const {
    params: { auth0Id, uuid },
  } = parseRequest(req, schema);
  console.log('runs');

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
  const { connection, team } = await getConnection({ uuid, userId: user.id });

  // Do you have permission?
  if (!team.userMakingRequest.permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to view this connection.');
  }

  // TODO: (connections) David D: allow password to be undefined
  // @ts-expect-error
  let typeDetails = JSON.parse(connection.typeDetails);
  if (!typeDetails.password) {
    typeDetails.password = '';
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
