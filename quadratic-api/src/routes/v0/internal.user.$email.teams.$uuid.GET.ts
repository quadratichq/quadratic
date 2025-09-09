import type { Request, Response } from 'express';
import z from 'zod';
import dbClient from '../../dbClient';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { getTeam } from '../../middleware/getTeam';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { ApiError } from '../../utils/ApiError';
import { getDecryptedTeam } from '../../utils/teams';

export default [validateM2MAuth(), handler];

const schema = z.object({
  params: z.object({ email: z.string(), uuid: z.string().uuid() }),
});

async function handler(req: Request, res: Response) {
  const {
    params: { email, uuid },
  } = parseRequest(req, schema);

  // Get the user
  const user = await dbClient.user.findUnique({
    where: {
      email,
    },
  });
  if (!user) {
    throw new ApiError(400, 'The user with that email could not be found.');
  }

  // Get the team
  const { team } = await getTeam({ uuid, userId: user.id });
  const decryptedTeam = await getDecryptedTeam(team);

  // Return the data
  const data = { ...decryptedTeam };

  return res.status(200).json(data);
}
