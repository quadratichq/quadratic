import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getScheduledTask } from '../../utils/scheduledTasks';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    scheduledTaskUuid: z.string().uuid(),
  }),
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/files/:uuid/scheduled_task/:scheduledTaskUuid.GET.response']>
) {
  const {
    params: { uuid, scheduledTaskUuid },
  } = parseRequest(req, schema);

  const {
    user: { id: userMakingRequestId },
  } = req;

  const {
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId: userMakingRequestId });

  if (!filePermissions.includes(FILE_EDIT)) {
    throw new ApiError(403, "You don't have access to this file");
  }

  const result = await getScheduledTask(scheduledTaskUuid);

  return res.status(200).json(result);
}
