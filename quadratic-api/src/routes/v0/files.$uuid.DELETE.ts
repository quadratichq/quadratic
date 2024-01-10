import { Response } from 'express';
import { ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
const { FILE_DELETE } = FilePermissionSchema.enum;

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

async function handler(req: RequestWithUser, res: Response) {
  const {
    params: { uuid },
    user: { id: userId },
  } = req;
  const {
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId });

  // Can they delete?
  if (!filePermissions.includes(FILE_DELETE)) {
    return res.status(403).json({ error: { message: 'Permission denied' } });
  }

  // Then mark the file as deleted
  await dbClient.file.update({
    where: {
      uuid: req.params.uuid,
    },
    data: {
      deleted: true,
      deletedDate: new Date(),
    },
  });

  const data: ApiTypes['/v0/files/:uuid.DELETE.response'] = { message: 'File deleted' };
  return res.status(200).json(data);
}
