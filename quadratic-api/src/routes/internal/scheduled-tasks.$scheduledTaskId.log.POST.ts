import type { Response } from 'express';
import express from 'express';
import { validationResult } from 'express-validator';
import z from 'zod';
import { validateM2MAuth } from '../../internal/validateM2MAuth';
import { validateRequestSchema } from '../../middleware/validateRequestSchema';
import type { Request } from '../../types/Request';
import { createScheduledTaskLog, getScheduledTask, updateScheduledTaskNextRunTime } from '../../utils/scheduledTasks';

const router = express.Router();

const requestValidationMiddleware = validateRequestSchema(
  z.object({
    body: z.object({
      sequenceNumber: z.number(),
      version: z.string(),
      s3Key: z.string(),
      s3Bucket: z.string(),
    }),
    params: z.object({
      uuid: z.string().uuid(),
    }),
  })
);

router.post(
  '/scheduled-tasks/:scheduledTaskId/log',
  validateM2MAuth(),
  requestValidationMiddleware,
  async (req: Request, res: Response) => {
    // Validate request parameters
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const scheduledTask = await getScheduledTask(req.params.scheduledTaskId);
    const result = await createScheduledTaskLog({
      scheduledTaskId: scheduledTask.id,
      status: req.body.status,
      error: req.body.error,
    });

    // if the task is pending, update the next run time
    if (result.status === 'PENDING') {
      await updateScheduledTaskNextRunTime(scheduledTask.id, scheduledTask.cronExpression);
    }

    return res.status(200).json(result);
  }
);

export default router;
