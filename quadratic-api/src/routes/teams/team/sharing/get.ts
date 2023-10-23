import express, { Response } from 'express';

import { getUsersByEmail } from '../../../../auth0/profile';
import dbClient from '../../../../dbClient';
import { userMiddleware } from '../../../../middleware/user';
import { validateAccessToken } from '../../../../middleware/validateAccessToken';
import { Request } from '../../../../types/Request';
import { teamMiddleware } from '../teamMiddleware';
const router = express.Router();

router.post(
  '/:uuid/sharing',
  // validateUUID(),
  // userOptionalMiddleware,
  // validateBodyEmail(),
  // validateBodyRole(),
  validateAccessToken,
  userMiddleware,
  teamMiddleware,
  async (req: Request, res: Response) => {
    if (!req.team) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    // TODO email invitation to the team

    // Check if invited email is already user of Quadratic
    // TODO two different email templates
    // If so, add them to the team
    // If not, send them an invitation email and add to the team

    const users = await getUsersByEmail(req.body.email);

    if (users.length === 0) {
      // TODO send invite email, add to team
    } else if (users.length === 1) {
      // TODO add to team and send email
      let user = await dbClient.user.findUnique({
        where: {
          auth0_id: users[0].user_id,
        },
      });
      await dbClient.userTeamRole.create({
        data: {
          userId: user.id,
          teamId: req.team.id,
          role: req.body.role,
        },
      });
    } else {
      console.error('Duplicate email: ' + req.body.email);
      // DUPLICATE EMAIL! TODO
    }

    return res.status(200).json({ message: '' });
  }
);

export default router;
