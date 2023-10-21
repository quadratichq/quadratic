import express, { Response } from 'express';
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

    const response = {
      team: {
        uuid: req.team.uuid,
        name: req.team.name,
        created_date: req.team.created_date,
        ...(req.team.picture ? { picture: req.team.picture } : {}),
        // TODO
        users: [{ id: 1, email: 'jim.nielsen@quadratichq.com', role: 'OWNER', hasAccount: true }],
        // TODO
        // files: [],
      },
      role: 'OWNER', // TODO
      access: ['TEAM_EDIT'], // TODO
    };

    return res.status(200).json(response);
  }
);

export default router;
