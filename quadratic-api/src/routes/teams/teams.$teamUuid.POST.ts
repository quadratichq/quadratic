import { ApiSchemas, ApiTypes } from '@quadratic-shared/typesAndSchemas';
import express, { Response } from 'express';
import z from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestAgainstZodSchema } from '../../middleware/validateRequestAgainstZodSchema';
import { RequestWithAuth, RequestWithTeam, RequestWithUser } from '../../types/Request';
const router = express.Router();

const reqSchema = z.object({
  body: ApiSchemas['/v0/teams/:uuid.POST.request'],
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

router.post(
  '/:uuid',
  validateAccessToken,
  userMiddleware,
  validateRequestAgainstZodSchema(reqSchema),
  async (
    req: RequestWithAuth & RequestWithUser & RequestWithTeam,
    res: Response<ApiTypes['/v0/teams/:uuid.POST.response']>
  ) => {
    const {
      params: { uuid },
      body: { name },
    } = req;

    // Update the team
    await dbClient.team.update({
      where: {
        uuid,
      },
      data: {
        name,
      },
    });

    return res.status(200).json({ message: 'File updated.' });
  }
);

export default router;
