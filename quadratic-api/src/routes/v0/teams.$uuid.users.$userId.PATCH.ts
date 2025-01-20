import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ApiSchemas } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { firstRoleIsHigherThanSecond } from '../../utils/permissions';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    userId: z.coerce.number(),
  }),
  body: ApiSchemas['/v0/teams/:uuid/users/:userId.PATCH.request'],
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/teams/:uuid/users/:userId.PATCH.response']>) {
  const {
    body: { role: newRole },
    params: { uuid, userId: userBeingChangedId },
  } = parseRequest(req, schema);
  const {
    user: { id: userMakingChangeId },
  } = req;
  const {
    team: { id: teamId },
    userMakingRequest,
  } = await getTeam({ uuid, userId: userMakingChangeId });

  // User is trying to update their own role
  if (userBeingChangedId === userMakingChangeId) {
    const currentRole = userMakingRequest.role;

    // To the same role
    if (newRole === currentRole) {
      return res.status(200).json({ role: currentRole });
    }

    // Upgrading role
    if (firstRoleIsHigherThanSecond(newRole, currentRole)) {
      throw new ApiError(403, 'Cannot upgrade your own role');
    }

    // Downgrading role
    // OWNER can only downgrade if there’s one other owner on the team
    if (currentRole === 'OWNER') {
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
    // Make the change!
    const newUserTeamRole = await dbClient.userTeamRole.update({
      where: {
        userId_teamId: {
          userId: userBeingChangedId,
          teamId: teamId,
        },
      },
      data: {
        role: newRole,
      },
    });
    return res.status(200).json({ role: newUserTeamRole.role });
  }

  // If we hit here, the user is trying to change somebody else's role
  // So we'll check and make sure they can

  // First, can they do this?
  if (!userMakingRequest.permissions.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You do not have permission to edit others');
  }

  // Lookup the user that's being changed and their current role
  const userBeingChanged = await dbClient.userTeamRole.findUnique({
    where: {
      userId_teamId: {
        userId: userBeingChangedId,
        teamId,
      },
    },
  });
  if (userBeingChanged === null) {
    throw new ApiError(404, 'User not found');
  }
  const userBeingChangedRole = userBeingChanged.role;
  const userMakingChangeRole = userMakingRequest.role;

  // Changing to the same role?
  if (newRole === userBeingChangedRole) {
    return res.status(200).json({ role: newRole });
  }

  // Upgrading someone to a role higher than your own? Not so fast!
  if (firstRoleIsHigherThanSecond(newRole, userMakingChangeRole)) {
    throw new ApiError(403, 'You cannot upgrade another user to a role higher than your own');
  }

  // Downgrading someone with a role higher than your own? Not so fast!
  if (firstRoleIsHigherThanSecond(userBeingChangedRole, userMakingChangeRole)) {
    throw new ApiError(403, 'You cannot downgrade another user who has a role higher than your own');
  }

  // Change is ok!
  const newUserTeamRole = await dbClient.userTeamRole.update({
    where: {
      userId_teamId: {
        userId: userBeingChangedId,
        teamId: teamId,
      },
    },
    data: {
      role: newRole,
    },
  });

  return res.status(200).json({ role: newUserTeamRole.role });
}
