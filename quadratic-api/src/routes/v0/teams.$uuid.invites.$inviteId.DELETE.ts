import { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
        inviteId: z.coerce.number(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response) {
  const {
    params: { uuid, inviteId },
    user: { id: userId },
  } = req as RequestWithUser;
  const inviteToDelete = Number(inviteId);
  const { user: userMakingRequest } = await getTeam({ uuid, userId });

  // TODO: write tests for this endpoint

  // User making the request can edit the team
  if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
    return res.status(403).json({
      error: { message: 'User does not have access to edit this team' },
    });
  }

  // Ok, delete the invite
  await dbClient.teamInvite.delete({
    where: {
      id: inviteToDelete,
    },
  });
  const data: ApiTypes['/v0/teams/:uuid/invites/:inviteId.DELETE.response'] = { message: 'Invite deleted' };
  return res.status(200).json(data);
}
