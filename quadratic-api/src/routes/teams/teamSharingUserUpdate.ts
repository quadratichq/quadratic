import express, { Response } from 'express';
import { z } from 'zod';
import { ApiSchemas, ApiTypes } from '../../../../src/api/types';
import { teamMiddleware } from '../../middleware/team';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateZodSchema } from '../../middleware/validateZodSchema';
import { RequestWithAuth, RequestWithTeam, RequestWithUser } from '../../types/Request';
import { ResponseError } from '../../types/Response';
const router = express.Router();

const roleIsEqualToOrHigherThan = (role1: string, role2: string) => {
  switch (role2) {
    case 'OWNER':
      return role1 === 'OWNER';
    case 'EDITOR':
      return role1 === 'OWNER' || role1 === 'EDITOR';
    case 'VIEWER':
      return role1 === 'OWNER' || role1 === 'EDITOR' || role1 === 'VIEWER';
    default:
      return false;
  }
};

const ReqSchema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    userId: z.coerce.number(),
  }),
  body: ApiSchemas['/v0/teams/:uuid/sharing/:userId.POST.request'],
});

router.post(
  '/:uuid/sharing/:userId',
  validateAccessToken,
  validateZodSchema(ReqSchema),
  userMiddleware,
  teamMiddleware,
  // teamSharingMiddleware,
  async (
    req: RequestWithAuth & RequestWithUser & RequestWithTeam,
    res: Response<ApiTypes['/v0/teams/:uuid/sharing/:userId.POST.response'] | ResponseError>
  ) => {
    const {
      //   body: { role },
      //   // team,
      teamUser,
    } = req;
    const newRole = req.body.role;
    const userBeingChangedId = Number(req.params.userId);
    const userMakingRequestId = req.user.id;
    const userMakingRequestRole = req.teamUser.role;

    // User is updating themselves
    if (userBeingChangedId === userMakingRequestId) {
      if (newRole === userMakingRequestRole) {
        return res.status(200).json({ message: 'User already is this role' }); // 304?
      }
      if (roleIsEqualToOrHigherThan(newRole, userMakingRequestRole)) {
        return res.status(200).json({ message: 'User updated' });
      } else {
        return res.status(403).json({ error: { message: 'User cannot upgrade their own role' } });
      }
    }

    // User is editing somebody else, can they do this?
    if (!teamUser.access.includes('TEAM_EDIT')) {
      return res.status(403).json({ message: 'User does not have permission to edit others' });
    }

    // TODO middleware to ensure user can EDIT on this team
    return res.status(200).json({ message: 'User updated' });
  }
);

export default router;
