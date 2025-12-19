import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    inviteId: z.coerce.number(),
  }),
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/teams/:uuid/invites/:inviteId.DELETE.response']>
) {
  const {
    params: { uuid, inviteId },
  } = parseRequest(req, schema);
  const {
    user: { id: userId },
  } = req;
  const {
    team: { id: teamId },
    userMakingRequest: { permissions },
  } = await getTeam({ uuid, userId });

  // User making the request can edit the team
  if (!permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'User does not have permission to edit this team.');
  }

  // Does the invite exist?
  const invite = await dbClient.teamInvite.findFirst({
    where: {
      id: inviteId,
      teamId,
    },
  });
  if (!invite) {
    throw new ApiError(404, 'Invite does not exist');
  }

  // Can only delete pending invites
  if (invite.status !== 'PENDING') {
    throw new ApiError(400, 'Can only delete pending invites');
  }

  // Soft delete by updating status
  await dbClient.teamInvite.update({
    where: {
      id: inviteId,
    },
    data: {
      status: 'DELETED',
    },
  });

  return res.status(200).json({ message: 'Invite deleted' });
}
