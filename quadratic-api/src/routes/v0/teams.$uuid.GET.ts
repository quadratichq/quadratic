import type { Request, Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getAIMessageUsageForUser } from '../../ai/usage';
import { getUsers } from '../../auth/auth';
import dbClient from '../../dbClient';
import { licenseClient } from '../../licenseClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { getPresignedFileUrl } from '../../storage/storage';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';
import { ApiError } from '../../utils/ApiError';
import { getFilePermissions } from '../../utils/permissions';
export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: Request, res: Response<ApiTypes['/v0/teams/:uuid.GET.response'] | ResponseError>) {
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

  // Get user info from auth
  const authUsersById = await getUsers(dbUsers.map(({ user }) => user));

  // IDEA: (enhancement) we could put this in /sharing and just return the userCount
  // then require the data for the team share modal to be a seaparte network request
  const users = dbUsers
    .filter(({ userId: id }) => authUsersById[id])
    .map(({ userId: id, role }) => {
      const { email, name, picture } = authUsersById[id];
      return {
        id,
        email,
        role,
        name,
        picture,
      };
    });

  const license = await licenseClient.check(false);

  if (!license) {
    throw new ApiError(500, 'Unable to retrieve license');
  }

  // Get signed thumbnail URLs
  await Promise.all(
    dbFiles.map(async (file) => {
      if (file.thumbnail) {
        file.thumbnail = await getPresignedFileUrl(file.thumbnail);
      }
    })
  );

  const usage = await getAIMessageUsageForUser(userMakingRequestId);

  const response = {
    team: {
      id: team.id,
      uuid,
      name: team.name,
      settings: {
        analyticsAi: dbTeam.settingAnalyticsAi,
      },
    },
    billing: {
      status: dbTeam.stripeSubscriptionStatus || undefined,
      currentPeriodEnd: dbTeam.stripeCurrentPeriodEnd?.toISOString(),
      usage,
    },
    userMakingRequest: {
      id: userMakingRequestId,
      teamRole: userMakingRequest.role,
      teamPermissions: userMakingRequest.permissions,
    },
    users,
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
          creatorId: file.creatorUserId,
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
    license: { ...license },
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
