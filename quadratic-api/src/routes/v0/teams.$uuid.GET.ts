import { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsersFromAuth0 } from '../../auth0/profile';
import { generatePresignedUrl } from '../../aws/s3';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { getFilePermissions } from '../../utils/permissions';

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
    params: { uuid },
    user: { id: userId },
  } = req as RequestWithUser;
  const {
    team,
    team: { id: teamId },
    userMakingRequest,
  } = await getTeam({ uuid, userId });

  // Get users in the team
  const dbTeam = await dbClient.team.findUnique({
    where: {
      id: teamId,
    },
    include: {
      UserTeamRole: {
        include: {
          user: true,
        },
        orderBy: {
          createdDate: 'asc',
        },
      },
      TeamInvite: {
        orderBy: {
          createdDate: 'asc',
        },
      },
      File: {
        where: {
          ownerTeamId: teamId,
          deleted: false,
        },
        orderBy: {
          createdDate: 'asc',
        },
      },
    },
  });

  const dbFiles = dbTeam?.File ? dbTeam.File : [];
  const dbUsers = dbTeam?.UserTeamRole ? dbTeam.UserTeamRole : [];
  const dbInvites = dbTeam?.TeamInvite ? dbTeam.TeamInvite : [];

  // Get auth0 users
  const auth0UsersById = await getUsersFromAuth0(dbUsers.map(({ user }) => user));

  // TODO: sort users by createdDate in the team
  // TODO: invited users, also can we guarantee ordering here?
  const users = dbUsers.map(({ userId: id, role }) => {
    const { email, name, picture } = auth0UsersById[id];
    return {
      id,
      email,
      role,
      name,
      picture,
    };
  });

  // Get signed thumbnail URLs
  await Promise.all(
    dbFiles.map(async (file) => {
      if (file.thumbnail) {
        file.thumbnail = await generatePresignedUrl(file.thumbnail);
      }
    })
  );

  const response: ApiTypes['/v0/teams/:uuid.GET.response'] = {
    team: {
      uuid: team.uuid,
      name: team.name,
      ...(team.picture ? { picture: team.picture } : {}),
    },
    userMakingRequest: {
      id: userId,
      teamRole: userMakingRequest.role,
      teamPermissions: userMakingRequest.permissions,
    },
    // TODO we could put this in /sharing and just return the userCount
    users,
    invites: dbInvites.map(({ email, role, id }) => ({ email, role, id })),
    files: dbFiles.map((file) => ({
      file: {
        uuid: file.uuid,
        name: file.name,
        createdDate: file.createdDate.toISOString(),
        updatedDate: file.updatedDate.toISOString(),
        publicLinkAccess: file.publicLinkAccess,
        thumbnail: file.thumbnail,
      },
      userMakingRequest: {
        filePermissions: getFilePermissions({
          fileRole: undefined, // TODO
          teamRole: userMakingRequest.role,
          publicLinkAccess: file.publicLinkAccess,
          isFileOwner: false, // the team is the 'owner'
          isLoggedIn: true,
        }),
      },
    })),
  };

  return res.status(200).json(response);
}
