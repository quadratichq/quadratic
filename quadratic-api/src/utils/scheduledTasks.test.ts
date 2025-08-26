import { CronExpressionParser } from 'cron-parser';
import dbClient from '../dbClient';
import { clearDb, createUserTeamAndFile } from '../tests/testDataGenerator';
import {
  createScheduledTask,
  createScheduledTaskLog,
  deleteScheduledTask,
  getNextRunTime,
  getScheduledTask,
  getScheduledTaskLog,
  getScheduledTaskLogs,
  getScheduledTasks,
  resultToScheduledTaskLogResponse,
  resultToScheduledTaskResponse,
  updateScheduledTask,
  updateScheduledTaskStatus,
} from './scheduledTasks';

describe('scheduledTasks utilities', () => {
  let testUser: any;
  let testFile: any;
  let uniqueId: string;

  beforeEach(async () => {
    await clearDb();
    ({ uniqueId, testUser, testFile } = await createUserTeamAndFile());
  });

  afterEach(async () => {
    await clearDb();
  });

  describe('getNextRunTime', () => {
    it('should calculate next run time for valid cron expressions', () => {
      const cronExpressions = [
        '0 0 * * *', // Daily at midnight
        '0 */6 * * *', // Every 6 hours
        '0 0 * * 1', // Every Monday at midnight
        '30 14 * * *', // Daily at 2:30 PM
        '0 9 * * 1-5', // Weekdays at 9 AM
        '*/15 * * * *', // Every 15 minutes
        '0 0 1 * *', // First day of every month
        '0 0 * * 0', // Every Sunday
      ];

      for (const cron of cronExpressions) {
        const nextRunTime = getNextRunTime(cron);
        expect(nextRunTime).toBeInstanceOf(Date);
        expect(nextRunTime.getTime()).toBeGreaterThan(Date.now());

        // Verify it matches cron-parser result
        const parser = CronExpressionParser.parse(cron);
        const expectedNextRunTime = parser.next().toDate();
        expect(Math.abs(nextRunTime.getTime() - expectedNextRunTime.getTime())).toBeLessThan(1000);
      }
    });

    it('should throw error for invalid cron expressions', () => {
      const invalidCronExpressions = [
        'invalid cron',
        '60 0 * * *', // Invalid minute
        '0 25 * * *', // Invalid hour
        '0 0 32 * *', // Invalid day
        '0 0 * 13 *', // Invalid month
        '0 0 * * 8', // Invalid day of week
        '', // Empty string
        '* * * *', // Too few fields
        '* * * * * *', // Too many fields
      ];

      for (const cron of invalidCronExpressions) {
        expect(() => getNextRunTime(cron)).toThrow();
      }
    });

    it('should handle edge cases in cron expressions', () => {
      // Test leap year handling
      const nextRunTime = getNextRunTime('0 0 29 2 *'); // Feb 29th
      expect(nextRunTime).toBeInstanceOf(Date);

      // Test end of month
      const endOfMonth = getNextRunTime('0 0 31 * *'); // 31st of month
      expect(endOfMonth).toBeInstanceOf(Date);
    });
  });

  describe('resultToScheduledTaskResponse', () => {
    it('should convert database result to response format', async () => {
      const operations = { action: 'test', type: 'daily' };
      const cronExpression = '0 0 * * *';

      const dbResult = await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression,
          nextRunTime: getNextRunTime(cronExpression),
          status: 'ACTIVE',
          operations: Buffer.from(JSON.stringify(operations)),
        },
      });

      const response = resultToScheduledTaskResponse(dbResult);

      expect(response).toMatchObject({
        id: dbResult.id,
        uuid: dbResult.uuid,
        fileId: testFile.id,
        userId: testUser.id,
        cronExpression,
        operations,
        status: 'ACTIVE',
      });

      expect(typeof response.nextRunTime).toBe('string');
      expect(typeof response.lastRunTime).toBe('string');
      expect(typeof response.createdDate).toBe('string');
      expect(typeof response.updatedDate).toBe('string');

      // Verify date strings are valid ISO dates
      expect(new Date(response.nextRunTime).toISOString()).toBe(response.nextRunTime);
      expect(new Date(response.createdDate).toISOString()).toBe(response.createdDate);
      expect(new Date(response.updatedDate).toISOString()).toBe(response.updatedDate);

      // lastRunTime should be empty string when null
      expect(response.lastRunTime).toBe('');
    });

    it('should handle lastRunTime when not null', async () => {
      const operations = { action: 'test' };
      const cronExpression = '0 0 * * *';
      const lastRunTime = new Date();

      const dbResult = await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression,
          nextRunTime: getNextRunTime(cronExpression),
          lastRunTime,
          status: 'ACTIVE',
          operations: Buffer.from(JSON.stringify(operations)),
        },
      });

      const response = resultToScheduledTaskResponse(dbResult);

      expect(response.lastRunTime).toBe(lastRunTime.toISOString());
    });

    it('should handle complex operations objects', async () => {
      const complexOperations = {
        type: 'data_pipeline',
        steps: [
          {
            name: 'extract',
            source: { type: 'database', connection: 'prod-db' },
            query: 'SELECT * FROM users WHERE created_date >= ?',
            parameters: ['{{yesterday}}'],
          },
          {
            name: 'transform',
            rules: [
              { field: 'email', action: 'lowercase' },
              { field: 'phone', action: 'normalize' },
            ],
          },
        ],
        notifications: {
          onSuccess: ['data-team@example.com'],
          onFailure: ['alerts@example.com'],
        },
      };

      const dbResult = await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 0 * * *',
          nextRunTime: getNextRunTime('0 0 * * *'),
          status: 'ACTIVE',
          operations: Buffer.from(JSON.stringify(complexOperations)),
        },
      });

      const response = resultToScheduledTaskResponse(dbResult);
      expect(response.operations).toEqual(complexOperations);
    });
  });

  describe('createScheduledTask', () => {
    it('should create a new scheduled task with correct defaults', async () => {
      const operations = { action: 'backup', type: 'daily' };
      const cronExpression = '0 2 * * *';

      const result = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression,
        operations,
      });

      expect(result).toMatchObject({
        fileId: testFile.id,
        userId: testUser.id,
        cronExpression,
        operations,
        status: 'ACTIVE',
      });

      expect(result.id).toBeDefined();
      expect(result.uuid).toBeDefined();
      expect(typeof result.nextRunTime).toBe('string');
      expect(result.lastRunTime).toBe('');
      expect(typeof result.createdDate).toBe('string');
      expect(typeof result.updatedDate).toBe('string');

      // Verify nextRunTime is in the future
      const nextRunTime = new Date(result.nextRunTime);
      expect(nextRunTime.getTime()).toBeGreaterThan(Date.now());

      // Verify task exists in database
      const dbTask = await dbClient.scheduledTask.findUnique({
        where: { id: result.id },
      });
      expect(dbTask).toBeDefined();
      expect(dbTask!.status).toBe('ACTIVE');
    });

    it('should handle different cron expressions', async () => {
      const cronExpressions = ['0 0 * * *', '*/15 * * * *', '0 9 * * 1-5', '30 14 * * *'];

      for (const cron of cronExpressions) {
        const result = await createScheduledTask({
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: cron,
          operations: { action: 'test', cron },
        });

        expect(result.cronExpression).toBe(cron);
        const nextRunTime = new Date(result.nextRunTime);
        expect(nextRunTime.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('should handle complex operations objects', async () => {
      const complexOperations = {
        type: 'data_processing',
        config: {
          batchSize: 100,
          retryAttempts: 3,
          timeout: 30000,
        },
        steps: [
          { name: 'validate', rules: ['required', 'format'] },
          { name: 'transform', mappings: { field1: 'newField1' } },
        ],
        notifications: {
          email: ['admin@example.com'],
          webhook: 'https://example.com/webhook',
        },
      };

      const result = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: complexOperations,
      });

      expect(result.operations).toEqual(complexOperations);
    });

    it('should handle operations with special characters and unicode', async () => {
      const specialOperations = {
        message: 'Special chars: àáâãäåçèéêë 中文 العربية 🚀🔥💯',
        sql: "SELECT * FROM table WHERE name = 'O''Reilly'",
        unicode: '\u{1F600}\u{1F601}\u{1F602}',
        json: '{"key": "value with \\"quotes\\""}',
      };

      const result = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: specialOperations,
      });

      expect(result.operations).toEqual(specialOperations);
    });

    it('should handle operations with null and falsy values', async () => {
      const operationsWithNulls = {
        nullValue: null,
        emptyString: '',
        zeroNumber: 0,
        falseBoolean: false,
        emptyArray: [],
        emptyObject: {},
      };

      const result = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: operationsWithNulls,
      });

      expect(result.operations).toEqual(operationsWithNulls);
    });
  });

  describe('updateScheduledTask', () => {
    let existingTask: any;

    beforeEach(async () => {
      existingTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: { action: 'original' },
      });
    });

    it('should update cronExpression and operations', async () => {
      const newCronExpression = '0 2 * * *';
      const newOperations = { action: 'updated', type: 'nightly' };

      const result = await updateScheduledTask({
        scheduledTaskId: existingTask.id,
        cronExpression: newCronExpression,
        operations: newOperations,
      });

      expect(result.id).toBe(existingTask.id);
      expect(result.uuid).toBe(existingTask.uuid);
      expect(result.cronExpression).toBe(newCronExpression);
      expect(result.operations).toEqual(newOperations);

      // Verify nextRunTime was recalculated
      expect(result.nextRunTime).not.toBe(existingTask.nextRunTime);
      const nextRunTime = new Date(result.nextRunTime);
      expect(nextRunTime.getTime()).toBeGreaterThan(Date.now());

      // Verify updatedDate changed
      expect(result.updatedDate).not.toBe(existingTask.updatedDate);

      // Verify other fields remained the same
      expect(result.fileId).toBe(existingTask.fileId);
      expect(result.userId).toBe(existingTask.userId);
      expect(result.status).toBe(existingTask.status);
      expect(result.createdDate).toBe(existingTask.createdDate);
    });

    it('should handle complex operations updates', async () => {
      const complexOperations = {
        type: 'advanced_pipeline',
        stages: [
          {
            name: 'preprocessing',
            config: { cleanData: true, validateSchema: true },
          },
          {
            name: 'processing',
            config: { algorithm: 'ml_model_v2', parameters: { threshold: 0.85 } },
          },
        ],
        postProcessing: {
          notifications: ['team@example.com'],
          archival: { enabled: true, retention: '30d' },
        },
      };

      const result = await updateScheduledTask({
        scheduledTaskId: existingTask.id,
        cronExpression: '0 3 * * *',
        operations: complexOperations,
      });

      expect(result.operations).toEqual(complexOperations);
    });

    it('should throw error for non-existent task', async () => {
      await expect(
        updateScheduledTask({
          scheduledTaskId: 99999,
          cronExpression: '0 1 * * *',
          operations: { action: 'test' },
        })
      ).rejects.toThrow();
    });

    it('should handle different cron expressions', async () => {
      const cronExpressions = [
        '*/30 * * * *', // Every 30 minutes
        '0 */4 * * *', // Every 4 hours
        '0 0 * * 1-5', // Weekdays only
        '0 12 1 * *', // First day of month at noon
      ];

      for (const cron of cronExpressions) {
        const result = await updateScheduledTask({
          scheduledTaskId: existingTask.id,
          cronExpression: cron,
          operations: { action: 'test', cron },
        });

        expect(result.cronExpression).toBe(cron);
        const nextRunTime = new Date(result.nextRunTime);
        expect(nextRunTime.getTime()).toBeGreaterThan(Date.now());
      }
    });
  });

  describe('updateScheduledTaskStatus', () => {
    let existingTask: any;

    beforeEach(async () => {
      existingTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: { action: 'test' },
      });
    });

    it('should update task status to INACTIVE', async () => {
      await updateScheduledTaskStatus(existingTask.id, 'INACTIVE');

      const dbTask = await dbClient.scheduledTask.findUnique({
        where: { id: existingTask.id },
      });

      expect(dbTask!.status).toBe('INACTIVE');
    });

    it('should update task status to DELETED', async () => {
      await updateScheduledTaskStatus(existingTask.id, 'DELETED');

      const dbTask = await dbClient.scheduledTask.findUnique({
        where: { id: existingTask.id },
      });

      expect(dbTask!.status).toBe('DELETED');
    });

    it('should update task status back to ACTIVE', async () => {
      // First set to INACTIVE
      await updateScheduledTaskStatus(existingTask.id, 'INACTIVE');

      // Then back to ACTIVE
      await updateScheduledTaskStatus(existingTask.id, 'ACTIVE');

      const dbTask = await dbClient.scheduledTask.findUnique({
        where: { id: existingTask.id },
      });

      expect(dbTask!.status).toBe('ACTIVE');
    });

    it('should throw error for non-existent task', async () => {
      await expect(updateScheduledTaskStatus(99999, 'INACTIVE')).rejects.toThrow();
    });
  });

  describe('getScheduledTask', () => {
    let existingTask: any;

    beforeEach(async () => {
      existingTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: { action: 'test' },
      });
    });

    it('should retrieve existing scheduled task', async () => {
      const result = await getScheduledTask(existingTask.uuid);

      expect(result).toMatchObject({
        id: existingTask.id,
        uuid: existingTask.uuid,
        fileId: testFile.id,
        userId: testUser.id,
        cronExpression: '0 0 * * *',
        operations: { action: 'test' },
        status: 'ACTIVE',
      });
    });

    it('should throw error for non-existent task', async () => {
      await expect(getScheduledTask('12345678-1234-1234-1234-123456789012')).rejects.toThrow(
        'Scheduled task 12345678-1234-1234-1234-123456789012 not found'
      );
    });

    it('should not retrieve deleted tasks', async () => {
      // Delete the task
      await updateScheduledTaskStatus(existingTask.id, 'DELETED');

      // Should not be able to retrieve it
      await expect(getScheduledTask(existingTask.uuid)).rejects.toThrow();
    });

    it('should retrieve inactive tasks', async () => {
      // Set task to inactive
      await updateScheduledTaskStatus(existingTask.id, 'INACTIVE');

      const result = await getScheduledTask(existingTask.uuid);
      expect(result.status).toBe('INACTIVE');
    });
  });

  describe('getScheduledTasks', () => {
    it('should return empty array when no tasks exist', async () => {
      const result = await getScheduledTasks(testFile.id);
      expect(result).toEqual([]);
    });

    it('should return single task when one exists', async () => {
      const task = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: { action: 'test' },
      });

      const result = await getScheduledTasks(testFile.id);
      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe(task.uuid);
    });

    it('should return multiple tasks when multiple exist', async () => {
      const task1 = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 1 * * *',
        operations: { action: 'task1' },
      });

      const task2 = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 2 * * *',
        operations: { action: 'task2' },
      });

      const result = await getScheduledTasks(testFile.id);
      expect(result).toHaveLength(2);

      const taskUuids = result.map((t) => t.uuid);
      expect(taskUuids).toContain(task1.uuid);
      expect(taskUuids).toContain(task2.uuid);
    });

    it('should not return deleted tasks', async () => {
      const activeTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 1 * * *',
        operations: { action: 'active' },
      });

      const deletedTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 2 * * *',
        operations: { action: 'deleted' },
      });

      // Delete one task
      await updateScheduledTaskStatus(deletedTask.id, 'DELETED');

      const result = await getScheduledTasks(testFile.id);
      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe(activeTask.uuid);
    });

    it('should return inactive tasks but not deleted ones', async () => {
      const activeTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 1 * * *',
        operations: { action: 'active' },
      });

      const inactiveTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 2 * * *',
        operations: { action: 'inactive' },
      });

      const deletedTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 3 * * *',
        operations: { action: 'deleted' },
      });

      // Update statuses
      await updateScheduledTaskStatus(inactiveTask.id, 'INACTIVE');
      await updateScheduledTaskStatus(deletedTask.id, 'DELETED');

      const result = await getScheduledTasks(testFile.id);
      expect(result).toHaveLength(2);

      const taskActions = result.map((t) => t.operations.action);
      expect(taskActions).toContain('active');
      expect(taskActions).toContain('inactive');
      expect(taskActions).not.toContain('deleted');
    });

    it('should only return tasks for specified file', async () => {
      // Create another file
      const { testFile: otherFile } = await createUserTeamAndFile();

      // Create tasks for both files
      const task1 = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 1 * * *',
        operations: { action: 'file1_task' },
      });

      const task2 = await createScheduledTask({
        userId: testUser.id,
        fileId: otherFile.id,
        cronExpression: '0 2 * * *',
        operations: { action: 'file2_task' },
      });

      // Get tasks for first file
      const result1 = await getScheduledTasks(testFile.id);
      expect(result1).toHaveLength(1);
      expect(result1[0].operations.action).toBe('file1_task');

      // Get tasks for second file
      const result2 = await getScheduledTasks(otherFile.id);
      expect(result2).toHaveLength(1);
      expect(result2[0].operations.action).toBe('file2_task');
    });
  });

  describe('deleteScheduledTask', () => {
    let existingTask: any;

    beforeEach(async () => {
      existingTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: { action: 'test' },
      });
    });

    it('should soft delete scheduled task', async () => {
      await deleteScheduledTask(existingTask.id);

      // Task should still exist in database but with DELETED status
      const dbTask = await dbClient.scheduledTask.findUnique({
        where: { id: existingTask.id },
      });

      expect(dbTask).toBeDefined();
      expect(dbTask!.status).toBe('DELETED');
    });

    it('should not be retrievable after deletion', async () => {
      await deleteScheduledTask(existingTask.id);

      // Should not be returned by getScheduledTask
      await expect(getScheduledTask(existingTask.uuid)).rejects.toThrow();

      // Should not be returned by getScheduledTasks
      const tasks = await getScheduledTasks(testFile.id);
      expect(tasks).toHaveLength(0);
    });

    it('should throw error for non-existent task', async () => {
      await expect(deleteScheduledTask(99999)).rejects.toThrow();
    });
  });

  describe('Scheduled Task Logs', () => {
    let existingTask: any;

    beforeEach(async () => {
      existingTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: { action: 'test' },
      });
    });

    describe('resultToScheduledTaskLogResponse', () => {
      it('should convert database result to response format', async () => {
        const dbLog = await dbClient.scheduledTaskLog.create({
          data: {
            scheduledTaskId: existingTask.id,
            status: 'COMPLETED',
            error: null,
          },
        });

        const response = resultToScheduledTaskLogResponse(dbLog);

        expect(response).toMatchObject({
          id: dbLog.id,
          scheduledTaskId: existingTask.id,
          status: 'COMPLETED',
        });

        expect(typeof response.createdDate).toBe('string');
        expect(new Date(response.createdDate).toISOString()).toBe(response.createdDate);
        expect(response.error).toBeUndefined();
      });

      it('should handle error field when present', async () => {
        const errorMessage = 'Connection timeout';
        const dbLog = await dbClient.scheduledTaskLog.create({
          data: {
            scheduledTaskId: existingTask.id,
            status: 'FAILED',
            error: errorMessage,
          },
        });

        const response = resultToScheduledTaskLogResponse(dbLog);
        expect(response.error).toBe(errorMessage);
      });
    });

    describe('createScheduledTaskLog', () => {
      it('should create log with PENDING status', async () => {
        const result = await createScheduledTaskLog({
          scheduledTaskId: existingTask.id,
          status: 'PENDING',
        });

        expect(result).toMatchObject({
          scheduledTaskId: existingTask.id,
          status: 'PENDING',
        });

        expect(result.id).toBeDefined();
        expect(typeof result.createdDate).toBe('string');
        expect(result.error).toBeUndefined();
      });

      it('should create log with FAILED status and error message', async () => {
        const errorMessage = 'Database connection failed';
        const result = await createScheduledTaskLog({
          scheduledTaskId: existingTask.id,
          status: 'FAILED',
          error: errorMessage,
        });

        expect(result.status).toBe('FAILED');
        expect(result.error).toBe(errorMessage);
      });

      it('should create logs with different statuses', async () => {
        const statuses: Array<'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'> = [
          'PENDING',
          'RUNNING',
          'COMPLETED',
          'FAILED',
        ];

        for (const status of statuses) {
          const result = await createScheduledTaskLog({
            scheduledTaskId: existingTask.id,
            status,
          });

          expect(result.status).toBe(status);
        }
      });
    });

    describe('getScheduledTaskLogs', () => {
      it('should return empty array when no logs exist', async () => {
        const result = await getScheduledTaskLogs(existingTask.id);
        expect(result).toEqual([]);
      });

      it('should return single log when one exists', async () => {
        const log = await createScheduledTaskLog({
          scheduledTaskId: existingTask.id,
          status: 'COMPLETED',
        });

        const result = await getScheduledTaskLogs(existingTask.id);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(log.id);
      });

      it('should return multiple logs in order', async () => {
        const log1 = await createScheduledTaskLog({
          scheduledTaskId: existingTask.id,
          status: 'PENDING',
        });

        // Small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));

        const log2 = await createScheduledTaskLog({
          scheduledTaskId: existingTask.id,
          status: 'RUNNING',
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        const log3 = await createScheduledTaskLog({
          scheduledTaskId: existingTask.id,
          status: 'COMPLETED',
        });

        const result = await getScheduledTaskLogs(existingTask.id);
        expect(result).toHaveLength(3);

        const logIds = result.map((log) => log.id);
        expect(logIds).toContain(log1.id);
        expect(logIds).toContain(log2.id);
        expect(logIds).toContain(log3.id);
      });

      it('should only return logs for specified task', async () => {
        // Create another task
        const otherTask = await createScheduledTask({
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 1 * * *',
          operations: { action: 'other' },
        });

        // Create logs for both tasks
        const log1 = await createScheduledTaskLog({
          scheduledTaskId: existingTask.id,
          status: 'COMPLETED',
        });

        const log2 = await createScheduledTaskLog({
          scheduledTaskId: otherTask.id,
          status: 'FAILED',
        });

        // Get logs for first task
        const result1 = await getScheduledTaskLogs(existingTask.id);
        expect(result1).toHaveLength(1);
        expect(result1[0].id).toBe(log1.id);

        // Get logs for second task
        const result2 = await getScheduledTaskLogs(otherTask.id);
        expect(result2).toHaveLength(1);
        expect(result2[0].id).toBe(log2.id);
      });
    });

    describe('getScheduledTaskLog', () => {
      it('should retrieve existing log', async () => {
        const log = await createScheduledTaskLog({
          scheduledTaskId: existingTask.id,
          status: 'COMPLETED',
        });

        const result = await getScheduledTaskLog(log.id);
        expect(result).toMatchObject({
          id: log.id,
          scheduledTaskId: existingTask.id,
          status: 'COMPLETED',
        });
      });

      it('should throw error for non-existent log', async () => {
        await expect(getScheduledTaskLog(99999)).rejects.toThrow('Scheduled task log 99999 not found');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete task lifecycle', async () => {
      // Create task
      const task = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: { action: 'lifecycle_test' },
      });

      // Create logs
      const pendingLog = await createScheduledTaskLog({
        scheduledTaskId: task.id,
        status: 'PENDING',
      });

      const runningLog = await createScheduledTaskLog({
        scheduledTaskId: task.id,
        status: 'RUNNING',
      });

      const completedLog = await createScheduledTaskLog({
        scheduledTaskId: task.id,
        status: 'COMPLETED',
      });

      // Update task
      const updatedTask = await updateScheduledTask({
        scheduledTaskId: task.id,
        cronExpression: '0 2 * * *',
        operations: { action: 'updated_lifecycle_test' },
      });

      // Verify task was updated
      expect(updatedTask.cronExpression).toBe('0 2 * * *');
      expect(updatedTask.operations.action).toBe('updated_lifecycle_test');

      // Verify logs still exist
      const logs = await getScheduledTaskLogs(task.id);
      expect(logs).toHaveLength(3);

      // Set task inactive
      await updateScheduledTaskStatus(task.id, 'INACTIVE');

      // Verify task is still retrievable but inactive
      const inactiveTask = await getScheduledTask(task.uuid);
      expect(inactiveTask.status).toBe('INACTIVE');

      // Delete task
      await deleteScheduledTask(task.id);

      // Verify task is no longer retrievable
      await expect(getScheduledTask(task.uuid)).rejects.toThrow();

      // Verify logs still exist (logs are not deleted when task is deleted)
      const logsAfterDeletion = await getScheduledTaskLogs(task.id);
      expect(logsAfterDeletion).toHaveLength(3);
    });

    it('should handle concurrent operations on different tasks', async () => {
      const tasks = await Promise.all([
        createScheduledTask({
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 1 * * *',
          operations: { action: 'concurrent1' },
        }),
        createScheduledTask({
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 2 * * *',
          operations: { action: 'concurrent2' },
        }),
        createScheduledTask({
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 3 * * *',
          operations: { action: 'concurrent3' },
        }),
      ]);

      // Perform concurrent operations
      await Promise.all([
        updateScheduledTask({
          scheduledTaskId: tasks[0].id,
          cronExpression: '0 4 * * *',
          operations: { action: 'updated_concurrent1' },
        }),
        createScheduledTaskLog({
          scheduledTaskId: tasks[1].id,
          status: 'RUNNING',
        }),
        updateScheduledTaskStatus(tasks[2].id, 'INACTIVE'),
      ]);

      // Verify all operations completed successfully
      const updatedTask1 = await getScheduledTask(tasks[0].uuid);
      expect(updatedTask1.operations.action).toBe('updated_concurrent1');

      const task2Logs = await getScheduledTaskLogs(tasks[1].id);
      expect(task2Logs).toHaveLength(1);
      expect(task2Logs[0].status).toBe('RUNNING');

      const updatedTask3 = await getScheduledTask(tasks[2].uuid);
      expect(updatedTask3.status).toBe('INACTIVE');
    });
  });
});
