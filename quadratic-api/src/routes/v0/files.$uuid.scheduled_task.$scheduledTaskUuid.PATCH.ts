import type { Response } from 'express';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import z from 'zod';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { getNextRunTime, getScheduledTask, updateScheduledTask } from '../../utils/scheduledTasks';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [validateAccessToken, userMiddleware, handler];

const schema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
    scheduledTaskUuid: z.string().uuid(),
  }),
  body: z.object({
    cronExpression: z
      .string()
      .min(1, 'cronExpression is required')
      .refine((val) => {
        try {
          getNextRunTime(val);
          return true;
        } catch {
          return false;
        }
      }, 'Invalid cron expression'),
    operations: z.record(z.any()),
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

  // First get the scheduled task to retrieve its numeric ID
  const existingTask = await getScheduledTask(scheduledTaskUuid);

  const result = await updateScheduledTask({
    ...body,
    scheduledTaskId: existingTask.id,
  });

  return res.status(200).json(result);
}
