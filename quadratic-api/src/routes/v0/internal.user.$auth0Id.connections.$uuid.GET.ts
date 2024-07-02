import { Request, Response } from 'express';
import z from 'zod';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { ApiError } from '../../utils/ApiError';

export default [validateM2MAuth(), handler];

const schema = z.object({
  params: z.object({ auth0Id: z.string(), uuid: z.string().uuid() }),
});

async function handler(req: Request, res: Response) {
  const {
    params: { auth0Id },
  } = parseRequest(req, schema);

  // TODO: (connection) Get team permissions

  // Get the user
  const user = await dbClient.user.findUnique({
    where: {
      auth0Id,
    },
  });
  if (!user) {
    throw new ApiError(400, 'The user with that auth0 ID could not be found.');
  }

  return {
    uuid: '',
    name: '',
    type: 'POSTGRES',
    createdDate: '',
    updatedDate: '',
    // TODO: (connections) fix types, don't send sensitive info
    // @ts-expect-error
    typeDetails: JSON.parse(connection.typeDetails),
  };

  // Get the connection
  // const connection = await getConnection({ uuid, userId: user.id });

  // Return the data
  // const data = {
  //   uuid: connection.uuid,
  //   name: connection.name,
  //   type: connection.type,
  //   createdDate: connection.createdDate.toISOString(),
  //   updatedDate: connection.updatedDate.toISOString(),
  //   // TODO: (connections) fix types, don't send sensitive info
  //   // @ts-expect-error
  //   typeDetails: JSON.parse(connection.typeDetails),
  // };
  // return res.status(200).json(data);
}
