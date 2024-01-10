import { Response } from 'express';
import { ApiSchemas, ApiTypes, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import dbClient from '../../dbClient';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithUser } from '../../types/Request';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
      body: ApiSchemas['/v0/files/:uuid.PATCH.request'],
    })
  ),
  validateAccessToken,
  userMiddleware,
  handler,
];

async function handler(req: RequestWithUser, res: Response) {
  const {
    body: { name },
    params: { uuid },
    user: { id: userId },
  } = req;

  const { userMakingRequest } = await getFile({ uuid: req.params.uuid, userId });

  // Can they edit this file?
  if (!userMakingRequest.filePermissions.includes(FILE_EDIT)) {
    return res.status(403).json({ error: { message: 'Permission denied' } });
  }

  // Update the file
  const { name: newName } = await dbClient.file.update({
    where: {
      uuid,
    },
    data: {
      name,
    },
  });

  const data: ApiTypes['/v0/files/:uuid.PATCH.response'] = { name: newName };
  return res.status(200).json(data);
}
