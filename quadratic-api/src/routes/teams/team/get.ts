import express, { Response } from 'express';
import { getUsers } from '../../../auth0/profile';
import dbClient from '../../../dbClient';
import { Request } from '../../../types/Request';
import { teamMiddleware } from './teamMiddleware';
const router = express.Router();

router.get(
  '/:uuid',
  // validateUUID(),
  // userOptionalMiddleware,
  teamMiddleware,
  async (req: Request, res: Response) => {
    if (!req.team) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    // Validate request parameters
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({ errors: errors.array() });
    // }

    // Get users in the team
    const teamUsers = await dbClient.userTeamRole.findMany({
      where: {
        teamId: req.team.id,
      },
    });
    const userIds = teamUsers.map(({ userId }) => userId);
    // Get auth0 users
    // TODO have it return a merger of auth0 and db users
    const auth0Users = await getUsers(userIds);

    const response = {
      team: {
        uuid: req.team.uuid,
        name: req.team.name,
        created_date: req.team.created_date,
        ...(req.team.picture ? { picture: req.team.picture } : {}),
        // TODO
        users: auth0Users.map(({ email, name, picture }, i) => ({
          id: teamUsers[i].id,
          email,
          role: teamUsers[i].role,
          hasAccount: true,
          name,
          picture,
        })),
        // { id: 1, email: 'jim.nielsen@quadratichq.com', role: 'OWNER', hasAccount: true }],
        // @ts-expect-error TODO
        files: [],
      },
      role: 'OWNER', // TODO
      access: ['TEAM_EDIT'], // TODO
    };

    return res.status(200).json(response);
  }
);

export default router;
