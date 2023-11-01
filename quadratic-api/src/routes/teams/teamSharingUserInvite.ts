import express, { Response } from 'express';
import { z } from 'zod';
import { ApiSchemas } from '../../../../src/api/types';
import { getUsersByEmail } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { teamMiddleware } from '../../middleware/team';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateZodSchema } from '../../middleware/validateZodSchema';
import { Request } from '../../types/Request';
const router = express.Router();

const ReqSchema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: ApiSchemas['/v0/teams/:uuid/sharing.POST.request'],
});

router.post(
  '/:uuid/sharing',
  validateZodSchema(ReqSchema),
  validateAccessToken,
  userMiddleware,
  teamMiddleware,
  async (req: Request, res: Response) => {
    const {
      body: { email, role },
    } = req;

    // TODO
    // Check if invited email is already user of Quadratic
    // (1) If so, add them to the team and send invite email-template-1
    // (2) If not, add them to the team (as an inited user) and send invite-email-2

    const users = await getUsersByEmail(email);

    if (users.length === 0) {
      // (2)
      console.log('-----> User does not exist, invite them and add to team...');
    } else if (users.length === 1) {
      console.log('-----> User exists! invite them and add to team...');
      // (1)
      let user = await dbClient.user.findUnique({
        where: {
          auth0_id: users[0].user_id,
        },
      });
      await dbClient.userTeamRole.create({
        data: {
          userId: user.id,
          teamId: req.team.id,
          role,
        },
      });
    } else {
      console.error('-----> Duplicate email: ' + email);
      // TODO, DUPLICATE EMAIL!
    }

    return res.status(200).json({ message: 'User invited.' });
  }
);

export default router;
