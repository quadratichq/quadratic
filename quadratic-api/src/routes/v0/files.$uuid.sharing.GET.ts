import { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsersFromAuth0 } from '../../auth0/profile';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
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
      ownerUser: true,
      UserFileRole: {
        include: {
          user: true,
        },
        orderBy: {
          createdDate: 'asc',
        },
      },
      FileInvite: {
        orderBy: {
          createdDate: 'asc',
        },
      },
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

  // Lookup extra user info in Auth0
  const usersToSearchFor = dbUsers.map(({ user }) => user);
  if (dbFile.ownerUser) {
    usersToSearchFor.push({ id: dbFile.ownerUser.id, auth0Id: dbFile.ownerUser.auth0Id });
  }
  const usersById = await getUsersFromAuth0(usersToSearchFor);

  // TODO: (teams) this will be conditional on whether the "owner" is a team or a user
  // @ts-expect-error Before we launch teams, the owner will always be a user
  const ownerId = dbFile.ownerUser.id as number;
  const ownerUser = usersById[ownerId];

  const data: ApiTypes['/v0/files/:uuid/sharing.GET.response'] = {
    file: {
      publicLinkAccess,
    },
    users: dbUsers.map(({ user: { id }, role }) => {
      const { email, name, picture } = usersById[id];
      return { id, email, name, picture, role };
    }),
    invites: dbInvites.map(({ id, email, role }) => ({ id, email, role })),
    userMakingRequest: {
      // If they're on this route, there's always a user
      id: userId,
      filePermissions: userMakingRequest.filePermissions,
      fileRole: userMakingRequest.fileRole,
      teamRole: userMakingRequest.teamRole,
    },
    owner: {
      type: 'user',
      // @ts-expect-error TODO: fix types coming from `getFile()`
      id: file.ownerUserId,
      email: ownerUser.email,
      name: ownerUser.name,
      picture: ownerUser.picture,
    },
    // team: {},
  };
  return res.status(200).json(data);
}
