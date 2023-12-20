import express, { Request, Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { teamMiddleware } from '../../middleware/team';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithTeam } from '../../types/Request';
import { ResponseError } from '../../types/Response';
const router = express.Router();

const requestValidationMiddleware = validateRequestSchema(
  z.object({
    body: ApiSchemas['/v0/teams/:uuid.POST.request'],
    params: z.object({
      uuid: z.string().uuid(),
    }),
  })
);

router.post(
  '/:uuid',
  requestValidationMiddleware,
  teamMiddleware,
  async (req: Request, res: Response<ApiTypes['/v0/teams/:uuid.POST.response'] | ResponseError>) => {
    const {
      params: { uuid },
      team: { user },
    } = req as RequestWithTeam;
    // TODO: improve this more generically when validating?
    const body = req.body as ApiTypes['/v0/teams/:uuid.POST.request'];

    // Can the user even edit this team?
    if (!user.permissions.includes('TEAM_EDIT')) {
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

    const data: ApiTypes['/v0/teams/:uuid.POST.response'] = { uuid, name: newTeam.name };
    if (newTeam.picture) data.picture = newTeam.picture;
    return res.status(200).json(data);
  }
);

export default router;
