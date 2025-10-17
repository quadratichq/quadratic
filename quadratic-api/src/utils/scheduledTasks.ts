import type { ScheduledTask, ScheduledTaskLog } from '@prisma/client';
import { CronExpressionParser } from 'cron-parser';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../dbClient';
import { ApiError } from './ApiError';

/*
 ===============================
  Scheduled Tasks
 ===============================
*/

export type ScheduledTaskResponse = ApiTypes['/v0/files/:uuid/scheduled_task/:scheduledTaskUuid.GET.response'];

// Convert a database result to a response object
export function resultToScheduledTaskResponse(result: ScheduledTask): ScheduledTaskResponse {
  return {
    ...result,
    nextRunTime: result.nextRunTime.toISOString(),
    lastRunTime: result.lastRunTime?.toISOString() ?? '',
    operations: Array.from(result.operations),
    createdDate: result.createdDate.toISOString(),
    updatedDate: result.updatedDate.toISOString(),
  };
}

// Create a new scheduled task
export async function createScheduledTask(data: {
  userId: number;
  fileId: number;
  cronExpression: string;
  operations: number[];
}): Promise<ScheduledTaskResponse> {
  const result = await dbClient.scheduledTask.create({
    data: {
      ...data,
      nextRunTime: getNextRunTime(data.cronExpression),
      status: 'ACTIVE',

      // Convert number array to Buffer for database storage
      operations: Buffer.from(data.operations),
    },
  });

  return resultToScheduledTaskResponse(result);
}

// Update a scheduled task
export async function updateScheduledTask(data: {
  scheduledTaskId: number;
  cronExpression: string;
  operations?: number[];
}): Promise<ScheduledTaskResponse> {
  const result = await dbClient.scheduledTask.update({
    where: { id: data.scheduledTaskId },
    data: {
      cronExpression: data.cronExpression,
      nextRunTime: getNextRunTime(data.cronExpression),

      // Convert number array to Buffer for database storage
      operations: Buffer.from(data.operations ?? []),
      updatedDate: new Date(),
    },
  });

  return resultToScheduledTaskResponse(result);
}

// Update the status of a scheduled task
export async function updateScheduledTaskStatus(
  scheduledTaskId: number,
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED'
): Promise<void> {
  await dbClient.scheduledTask.update({
    where: { id: scheduledTaskId },
    data: { status },
  });
}

// Update the next run time of a scheduled task
export async function updateScheduledTaskNextRunTime(scheduledTaskId: number, cronExpression: string): Promise<void> {
  const nextRunTime = getNextRunTime(cronExpression);
  await dbClient.scheduledTask.update({
    where: { id: scheduledTaskId },
    data: { nextRunTime },
  });
}

// Get a scheduled task
export async function getScheduledTask(scheduledTaskUuid: string): Promise<ScheduledTaskResponse> {
  const result = await dbClient.scheduledTask.findFirst({
    where: {
      uuid: scheduledTaskUuid,
      status: { not: 'DELETED' },
    },
  });

  if (!result) {
    throw new ApiError(500, `Scheduled task ${scheduledTaskUuid} not found`);
  }

  return resultToScheduledTaskResponse(result);
}

// Get all scheduled tasks for a file
export async function getScheduledTasks(fileId: number): Promise<ScheduledTaskResponse[]> {
  const result = await dbClient.scheduledTask.findMany({
    where: { fileId, status: { not: 'DELETED' } },
    orderBy: { createdDate: 'desc' },
  });

  return result.map(resultToScheduledTaskResponse);
}

// Delete a scheduled task
export async function deleteScheduledTask(scheduledTaskId: number): Promise<void> {
  await updateScheduledTaskStatus(scheduledTaskId, 'DELETED');
}

/*
 ===============================
  Scheduled Task Logs
 ===============================
*/

type ScheduledTaskLogResponse = ApiTypes['/v0/files/:uuid/scheduled_task/:scheduledTaskUuid/log.GET.response'][0];

export function resultToScheduledTaskLogResponse(result: ScheduledTaskLog): ScheduledTaskLogResponse {
  return {
    id: result.id,
    scheduledTaskId: result.scheduledTaskId,
    runId: result.runId,
    status: result.status,
    error: result.error || undefined,
    createdDate: result.createdDate.toISOString(),
  };
}

// Create a scheduled task log
export async function createScheduledTaskLog(data: {
  scheduledTaskId: number;
  runId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  error?: string;
}): Promise<ScheduledTaskLogResponse> {
  const result = await dbClient.scheduledTaskLog.create({ data });

  return resultToScheduledTaskLogResponse(result);
}

// Get scheduled task logs
// Returns the most recent log entry for each distinct run_id, with pagination support
export async function getScheduledTaskLogs(
  scheduledTaskId: number,
  limit: number = 10,
  page: number = 1
): Promise<ScheduledTaskLogResponse[]> {
  const offset = (page - 1) * limit;

  const result = await dbClient.$queryRaw<
    Array<{
      id: number;
      scheduled_task_id: number;
      run_id: string;
      status: string;
      error: string | null;
      created_date: Date;
    }>
  >`
    SELECT * FROM (
      SELECT DISTINCT ON (run_id)
        id,
        scheduled_task_id,
        run_id,
        status,
        error,
        created_date
      FROM 
        "ScheduledTaskLog"
      WHERE
        scheduled_task_id = ${scheduledTaskId}
      ORDER BY 
        run_id, created_date DESC
    ) subquery
    ORDER BY created_date DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  // Map snake_case columns from raw query to camelCase for the response function
  return result.map((row) =>
    resultToScheduledTaskLogResponse({
      id: row.id,
      scheduledTaskId: row.scheduled_task_id,
      runId: row.run_id,
      status: row.status,
      error: row.error,
      createdDate: row.created_date,
    } as ScheduledTaskLog)
  );
}

// Get a scheduled task log
export async function getScheduledTaskLog(scheduledTaskLogId: number): Promise<ScheduledTaskLogResponse> {
  const result = await dbClient.scheduledTaskLog.findUnique({ where: { id: scheduledTaskLogId } });

  if (!result) {
    throw new ApiError(500, `Scheduled task log ${scheduledTaskLogId} not found`);
  }

  return resultToScheduledTaskLogResponse(result);
}

/*
 ===============================
  Helpers
 ===============================
*/
// Get the next run time for a cron expression
export function getNextRunTime(cronExpression: string): Date {
  const parser = CronExpressionParser.parse(cronExpression);
  const nextRunTime = parser.next();

  return nextRunTime.toDate();
}
