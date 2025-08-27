import type { ScheduledTask, ScheduledTaskLog } from '@prisma/client';
import { CronExpressionParser } from 'cron-parser';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import dbClient from '../dbClient';

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
    lastRunTime: result.lastRunTime?.toISOString() || '',
    operations: JSON.parse(result.operations.toString()),
    createdDate: result.createdDate.toISOString(),
    updatedDate: result.updatedDate.toISOString(),
  };
}

// Create a new scheduled task
export async function createScheduledTask(data: {
  userId: number;
  fileId: number;
  cronExpression: string;
  operations: any;
}): Promise<ScheduledTaskResponse> {
  const result = await dbClient.scheduledTask.create({
    data: {
      ...data,
      nextRunTime: getNextRunTime(data.cronExpression),
      status: 'ACTIVE',
      operations: Buffer.from(JSON.stringify(data.operations)),
    },
  });

  return resultToScheduledTaskResponse(result);
}

// Update a scheduled task
export async function updateScheduledTask(data: {
  scheduledTaskId: number;
  cronExpression: string;
  operations: any;
}): Promise<ScheduledTaskResponse> {
  const result = await dbClient.scheduledTask.update({
    where: { id: data.scheduledTaskId },
    data: {
      cronExpression: data.cronExpression,
      nextRunTime: getNextRunTime(data.cronExpression),
      operations: Buffer.from(JSON.stringify(data.operations)),
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

// Get a scheduled task
export async function getScheduledTask(scheduledTaskUuid: string): Promise<ScheduledTaskResponse> {
  const result = await dbClient.scheduledTask.findFirst({
    where: {
      uuid: scheduledTaskUuid,
      status: { not: 'DELETED' },
    },
  });

  if (!result) {
    throw new Error(`Scheduled task ${scheduledTaskUuid} not found`);
  }

  return resultToScheduledTaskResponse(result);
}

// Get all scheduled tasks for a file
export async function getScheduledTasks(fileId: number): Promise<ScheduledTaskResponse[]> {
  const result = await dbClient.scheduledTask.findMany({
    where: { fileId, status: { not: 'DELETED' } },
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
    ...result,
    createdDate: result.createdDate.toISOString(),
    error: result.error || undefined,
  };
}

// Create a scheduled task log
export async function createScheduledTaskLog(data: {
  scheduledTaskId: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  error?: string;
}): Promise<ScheduledTaskLogResponse> {
  const result = await dbClient.scheduledTaskLog.create({ data });

  return resultToScheduledTaskLogResponse(result);
}

// Get scheduled task logs
export async function getScheduledTaskLogs(scheduledTaskId: number): Promise<ScheduledTaskLogResponse[]> {
  const result = await dbClient.scheduledTaskLog.findMany({ where: { scheduledTaskId } });
  return result.map(resultToScheduledTaskLogResponse);
}

// Get a scheduled task log
export async function getScheduledTaskLog(scheduledTaskLogId: number): Promise<ScheduledTaskLogResponse> {
  const result = await dbClient.scheduledTaskLog.findUnique({ where: { id: scheduledTaskLogId } });

  if (!result) {
    throw new Error(`Scheduled task log ${scheduledTaskLogId} not found`);
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
