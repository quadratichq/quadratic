import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsers, type UsersRequest } from '../../auth/providers/auth';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';

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

async function handler(req: Request, res: Response<ApiTypes['/v0/files/:uuid/sharing.GET.response']>) {
  const {
    user: { id: userId },
    params: { uuid },
  } = req as RequestWithUser;
  const { file, userMakingRequest } = await getFile({ uuid, userId });
  const { publicLinkAccess } = file;

  // Get the file and all the invites/users associated with it
  const dbFile = await dbClient.file.findUnique({
    where: {
      id: file.id,
    },
    include: {
      ownerUser: true,
      ownerTeam: {
        include: {
          UserTeamRole: {
            select: {
              userId: true,
            },
          },
          TeamInvite: {
            select: {
              email: true,
            },
          },
        },
      },
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
    throw new ApiError(500, 'Failed to find file that should’ve been found in middleware.');
  }
  const dbInvites = dbFile.FileInvite;
  const dbUsers = dbFile.UserFileRole;

  // Build sets for quick team membership lookups
  const teamMemberIds = new Set(dbFile.ownerTeam.UserTeamRole.map((utr) => utr.userId));
  const teamInviteEmails = new Set(dbFile.ownerTeam.TeamInvite.map((ti) => ti.email));

  // Lookup extra user info in Auth0
  const usersToSearchFor: UsersRequest[] = dbUsers.map(({ user }) => user);
  if (dbFile.ownerUser) {
    usersToSearchFor.push({
      id: dbFile.ownerUser.id,
      auth0Id: dbFile.ownerUser.auth0Id,
      email: dbFile.ownerUser.email,
    });
  }
  const usersById = await getUsers(usersToSearchFor);

  // Assign the owner based on whether this is a team or user-owned file
  let owner: ApiTypes['/v0/files/:uuid/sharing.GET.response']['owner'];
  if (dbFile.ownerUser) {
    const ownerUser = usersById[dbFile.ownerUser.id];
    owner = {
      type: 'user',
      id: ownerUser.id,
      email: ownerUser.email,
      name: ownerUser.name,
      picture: ownerUser.picture,
    };
  } else if (dbFile.ownerTeam) {
    owner = {
      type: 'team',
      name: dbFile.ownerTeam.name,
    };
  } else {
    // TODO log to sentry. bad data
    throw new ApiError(500, 'File does not have a clear owner. This means there is corrupt data in the database.');
  }

  return res.status(200).json({
    file: {
      publicLinkAccess,
    },
    team: {
      name: dbFile.ownerTeam.name,
      uuid: dbFile.ownerTeam.uuid,
    },
    users: dbUsers.map(({ user: { id }, role }) => {
      const { email, name, picture } = usersById[id];
      return { id, email, name, picture, role, isTeamMember: teamMemberIds.has(id) };
    }),
    invites: dbInvites.map(({ id, email, role }) => ({
      id,
      email,
      role,
      isTeamMember: teamInviteEmails.has(email),
    })),
    userMakingRequest: {
      id: userId,
      filePermissions: userMakingRequest.filePermissions,
      fileRole: userMakingRequest.fileRole,
      teamRole: userMakingRequest.teamRole,
    },
    owner,
  });
}
