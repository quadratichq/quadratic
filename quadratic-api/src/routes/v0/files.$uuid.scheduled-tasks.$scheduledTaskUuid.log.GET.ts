import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { FilePermissionSchema, TeamPermissionSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getScheduledTask, getScheduledTaskLogs } from '../../utils/scheduledTasks';
const { FILE_VIEW } = FilePermissionSchema.enum;
const { TEAM_VIEW } = TeamPermissionSchema.enum;

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  query: z.object({
    page: z.coerce.number().optional(),
    limit: z.coerce.number().optional(),
  }),
  params: z.object({
    uuid: z.string().uuid(),
    scheduledTaskUuid: z.string().uuid(),
  }),
});

async function handler(
  req: RequestWithUser,
  res: Response<ApiTypes['/v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid/log.GET.response']>
) {
  const {
    params: { uuid, scheduledTaskUuid },
    query: { limit, page },
  } = parseRequest(req, schema);

  const {
    user: { id: userMakingRequestId },
  } = req;

  const {
    userMakingRequest: { filePermissions, teamPermissions },
  } = await getFile({ uuid, userId: userMakingRequestId });

  if (!filePermissions.includes(FILE_VIEW) || !teamPermissions?.includes(TEAM_VIEW)) {
    throw new ApiError(403, 'Permission denied');
  }

  // Verify the scheduled task exists (this will throw 500 if not found)
  await getScheduledTask(scheduledTaskUuid);

  const result = await getScheduledTaskLogs(scheduledTaskUuid, limit, page);

  return res.status(200).json(result);
}
