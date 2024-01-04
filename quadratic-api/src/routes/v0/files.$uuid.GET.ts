import { Response } from 'express';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getFile } from '../../middleware/fileMiddleware';
import { userOptionalMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import { RequestWithOptionalUser } from '../../types/Request';
import { getFilePermissions } from '../../utils/permissions';
import { generatePresignedUrl } from '../files/thumbnail';

export default [
  validateRequestSchema(
    z.object({
      params: z.object({
        uuid: z.string().uuid(),
      }),
    })
  ),
  validateAccessToken,
  userOptionalMiddleware,
  handler,
];

async function handler(req: RequestWithOptionalUser, res: Response) {
  const {
    file: { thumbnail, uuid, name, created_date, updated_date, version, publicLinkAccess, contents },
    user,
  } = await getFile({ uuid: req.params.uuid, userId: req.user?.id });

  const thumbnailSignedUrl = thumbnail ? await generatePresignedUrl(thumbnail) : null;
  const permissions = getFilePermissions({ roleFile: 'OWNER', roleTeam: 'OWNER', publicLinkAccess });

  const data: ApiTypes['/v0/files/:uuid.GET.response'] = {
    file: {
      uuid,
      name,
      created_date: created_date.toISOString(),
      updated_date: updated_date.toISOString(),
      version: version || '',
      publicLinkAccess,
      contents: contents.toString('utf8'),
      thumbnail: thumbnailSignedUrl,
    },
    user: {
      id: user?.id,
      permissions,
      role: user?.role,
    },
  };
  return res.status(200).json(data);
}
