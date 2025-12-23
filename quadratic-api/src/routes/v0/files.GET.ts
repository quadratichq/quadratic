import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { getFileUrl } from '../../storage/storage';
import type { RequestWithUser } from '../../types/Request';
import type { ResponseError } from '../../types/Response';

export default [validateAccessToken, userMiddleware, handler];

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files.GET.response'] | ResponseError>) {
  const {
    user: { id },
    query: { shared },
  } = req;

  if (shared !== 'with-me') {
    return res.status(400).json({ error: { message: 'Invalid query parameter' } });
  }

  // Fetch either 1) files owned by the user, or 2) files shared with the user
  const dbFiles = await dbClient.file.findMany({
    where: {
      UserFileRole: { some: { userId: id } },
      deleted: false,
    },
    select: {
      uuid: true,
      name: true,
      thumbnail: true,
      createdDate: true,
      updatedDate: true,
      publicLinkAccess: true,
      timezone: true,
      ScheduledTask: {
        where: {
          status: { not: 'DELETED' },
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
    orderBy: [
      {
        updatedDate: 'desc',
      },
    ],
  });

  // get signed images for each file thumbnail using S3Client
  await Promise.all(
    dbFiles.map(async (file) => {
      if (file.thumbnail) {
        file.thumbnail = await getFileUrl(file.thumbnail);
      }
    })
  );

  const data: ApiTypes['/v0/files.GET.response'] = dbFiles.map((file) => ({
    ...file,
    createdDate: file.createdDate.toISOString(),
    updatedDate: file.updatedDate.toISOString(),
    timezone: file.timezone ?? null,
    hasScheduledTasks: file.ScheduledTask.length > 0,
  }));
  return res.status(200).json(data);
}
