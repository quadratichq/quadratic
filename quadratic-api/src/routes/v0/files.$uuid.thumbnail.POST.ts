import { Response } from 'express';
import { ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { uploadMiddleware } from '../../storage/storage';
import { RequestWithFile, RequestWithUser } from '../../types/Request';
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

  console.log('req.file', req.file);

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
  uploadMiddleware().single('thumbnail'),
  handler,
];
