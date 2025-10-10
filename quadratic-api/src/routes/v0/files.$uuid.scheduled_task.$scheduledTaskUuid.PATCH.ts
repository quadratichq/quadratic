import type { Response } from 'express';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import {
  ScheduledTaskCronExpressionSchema,
  ScheduledTaskOperationsSchema,
} from 'quadratic-shared/typesAndSchemasScheduledTasks';
import z from 'zod';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getScheduledTask, updateScheduledTask } from '../../utils/scheduledTasks';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    scheduledTaskUuid: z.string().uuid(),
  }),
  body: z.object({
    cronExpression: ScheduledTaskCronExpressionSchema,
    operations: ScheduledTaskOperationsSchema,
  }),
});

async function handler(req: RequestWithUser, res: Response<any>) {
  const {
    params: { uuid, scheduledTaskUuid },
    body,
  } = parseRequest(req, schema);

  const {
    user: { id: userMakingRequestId },
  } = req;

  const {
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId: userMakingRequestId });

  if (!filePermissions.includes(FILE_EDIT)) {
    throw new ApiError(403, 'Permission denied');
  }

  const task = await getScheduledTask(scheduledTaskUuid);
  const result = await updateScheduledTask({
    ...body,
    scheduledTaskId: task.id,
  });

  return res.status(200).json(result);
}
