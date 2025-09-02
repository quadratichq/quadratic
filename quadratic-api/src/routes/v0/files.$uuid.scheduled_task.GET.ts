import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import { z } from 'zod';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getScheduledTasks } from '../../utils/scheduledTasks';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files/:uuid/scheduled_task.GET.response']>) {
  const validatedData = parseRequest(req, schema);

  const {
    params: { uuid },
  } = validatedData;

  const {
    user: { id: userMakingRequestId },
  } = req;

  const {
    file: { id: fileId },
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId: userMakingRequestId });

  if (!filePermissions.includes(FILE_EDIT)) {
    throw new ApiError(403, 'Permission denied');
  }

  const result = await getScheduledTasks(fileId);

  return res.status(200).json(result);
}
