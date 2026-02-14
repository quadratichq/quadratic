import type { Request, Response } from 'express';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    fileUuid: z.string().uuid(),
  }),
});

async function handler(req: Request, res: Response) {
  const {
    params: { uuid, fileUuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req as RequestWithUser;

  const { team } = await getTeam({ uuid, userId });

  const file = await dbClient.file.findFirst({
    where: { uuid: fileUuid, ownerTeamId: team.id },
    select: { id: true },
  });
  if (!file) {
    return res.status(404).json({ error: { message: 'File not found in this team' } });
  }

  const count = await dbClient.aiMemory.count({
    where: { teamId: team.id, fileId: file.id },
  });

  return res.status(200).json({ hasMemories: count > 0 });
}
