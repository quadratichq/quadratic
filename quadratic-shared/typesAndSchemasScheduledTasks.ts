import CronExpressionParser from 'cron-parser';
import z from 'zod';

export const ScheduledTaskCronExpressionSchema = z
  .string()
  .min(1, 'cronExpression is required')
  .refine((val) => {
    try {
      CronExpressionParser.parse(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid cron expression');

export const ScheduledTaskOperationsSchema = z.array(z.number());

export const ScheduledTaskSchema = z.object({
  id: z.number(),
  uuid: z.string(),
  fileId: z.number(),
  userId: z.number(),
  nextRunTime: z.string().datetime(),
  lastRunTime: z.string().datetime().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DELETED']),
  cronExpression: ScheduledTaskCronExpressionSchema,
  operations: ScheduledTaskOperationsSchema,
  createdDate: z.string().datetime(),
  updatedDate: z.string().datetime(),
});

export type ScheduledTask = z.infer<typeof ScheduledTaskSchema>;

export const ScheduledTaskLogSchema = z.object({
  id: z.number(),
  scheduledTaskId: z.number(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']),
  error: z.string().optional(),
  createdDate: z.string().datetime(),
});

export const ApiSchemasScheduledTasks = {
  // List Scheduled Tasks
  '/v0/files/:uuid/scheduled_task.GET.response': z.array(ScheduledTaskSchema),

  // Create a Scheduled Task
  '/v0/files/:uuid/scheduled_task.POST.request': z.object({
    cronExpression: ScheduledTaskCronExpressionSchema,
    operations: ScheduledTaskOperationsSchema,
  }),
  '/v0/files/:uuid/scheduled_task.POST.response': ScheduledTaskSchema,

  // Get a Scheduled Task
  '/v0/files/:uuid/scheduled_task/:scheduledTaskUuid.GET.response': ScheduledTaskSchema,

  // Update a Scheduled Task
  '/v0/files/:uuid/scheduled_task/:scheduledTaskUuid.PATCH.request': z.object({
    cronExpression: ScheduledTaskCronExpressionSchema,
    operations: ScheduledTaskOperationsSchema,
  }),
  '/v0/files/:uuid/scheduled_task/:scheduledTaskUuid.PATCH.response': ScheduledTaskSchema,

  // Delete a Scheduled Task
  '/v0/files/:uuid/scheduled_task/:scheduledTaskUuid.DELETE.response': z.object({ message: z.string() }),

  // List Scheduled Task Logs
  '/v0/files/:uuid/scheduled_task/:scheduledTaskUuid/log.GET.response': z.array(ScheduledTaskLogSchema),
};
