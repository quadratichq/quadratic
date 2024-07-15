import { Request, Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { generatePresignedUrl } from '../../aws/s3';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
import { getFilePermissions } from '../../utils/permissions';

export default [validateAccessToken, userMiddleware, handler];

// /teams/:uuid/files - public files in team
// /teams/:uuid/files?private=true - private files in team
const schema = z.object({
  query: z.object({
    private: z.string().transform((val) => val.toLowerCase() === 'true'),
  }),
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: Request, res: Response<ApiTypes['/v0/teams/:uuid/files.GET.response']>) {
  const {
    params: { uuid },
    query: { private: isPrivate },
  } = parseRequest(req, schema);
  console.log('isPrivate', isPrivate, req.url);
  const {
    user: { id: userMakingRequestId },
  } = req as RequestWithUser;
  const { team, userMakingRequest } = await getTeam({ uuid, userId: userMakingRequestId });

  // Get team data
  const dbTeam = await dbClient.team.findUniqueOrThrow({
    where: {
      id: team.id,
    },
    include: {
      File: {
        where: {
          ownerTeamId: team.id,
          deleted: false,
          // Make sure not to return files that are private to other users
          ownerUserId: isPrivate ? userMakingRequestId : null,
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

  const dbFiles = dbTeam.File ? dbTeam.File : [];
  console.log('files & privacy', isPrivate, dbFiles.length);

  // Get signed thumbnail URLs
  await Promise.all(
    dbFiles.map(async (file) => {
      if (file.thumbnail) {
        file.thumbnail = await generatePresignedUrl(file.thumbnail);
      }
    })
  );

  const response = {
    userMakingRequest: {
      id: userMakingRequestId,
      teamRole: userMakingRequest.role,
      teamPermissions: userMakingRequest.permissions,
    },
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
          publicLinkAccess: file.publicLinkAccess,
          userFileRelationship: isPrivate
            ? {
                context: 'private-to-me',
                teamRole: userMakingRequest.role,
              }
            : {
                context: 'public-to-team',
                teamRole: userMakingRequest.role,
                fileRole: file.UserFileRole.find(({ userId }) => userId === userMakingRequestId)?.role,
              },
        }),
      },
    })),
  };

  return res.status(200).json(response);
}
