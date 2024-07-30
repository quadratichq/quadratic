import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../../dbClient';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { generatePresignedUrl } from '../../storage/s3';
import { RequestWithUser } from '../../types/Request';
import { ResponseError } from '../../types/Response';

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
        file.thumbnail = await generatePresignedUrl(file.thumbnail);
      }
    })
  );

  const data: ApiTypes['/v0/files.GET.response'] = dbFiles.map((file) => ({
    ...file,
    createdDate: file.createdDate.toISOString(),
    updatedDate: file.updatedDate.toISOString(),
  }));
  return res.status(200).json(data);
}
