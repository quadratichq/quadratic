import { Request, Response } from 'express';
import { /* ApiSchemas, */ ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { firstRoleIsHigherThanSecond } from '../../utils/permissions';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
        userId: z.coerce.number(),
      }),
      body: ApiSchemas['/v0/teams/:uuid/users/:userId.POST.request'],
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response) {
  const {
    body: { role: newRole },
    user: { id: userMakingChangeId },
    params: { uuid, userId },
  } = req as RequestWithUser;
  const {
    team: { id: teamId },
    user: teamUser,
  } = await getTeam({ uuid, userId: userMakingChangeId });
  const userBeingChangedId = Number(userId);

  // User is trying to update their own role
  if (userBeingChangedId === userMakingChangeId) {
    const currentRole = teamUser.role;

    // To the same role
    if (newRole === currentRole) {
      return res.status(204).end();
    }

    // Upgrading role
    if (firstRoleIsHigherThanSecond(newRole, currentRole)) {
      return res.status(403).json({ error: { message: 'User cannot upgrade their own role' } });
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
        return res.status(403).json({
          error: { message: 'There must be at least one owner on a team.' },
        });
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
  if (!teamUser.permissions.includes('TEAM_EDIT')) {
    return res.status(403).json({
      error: { message: 'User does not have permission to edit others' },
    });
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
    return res.status(404).json({ error: { message: 'User not found' } });
  }
  const userBeingChangedRole = userBeingChanged.role;
  const userMakingChangeRole = teamUser.role;

  // Changing to the same role?
  if (newRole === userBeingChangedRole) {
    return res.status(204).end();
  }

  // Upgrading to a role higher than their own? Not so fast!
  if (firstRoleIsHigherThanSecond(userBeingChangedRole, userMakingChangeRole)) {
    return res.status(403).json({
      error: {
        message: 'User cannot upgrade another user’s role higher than their own',
      },
    });
  }

  // Downgrading is ok!
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

  const data: ApiTypes['/v0/teams/:uuid/users/:userId.POST.response'] = { role: newUserTeamRole.role };
  return res.status(200).json(data);
}
