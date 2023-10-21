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

    const select = {
      uuid: true,
      name: true,
      picture: req.body.picture ? true : false,
    };

    const team = await dbClient.team.create({
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
      select,
    });

    return res.status(201).json(team);
  }
);

export default router;
