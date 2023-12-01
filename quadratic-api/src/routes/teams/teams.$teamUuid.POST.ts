import { ApiSchemas, ApiTypes } from '@quadratic-shared/typesAndSchemas';
import express, { Response } from 'express';
import z from 'zod';
import dbClient from '../../dbClient';
import { teamMiddleware } from '../../middleware/team';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithAuth, RequestWithTeam, RequestWithUser } from '../../types/Request';
import { ResponseError } from '../../types/Response';
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
  validateRequestSchema(reqSchema),
  userMiddleware,
  teamMiddleware,
  async (
    req: RequestWithAuth & RequestWithUser & RequestWithTeam,
    // TODO: why are these all optional when returned?
    res: Response<ApiTypes['/v0/teams/:uuid.POST.response'] | ResponseError>
  ) => {
    const {
      params: { uuid },
      team: { user },
    } = req;
    // TODO: improve this more generically when validating?
    const body = req.body as ApiTypes['/v0/teams/:uuid.POST.request'];

    // Can the user even edit this team?
    if (!user.access.includes('TEAM_EDIT')) {
      return res.status(403).json({ error: { message: 'User does not have permission to edit this team.' } });
    }

    // TODO: what if it's billing info?

    // Update the team
    const newTeam = await dbClient.team.update({
      where: {
        uuid,
      },
      data: body,
    });

    const data = { uuid, name: newTeam.name, picture: newTeam.picture };
    return res.status(200).json(data);
  }
);

export default router;
