import { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getFile } from '../../middleware/fileMiddleware';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: Request, res: Response) {
  const {
    user: { id: userId },
    params: { uuid },
  } = req as RequestWithUser;

  const { file, userMakingRequest } = await getFile({ uuid, userId });
  const { publicLinkAccess } = file;

  // TOOD: who can view the email addresses of other users?
  // const owner = await getUserProfile(req.quadraticFile.ownerUserId);
  // if (!req.user) {
  //   delete owner.email;
  // }

  const data: ApiTypes['/v0/files/:uuid/sharing.GET.response'] = {
    file: {
      publicLinkAccess,
    },
    users: [],
    invites: [],
    userMakingRequest: {
      // If they're on this route, there's always a user
      id: userId,
      filePermissions: userMakingRequest.filePermissions,
      // TODO: conditionally add
      fileRole: userMakingRequest.fileRole,
      teamRole: userMakingRequest.teamRole,
    },
    // team: {},
  };
  return res.status(200).json(data);
}
