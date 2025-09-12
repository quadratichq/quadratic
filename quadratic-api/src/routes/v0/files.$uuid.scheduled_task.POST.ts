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
import { createScheduledTask, getNextRunTime } from '../../utils/scheduledTasks';
const { FILE_EDIT } = FilePermissionSchema.enum;

export default [validateAccessToken, userMiddleware, handler];

const createScheduledTaskSchema = z.object({
  params: z.object({
    uuid: z.string().uuid(),
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
    operations: z
      .any()
      .refine((val) => {
        // Accept actual Buffer instances
        if (Buffer.isBuffer(val)) {
          return true;
        }
        // Accept serialized Buffer objects from HTTP requests
        if (val && typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
          return true;
        }
        return false;
      }, 'Operations must be a Buffer')
      .transform((val) => {
        // Return Buffer instances as-is
        if (Buffer.isBuffer(val)) {
          return val;
        }
        // Convert serialized Buffer objects back to Buffer
        if (val && typeof val === 'object' && val.type === 'Buffer' && Array.isArray(val.data)) {
          return Buffer.from(val.data);
        }
        // This should never happen due to refine check above
        throw new Error('Invalid operations format');
      }),
  }),
});

export type CreateScheduledTaskSchema = z.infer<typeof createScheduledTaskSchema>;

async function handler(req: RequestWithUser, res: Response<ApiTypes['/v0/files/:uuid/scheduled_task.POST.response']>) {
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
    userMakingRequest: { filePermissions },
  } = await getFile({ uuid, userId: userMakingRequestId });

  if (!filePermissions.includes(FILE_EDIT)) {
    throw new ApiError(403, "You don't have access to this file");
  }

  const result = await createScheduledTask({
    userId: userMakingRequestId,
    fileId,
    cronExpression,
    operations,
  });

  return res.status(201).json(result);
}
