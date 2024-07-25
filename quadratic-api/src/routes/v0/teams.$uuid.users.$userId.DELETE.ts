import { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { removeUserFromTeam } from '../../internal/removeUserFromTeam';
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
    userId: z.coerce.number(),
  }),
});

async function handler(req: Request, res: Response<ApiTypes['/v0/teams/:uuid/users/:userId.DELETE.response']>) {
  const {
    params: { userId: userToDeleteId },
  } = parseRequest(req, schema);
  const {
    user: { id: userMakingRequestId },
  } = req as RequestWithUser;
  const {
    team: { id: teamId },
    userMakingRequest,
  } = await getTeam({ uuid: req.params.uuid, userId: userMakingRequestId });
  const resSuccess = { message: 'User deleted' };

  // Allow the user to delete themselves from a team
  if (userMakingRequestId === userToDeleteId) {
    // If they're the owner, make sure there's another owner before deleting
    if (userMakingRequest.role === 'OWNER') {
      const teamOwners = await dbClient.userTeamRole.findMany({
        where: {
          teamId,
          role: 'OWNER',
        },
      });
      if (teamOwners.length <= 1) {
        throw new ApiError(403, 'There must be at least one owner on a team.');
      }
    }

    // Delete!
    await removeUserFromTeam(userToDeleteId, teamId);
    return res.status(200).json({ ...resSuccess, redirect: true });
  }

  // Ok, now we've handled if the user tries to remove themselves from a team.
  // From here on, it's a user trying to delete another user

  // User making the request can edit the team
  if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'User does not have permission to edit this team');
  }

  // Get the user that's being deleted
  const userToDelete = await dbClient.userTeamRole.findUnique({
    where: {
      userId_teamId: {
        userId: userToDeleteId,
        teamId,
      },
    },
  });
  // Ensure they exist
  if (!userToDelete) {
    throw new ApiError(404, 'User not found');
  }
  // And make sure they have a role equal to or lower than the deleter
  if (userMakingRequest.role === 'EDITOR' && userToDelete.role === 'OWNER') {
    throw new ApiError(403, 'User does not have the ability to delete an owner');
  }

  // Ok, now we're good to remove the user
  await removeUserFromTeam(userToDeleteId, teamId);
  return res.status(200).json(resSuccess);
}
