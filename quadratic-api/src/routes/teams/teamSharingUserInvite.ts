import express, { Response } from 'express';
import { z } from 'zod';
import { ApiSchemas, ApiTypes } from '../../../../src/api/types';
import { getUsersByEmail } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { teamMiddleware } from '../../middleware/team';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestAgainstZodSchema } from '../../middleware/validateRequestAgainstZodSchema';
import { Request, RequestWithAuth, RequestWithTeam, RequestWithUser } from '../../types/Request';
import { ResponseError } from '../../types/Response';
import { firstRoleIsHigherThanSecond } from '../../utils';

const router = express.Router();

const ReqSchema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: ApiSchemas['/v0/teams/:uuid/sharing.POST.request'],
});

router.post(
  '/:uuid/sharing',
  validateAccessToken,
  validateRequestAgainstZodSchema(ReqSchema),
  userMiddleware,
  teamMiddleware,
  async (
    req: Request & RequestWithAuth & RequestWithUser & RequestWithTeam,
    res: Response<ApiTypes['/v0/teams/:uuid/sharing.POST.response'] | ResponseError>
  ) => {
    const {
      body: { email, role },
      team: {
        data: { id: teamId },
        user: teamUser,
      },
    } = req;

    const userMakingRequestRole = teamUser.role;

    // Can you even invite others?
    if (!teamUser.access.includes('TEAM_EDIT')) {
      return res
        .status(403)
        .json({ error: { message: 'User does not have permission to invite other users to this team.' } });
    }

    // Are you trying to invite someone to a role higher than your own? No go
    if (firstRoleIsHigherThanSecond(role, userMakingRequestRole)) {
      return res
        .status(403)
        .json({ error: { message: 'User cannot invite someone to a role higher than their own.' } });
    }

    // Look up the invited user by email in Auth0
    const auth0Users = await getUsersByEmail(email);

    // Nobody with an account by that email
    if (auth0Users.length === 0) {
      // TODO where do we remove them from this table once they become a user?
      await dbClient.teamInvite.create({
        data: {
          email,
          role,
          teamId,
        },
      });
      // TODO send them an invitation email
      return res.status(201).json({ email, role, id: 100 });
    }

    // Somebody with that email already has an account
    if (auth0Users.length === 1) {
      const auth0User = auth0Users[0];

      // Lookup the user in our database
      const dbUser = await dbClient.user.findUnique({
        where: {
          auth0_id: auth0User.user_id,
        },
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
        return res.status(400).json({ error: { message: 'User is already a member of this team' } });
      }

      // If not, add them!
      await dbClient.userTeamRole.create({
        data: {
          userId: dbUser.id,
          teamId,
          role,
        },
      });

      // TODO send them an email

      // TODO what to return exactly...?
      return res.status(201).json({ email, role, id: dbUser.id });
    }

    // TODO, how should we handle duplicate email?
    return res.status(500).json({ error: { message: 'Internal server error: duplicate email' } });
  }
);

export default router;
