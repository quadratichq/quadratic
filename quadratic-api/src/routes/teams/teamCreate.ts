import express, { Response } from 'express';
import { z } from 'zod';
import { ApiSchemas, ApiTypes } from '../../../../src/api/types';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestAgainstZodSchema } from '../../middleware/validateRequestAgainstZodSchema';
import { RequestWithAuth, RequestWithUser } from '../../types/Request';
const router = express.Router();

const Schema = z.object({
  // TODO do we put a limit on the name length?
  body: ApiSchemas['/v0/teams.POST.request'],
});

router.post(
  '/',
  validateAccessToken,
  validateRequestAgainstZodSchema(Schema),
  userMiddleware,
  async (req: RequestWithAuth & RequestWithUser, res: Response<ApiTypes['/v0/teams.POST.response']>) => {
    const {
      body: { name, picture },
      user: { id: userId },
    } = req;
    const select = {
      uuid: true,
      name: true,
      picture: picture ? true : false,
    };

    const team = await dbClient.team.create({
      data: {
        name,
        // TODO picture
        UserTeamRole: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      select,
    });

    // TODO should return the same as `/teams/:uuid`
    return res.status(201).json(team);
  }
);

export default router;
