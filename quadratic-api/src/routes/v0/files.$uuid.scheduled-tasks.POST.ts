import type { Response } from 'express';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import {
  ScheduledTaskCronExpressionSchema,
  ScheduledTaskOperationsSchema,
} from 'quadratic-shared/typesAndSchemasScheduledTasks';
import { z } from 'zod';
import { getFile } from '../../middleware/getFile';
import { userMiddleware } from '../../middleware/user';
import { validateAccessToken } from '../../middleware/validateAccessToken';
import { parseRequest } from '../../middleware/validateRequestSchema';
import type { RequestWithUser } from '../../types/Request';
import { ApiError } from '../../utils/ApiError';
import { createScheduledTask } from '../../utils/scheduledTasks';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [validateAccessToken, userMiddleware, handler];

const createScheduledTaskSchema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
  body: z.object({
    cronExpression: ScheduledTaskCronExpressionSchema,
    operations: ScheduledTaskOperationsSchema,
  }),
});

export type CreateScheduledTaskSchema = z.infer<typeof createScheduledTaskSchema>;

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files/:uuid/scheduled-tasks.POST.response']>) {
  const validatedData = parseRequest(req, createScheduledTaskSchema);

  const {
    body: { cronExpression, operations },
    params: { uuid },
  } = validatedData;

  const {
    user: { id: userMakingRequestId },
  } = req;

  const {
    file: { id: fileId },
    userMakingRequest: { filePermissions, teamPermissions },
  } = await getFile({ uuid, userId: userMakingRequestId });

  if (!filePermissions.includes(FILE_EDIT)) {
    throw new ApiError(403, "You don't have access to this file");
  }
  if (!teamPermissions?.includes('TEAM_EDIT')) {
    throw new ApiError(403, 'You don’t have proper access to this team');
  }

  const result = await createScheduledTask({
    userId: userMakingRequestId,
    fileId,
    cronExpression,
    operations,
  });

  return res.status(201).json(result);
}
