import express, { Response } from 'express';
import dbClient from '../../../dbClient';
import { userMiddleware } from '../../../middleware/user';
import { validateAccessToken } from '../../../middleware/validateAccessToken';
import { Request } from '../../../types/Request';
const router = express.Router();

router.post(
  '/:uuid',
  // validateUUID(),
  validateAccessToken,
  userMiddleware,
  // fileMiddleware,
  // validateFileContents().optional(),
  // validateFileVersion().optional(),
  // validateFileName().optional(),
  async (req: Request, res: Response) => {
    // TODO
    // if (!req.file || !req.user) {
    //   return res.status(500).json({ error: { message: 'Internal server error' } });
    // }

    // TODO
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({ errors: errors.array() });
    // }

    // TODO
    // ensure the user has EDIT access to the file
    // const permissions = getFilePermissions(req.user, req.file);
    // if (permissions !== 'EDITOR' && permissions !== 'OWNER') {
    //   return res.status(403).json({ error: { message: 'Permission denied' } });
    // }

    // TODO ensure request has what we want

    console.log(req.params.uuid, req.body);

    // Update the team
    await dbClient.team.update({
      where: {
        uuid: req.params.uuid,
      },
      data: {
        name: req.body.name,
      },
    });

    return res.status(200).json({ message: 'File updated.' });
  }
);

export default router;
