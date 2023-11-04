import express, { Response } from 'express';
import { z } from 'zod';
import { ApiTypes } from '../../../../src/api/types';
import { getAuth0Users } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { teamMiddleware } from '../../middleware/team';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestAgainstZodSchema } from '../../middleware/validateRequestAgainstZodSchema';
import { RequestWithAuth, RequestWithTeam, RequestWithUser } from '../../types/Request';
const router = express.Router();

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

router.get(
  '/:uuid',
  validateAccessToken,
  validateRequestAgainstZodSchema(schema),
  userMiddleware,
  teamMiddleware,
  async (
    req: RequestWithAuth & RequestWithUser & RequestWithTeam,
    res: Response<ApiTypes['/v0/teams/:uuid.GET.response']>
  ) => {
    const {
      user: { id: userId },
      team: {
        data: team,
        data: { id: teamId },
        user: teamUser,
      },
    } = req;

    // Get users in the team
    const teamUsers = await dbClient.userTeamRole.findMany({
      where: {
        teamId,
      },
      include: {
        user: true,
      },
      orderBy: {
        createdDate: 'asc',
      },
    });
    const auth0UserIds = teamUsers.map(({ user: { auth0_id } }) => auth0_id);

    // TODO get the invited users of a team

    // Get auth0 users
    const auth0Users = await getAuth0Users(auth0UserIds);
    // @ts-expect-error fix types
    const auth0UsersByAuth0Id: Record<string, (typeof auth0Users)[0]> = auth0Users.reduce(
      (acc, auth0User) => ({ ...acc, [auth0User.user_id]: auth0User }),
      {}
    );

    // TODO sort users by created_date in the team

    const response = {
      team: {
        uuid: team.uuid,
        name: team.name,
        created_date: team.createdDate,
        ...(team.picture ? { picture: team.picture } : {}),
        // TODO we could put this in /sharing and just return the userCount
        // TODO invited users, also can we guarantee ordering here?
        users: teamUsers.map(({ userId: id, role, user: { auth0_id } }) => {
          const { email, name, picture } = auth0UsersByAuth0Id[auth0_id];
          return {
            id,
            email,
            role,
            hasAccount: true,
            name,
            picture,
          };
        }),

        // @ts-expect-error TODO
        files: [],
      },
      user: {
        id: userId,
        role: teamUser.role,
        access: teamUser.access,
      },
    };

    return res.status(200).json(response);
  }
);

export default router;
