import type { Request, Response } from 'express';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    id: z.string().transform((v) => parseInt(v, 10)),
  }),
});

async function handler(req: Request, res: Response) {
  const {
    params: { uuid, id },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req as RequestWithUser;

  const { team, userMakingRequest } = await getTeam({ uuid, userId });

  if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You need edit permissions to delete memories');
  }

  const memory = await dbClient.aiMemory.findFirst({
    where: { id, teamId: team.id },
  });
  if (!memory) {
    throw new ApiError(404, 'Memory not found');
  }

  await dbClient.aiMemory.delete({ where: { id } });

  return res.status(200).json({ message: 'Memory deleted' });
}
