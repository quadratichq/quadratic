import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { S3Bucket } from '../../storage/s3';
import { uploadMiddleware } from '../../storage/storage';
import type { RequestWithFile, RequestWithUser } from '../../types/Request';

const { FILE_EDIT } = FilePermissionSchema.enum;

async function handler(req: RequestWithUser & RequestWithFile, res: Response) {
  const {
    params: { uuid },
    user: { id: userId },
  } = req;
  const {
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId });

  if (!filePermissions.includes(FILE_EDIT)) {
    return res.status(403).json({ error: { message: 'Permission denied' } });
  }

  // update the file object with the thumbnail URL
  await dbClient.file.update({
    where: {
      uuid,
    },
    data: {
      thumbnail: req.file?.key,
      updatedDate: new Date(),
    },
  });

  const data: ApiTypes['/v0/files/:uuid/thumbnail.POST.response'] = { message: 'Preview updated' };
  return res.status(200).json(data);
}

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
  uploadMiddleware(S3Bucket.FILES).single('thumbnail'),
  handler,
];
