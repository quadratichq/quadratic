import type { Request, Response } from 'express';
import { z } from 'zod';
import dbClient from '../../dbClient';
import { getTeam } from '../../middleware/getTeam';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import { getFileUrl } from '../../storage/storage';
import type { RequestWithUser } from '../../types/Request';
import { getFilePermissions } from '../../utils/permissions';

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: Request, res: Response<any>) {
  const {
    params: { uuid },
  } = parseRequest(req, schema);
  const {
    user: { id: userMakingRequestId },
  } = req as RequestWithUser;
  const { team, userMakingRequest } = await getTeam({ uuid, userId: userMakingRequestId });

  // Calculate the date 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get deleted files for this team that the user has access to
  const dbFiles = await dbClient.file.findMany({
    where: {
      ownerTeamId: team.id,
      deleted: true,
      deletedDate: {
        gte: thirtyDaysAgo,
      },
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
      deletedDate: 'desc', // Most recently deleted first
    },
  });

  // Get signed URLs for thumbnails
  await Promise.all(
    dbFiles.map(async (file) => {
      if (file.thumbnail) {
        file.thumbnail = await getFileUrl(file.thumbnail);
      }
    })
  );

  const response = dbFiles.map((file) => ({
    file: {
      uuid: file.uuid,
      name: file.name,
      createdDate: file.createdDate.toISOString(),
      updatedDate: file.updatedDate.toISOString(),
      deletedDate: file.deletedDate?.toISOString() || null,
      thumbnail: file.thumbnail,
      creatorId: file.creatorUserId,
      ownerUserId: file.ownerUserId,
    },
    userMakingRequest: {
      filePermissions: getFilePermissions({
        publicLinkAccess: file.publicLinkAccess,
        userFileRelationship: {
          context: file.ownerUserId === userMakingRequestId ? 'private-to-me' : 'public-to-team',
          teamRole: userMakingRequest.role,
          fileRole: file.UserFileRole.find(({ userId }) => userId === userMakingRequestId)?.role,
        },
      }),
    },
  }));

  return res.status(200).json(response);
}
