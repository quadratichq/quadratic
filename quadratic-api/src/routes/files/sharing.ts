import express, { Request, Response } from 'express';
import { ApiSchemas, ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getFile } from './fileMiddleware';

const sharing_router = express.Router();

sharing_router.get(
  '/:uuid/sharing',
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
    })
  ),
  validateAccessToken,
  userMiddleware,
  async (req: Request, res: Response) => {
    const {
      user: { id: userId },
      params: { uuid },
    } = req as RequestWithUser;

    const { file, user } = await getFile({ uuid, userId });
    const { publicLinkAccess } = file;

    // TOOD: who can view the email addresses of other users?
    // const owner = await getUserProfile(req.quadraticFile.ownerUserId);
    // if (!req.user) {
    //   delete owner.email;
    // }

    const data: ApiTypes['/v0/files/:uuid/sharing.GET.response'] = {
      file: {
        users: [],
        invites: [],
        publicLinkAccess,
      },
      user: {
        id: userId,
        permissions: user.permissions,
        role: user.role,
      },
      // team: {},
    };
    return res.status(200).json(data);
  }
);

sharing_router.post(
  '/:uuid/sharing',
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
      body: ApiSchemas['/v0/files/:uuid/sharing.POST.request'],
    })
  ),
  validateAccessToken,
  userMiddleware,
  async (req: Request, res: Response) => {
    const {
      body: { publicLinkAccess },
      user: { id: userId },
      params: { uuid },
    } = req as RequestWithUser;
    const {
      user: { permissions },
    } = await getFile({ uuid, userId });

    // Make sure they can edit the file sharing permissions
    if (!permissions.includes('FILE_EDIT')) {
      throw new ApiError(403, 'Permission denied');
    }

    // Then edit!
    await dbClient.file.update({
      where: { uuid },
      data: { publicLinkAccess },
    });

    return res.status(200).json({ message: 'File updated.' });
  }
);

export default sharing_router;
