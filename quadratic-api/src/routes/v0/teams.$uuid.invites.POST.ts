import { Request, Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { lookupUsersFromAuth0ByEmail } from '../../auth0/profile';
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
      }),
      body: ApiSchemas['/v0/teams/:uuid/invites.POST.request'],
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response) {
  const {
    body: { email, role },
    params: { uuid },
    user: { id: userId },
  } = req as RequestWithUser;
  const {
    team: { id: teamId },
    user: teamUser,
  } = await getTeam({ uuid, userId });

  const userMakingRequestRole = teamUser.role;

  // Can you even invite others?
  if (!teamUser.permissions.includes('TEAM_EDIT')) {
    return res.status(403).json({
      error: {
        message: 'User does not have permission to invite other users to this team.',
      },
    });
  }

  // Are you trying to invite someone to a role higher than your own? No go
  if (firstRoleIsHigherThanSecond(role, userMakingRequestRole)) {
    return res.status(403).json({
      error: {
        message: 'User cannot invite someone to a role higher than their own.',
      },
    });
  }

  // Look up the invited user by email in Auth0
  const auth0Users = await lookupUsersFromAuth0ByEmail(email);

  // Nobody with an account by that email
  if (auth0Users.length === 0) {
    // TODO: where do we remove them from this table once they become a user?
    // TODO: write tests for this

    // TODO: figure out why this crashes the server (when adding a user in the UI)
    // const existingInvite = await dbClient.teamInvite.findFirst({
    //   where: {
    //     email,
    //     teamId,
    //   },
    // });
    // console.log('exisiting invite', existingInvite);
    // if (existingInvite) {
    //   return res.status(409).json({ error: { message: 'User has already been invited to this team' } });
    // }
    // console.log('creating invite', email, role, teamId);
    // // Invite the person!
    // const dbInvite = await dbClient.teamInvite.create({
    //   data: {
    //     email,
    //     role,
    //     teamId,
    //   },
    // });

    // See if this email already exists as an invite on the team and invite them
    const dbInvite = await dbClient.teamInvite.upsert({
      where: {
        email_teamId: {
          email,
          teamId,
        },
      },
      create: {
        email,
        role,
        teamId,
      },
      update: {
        role,
      },
    });

    // TODO: send the invited person an email

    return res.status(201).json({ email, role, id: dbInvite.id });
  }

  // Somebody with that email already has an account
  if (auth0Users.length === 1) {
    const auth0User = auth0Users[0];

    // Auth0 says this could be undefined. If that's the case (even though,
    // we found a user) we'll throw an error
    if (!auth0User.user_id) {
      return res
        .status(500)
        .json({ error: { message: 'Internal server error: user found but expected `user_id` is not present' } });
    }

    // Lookup the user in our database (create if they don't exist)
    const dbUser = await dbClient.user.upsert({
      where: {
        auth0Id: auth0User.user_id,
      },
      create: {
        auth0Id: auth0User.user_id,
      },
      update: {},
    });

    // See if they're already a member of the team
    const u = await dbClient.userTeamRole.findUnique({
      where: {
        userId_teamId: {
          userId: dbUser.id,
          teamId,
        },
      },
    });
    if (u !== null) {
      return res.status(400).json({
        error: { message: 'User is already a member of this team' },
      });
    }

    // If not, add them!
    await dbClient.userTeamRole.create({
      data: {
        userId: dbUser.id,
        teamId,
        role,
      },
    });

    // TODO: send them an email

    // TODO: what to return exactly...?
    const data: ApiTypes['/v0/teams/:uuid/invites.POST.response'] = { email, role, id: dbUser.id };
    return res.status(201).json(data);
  }

  // TODO:, how should we handle duplicate email?
  // TODO: don't allow people to create multiple accounts with one email in auth0
  // TODO: talk to David K.
  return res.status(500).json({ error: { message: 'Internal server error: duplicate email' } });
}
