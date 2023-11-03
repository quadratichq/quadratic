import express, { Response } from 'express';
import { z } from 'zod';
import { ApiTypes } from '../../../../src/api/types';
import { getUsers } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { teamMiddleware } from '../../middleware/team';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestAgainstZodSchema } from '../../middleware/validateRequestAgainstZodSchema';
import { RequestWithAuth, RequestWithTeam, RequestWithUser } from '../../types/Request';
const router = express.Router();

const ReqSchema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

router.get(
  '/:uuid',
  validateAccessToken,
  validateRequestAgainstZodSchema(ReqSchema),
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
    });
    const teamUserIds = teamUsers.map(({ userId }) => userId);

    // TODO get the invited users of a team

    // Get auth0 users
    // TODO how do we ensure that the order of the users is the same?
    const auth0Users = await getUsers(teamUserIds);

    const response = {
      team: {
        uuid: team.uuid,
        name: team.name,
        created_date: team.created_date,
        ...(team.picture ? { picture: team.picture } : {}),
        // TODO we could put this in /sharing and just return the userCount
        // TODO invited users, also can we guarantee ordering here?
        users: auth0Users.map(({ email, name, picture }, i) => ({
          id: teamUsers[i].userId,
          email,
          role: teamUsers[i].role,
          hasAccount: true,
          name,
          picture,
        })),
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
