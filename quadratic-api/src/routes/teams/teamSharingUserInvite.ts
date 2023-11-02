import express, { Response } from 'express';
import { z } from 'zod';
import { ApiSchemas, ApiTypes } from '../../../../src/api/types';
import { getUsersByEmail } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { teamMiddleware } from '../../middleware/team';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateZodSchema } from '../../middleware/validateZodSchema';
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
  validateZodSchema(ReqSchema),
  userMiddleware,
  teamMiddleware,
  async (
    req: Request & RequestWithAuth & RequestWithUser & RequestWithTeam,
    res: Response<ApiTypes['/v0/teams/:uuid/sharing.POST.response'] | ResponseError>
  ) => {
    const {
      body: { email, role },
      teamUser,
    } = req;

    const userMakingRequestRole = teamUser.role;

    // Can you even invite others?
    if (!teamUser.access.includes('TEAM_EDIT')) {
      return res
        .status(403)
        .json({ error: { message: 'User does not have permission to invite other users to this team.' } });
    }

    // Are you trying to invite someone to a role higher than your own? No buddy
    if (firstRoleIsHigherThanSecond(role, userMakingRequestRole)) {
      return res
        .status(403)
        .json({ error: { message: 'User cannot invite someone to a role higher than their own.' } });
    }

    // You can, look up the invited user by email in Auth0
    const auth0Users = await getUsersByEmail(email);

    // No user for the given email, add them to the team and send them an invite email
    if (auth0Users.length === 0) {
      // TODO
      return res.status(201).json({ email, role, id: 100 });
    }

    // The user already exists, add them to the team and send them an invite email
    if (auth0Users.length === 1) {
      // TODO send them an email

      // Get the user and make them a member of the given team
      const dbUser = await dbClient.user.findUnique({
        where: {
          auth0_id: auth0Users[0].user_id,
        },
      });
      await dbClient.userTeamRole.create({
        data: {
          userId: dbUser.id,
          teamId: req.team.id,
          role,
        },
      });

      // What to return exactly...?
      return res.status(200).json({ email, role, id: dbUser.id });
    } else {
      console.error('-----> Duplicate email: ' + email);
      // TODO, DUPLICATE EMAIL!
    }

    return res.status(500).json({ error: { message: 'Internal server error: unreachable code' } });
  }
);

export default router;
