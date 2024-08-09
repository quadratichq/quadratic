import { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getUsersFromAuth0 } from '../../auth0/profile';
import { generatePresignedUrl } from '../../aws/s3';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { getFilePermissions } from '../../utils/permissions';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: Request, res: Response<ApiTypes['/v0/teams/:uuid.GET.response']>) {
  const {
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userMakingRequestId },
  } = req as RequestWithUser;
  const { team, userMakingRequest } = await getTeam({ uuid, userId: userMakingRequestId });

  // Get data associated with the file
  const dbTeam = await dbClient.team.findUnique({
    where: {
      id: team.id,
    },
    include: {
      Connection: {
        where: {
          archived: null,
        },
        orderBy: {
          createdDate: 'desc',
        },
      },
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
          ownerTeamId: team.id,
          deleted: false,
          // Don't return files that are private to other users
          // (one of these must return true)
          OR: [
            { ownerUserId: null }, // Public files to the team
            { ownerUserId: userMakingRequestId }, // Private files to the user
          ],
        },
        include: {
          UserFileRole: {
            where: {
              userId: userMakingRequestId,
            },
          },
        },
        orderBy: {
          createdDate: 'asc',
        },
      },
    },
  });

  if (!dbTeam) {
    return res.status(404).send();
  }

  const dbFiles = dbTeam.File ? dbTeam.File : [];
  const dbUsers = dbTeam.UserTeamRole ? dbTeam.UserTeamRole : [];
  const dbInvites = dbTeam.TeamInvite ? dbTeam.TeamInvite : [];

  // Get user info from auth0
  const auth0UsersById = await getUsersFromAuth0(dbUsers.map(({ user }) => user));

  // Get signed thumbnail URLs
  await Promise.all(
    dbFiles.map(async (file) => {
      if (file.thumbnail) {
        file.thumbnail = await generatePresignedUrl(file.thumbnail);
      }
    })
  );

  const response = {
    team: {
      id: team.id,
      uuid,
      name: team.name,
    },
    billing: {
      status: dbTeam.stripeSubscriptionStatus || undefined,
      currentPeriodEnd: dbTeam.stripeCurrentPeriodEnd?.toISOString(),
    },
    userMakingRequest: {
      id: userMakingRequestId,
      teamRole: userMakingRequest.role,
      teamPermissions: userMakingRequest.permissions,
    },
    // IDEA: (enhancement) we could put this in /sharing and just return the userCount
    // then require the data for the team share modal to be a seaparte network request
    users: dbUsers.map(({ userId: id, role }) => {
      const { email, name, picture } = auth0UsersById[id];
      return {
        id,
        email,
        role,
        name,
        picture,
      };
    }),
    invites: dbInvites.map(({ email, role, id }) => ({ email, role, id })),
    files: dbFiles
      .filter((file) => !file.ownerUserId)
      .map((file) => ({
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
            publicLinkAccess: file.publicLinkAccess,
            userFileRelationship: {
              context: 'public-to-team',
              teamRole: userMakingRequest.role,
              fileRole: file.UserFileRole.find(({ userId }) => userId === userMakingRequestId)?.role,
            },
          }),
        },
      })),
    filesPrivate: dbFiles
      .filter((file) => file.ownerUserId)
      .map((file) => ({
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
            publicLinkAccess: file.publicLinkAccess,
            userFileRelationship: {
              context: 'private-to-me',
              teamRole: userMakingRequest.role,
            },
          }),
        },
      })),
    connections: dbTeam.Connection.map((connection) => ({
      uuid: connection.uuid,
      name: connection.name,
      createdDate: connection.createdDate.toISOString(),
      type: connection.type,
    })),
    clientDataKv: isObject(dbTeam.clientDataKv) ? dbTeam.clientDataKv : {},
  };

  return res.status(200).json(response);
}

function isObject(x: any): x is Record<string, any> {
  return typeof x === 'object' && !Array.isArray(x) && x !== null;
}
