import { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { augmentUsersWithAuth0Info, getUserByAuth0Id } from '../../auth0/profile';
import dbClient from '../../dbClient';
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

  const dbFile = await dbClient.file.findUnique({
    where: {
      id: file.id,
    },
    include: {
      owner: true,
      UserFileRole: {
        include: {
          user: true,
        },
      },
      FileInvite: true,
    },
  });
  if (!dbFile) {
    return res.status(500).json({
      error: {
        message: 'Failed to find file that should’ve been found in middleware.',
      },
    });
  }
  const dbInvites = dbFile.FileInvite;
  const dbUsers = dbFile.UserFileRole;

  // TODO: optimize call to auth0 where we only call them once for all users and the owner

  let users: ApiTypes['/v0/files/:uuid/sharing.GET.response']['users'] = [];
  if (dbUsers.length > 0) {
    const usersWithAuth0Info = await augmentUsersWithAuth0Info(
      dbUsers.map(({ user: { id, auth0Id }, role, createdDate }) => ({ id, auth0Id, role, createdDate }))
    );
    users = usersWithAuth0Info
      .sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime())
      .map(({ id, email, name, picture, role }) => ({ id, email, name, picture, role }));
    console.log(dbUsers);
  }

  const data: ApiTypes['/v0/files/:uuid/sharing.GET.response'] = {
    file: {
      publicLinkAccess,
    },
    users,
    invites: dbInvites.map(({ id, email, role }) => ({ id, email, role })),
    userMakingRequest: {
      // If they're on this route, there's always a user
      id: userId,
      filePermissions: userMakingRequest.filePermissions,
      fileRole: userMakingRequest.fileRole,
      teamRole: userMakingRequest.teamRole,
    },
    // TODO: (teams) this will be conditional on whether the "owner" is a team or a user
    owner: {
      type: 'user',
      id: file.ownerUserId,
      ...(await getUserByAuth0Id(dbFile.owner.auth0Id)),
    },
    // team: {},
  };
  return res.status(200).json(data);
}
