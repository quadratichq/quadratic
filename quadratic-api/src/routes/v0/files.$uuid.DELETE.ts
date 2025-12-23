import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
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
    file,
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId });

  // Can they delete?
  if (!filePermissions.includes(FILE_DELETE)) {
    return res.status(403).json({ error: { message: 'Permission denied' } });
  }

  // Delete all scheduled tasks associated with this file
  await dbClient.scheduledTask.updateMany({
    where: {
      fileId: file.id,
      status: { not: 'DELETED' },
    },
    data: {
      status: 'DELETED',
    },
  });

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
