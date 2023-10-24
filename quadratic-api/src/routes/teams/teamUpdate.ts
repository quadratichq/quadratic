import express, { Response } from 'express';
import z from 'zod';
// TODO get this into its own project
import { ApiSchemas, ApiTypes } from '../../../../src/api/types';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateZodSchema } from '../../middleware/validateZodSchema';
import { Request } from '../../types/Request';
const router = express.Router();

const ReqSchema = z.object({
  body: ApiSchemas['/v0/teams/:uuid.POST.request'],
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

router.post(
  '/:uuid',
  // validateUUID(),
  validateAccessToken,
  userMiddleware,
  validateZodSchema(ReqSchema),
  // fileMiddleware,
  // validateFileContents().optional(),
  // validateFileVersion().optional(),
  // validateFileName().optional(),
  async (req: Request, res: Response<ApiTypes['/v0/teams/:uuid.POST.response']>) => {
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
