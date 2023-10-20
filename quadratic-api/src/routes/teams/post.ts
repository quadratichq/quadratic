import express from 'express';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { Request } from '../../types/Request';
const router = express.Router();

router.post(
  '/',
  validateAccessToken,
  userMiddleware,
  // validateFileContents(),
  // validateFileVersion(),
  // validateFileName(),
  // TODO
  async (req: Request, res) => {
    // POST creates a new file with the provided name, contents, and version

    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({ errors: errors.array() });
    // }

    // TODO validate req.body

    if (!req.user) {
      return res.status(500).json({ error: { message: 'Internal server error' } });
    }

    await dbClient.team.create({
      data: {
        name: req.body.name,
        // TODO picture
        UserTeamRole: {
          create: {
            userId: req.user.id,
            role: 'OWNER',
          },
        },
      },
      select: {
        id: true,
        uuid: true,
        name: true,
        picture: true,
      },
    });

    // await dbClient.userTeamRole.create({
    //   data: {
    //     userId: req.user.id,
    //     teamId: team.id,
    //     role: 'OWNER',
    //   },
    // });

    return res.status(201).json({ message: 'Team created' });
  }
);

export default router;
