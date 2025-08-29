import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import request from 'supertest';
import { app } from '../../app';
import { genericAuth0Mock } from '../../tests/auth0Mock';
import { clearDb, createUserTeamAndFile, scheduledTask } from '../../tests/testDataGenerator';
import { createScheduledTask } from '../../utils/scheduledTasks';

type ScheduledTasksResponse = ApiTypes['/v0/files/:uuid/scheduled_task.GET.response'];

jest.mock('auth0', () => genericAuth0Mock());

describe('GET /v0/files/:uuid/scheduled_task', () => {
  let testUser: any;
  let otherUser: any;
  let testFile: any;
  let testTeam: any;
  let uniqueId: string;

  beforeEach(async () => {
    await clearDb();

    ({ uniqueId, testUser, testTeam, testFile } = await createUserTeamAndFile());
  });

  afterEach(async () => {
    await clearDb();
  });

  describe('Request Validation', () => {
    it('should return 400 for invalid file UUID parameter format', async () => {
      const response = await request(app)
        .get('/v0/files/invalid-uuid/scheduled_task')
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get(`/v0/files/${testFile.uuid}/scheduled_task`);

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks FILE_EDIT permission', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken other-user-${uniqueId}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Permission denied');
    });
  });

  describe('File Permission Checks', () => {
    it('should succeed when user has FILE_EDIT permission (file owner)', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Scheduled Tasks Retrieval', () => {
    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get('/v0/files/12345678-1234-1234-1234-123456789012/scheduled_task')
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(404);
    });

    it('should return empty array when no scheduled tasks exist', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return single scheduled task when one exists', async () => {
      const testScheduledTask = await scheduledTask(testUser.id, testFile.id);

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: testScheduledTask.id,
        uuid: testScheduledTask.uuid,
        fileId: testFile.id,
        userId: testUser.id,
        cronExpression: '0 0 * * *',
        operations: { action: 'test', type: 'daily' },
        status: 'ACTIVE',
      });
    });

    it('should return multiple scheduled tasks when multiple exist', async () => {
      // Create multiple scheduled tasks
      const task1 = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 1 * * *',
        operations: { action: 'task1', type: 'hourly' },
      });

      const task2 = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 2 * * *',
        operations: { action: 'task2', type: 'daily' },
      });

      const task3 = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 3 * * *',
        operations: { action: 'task3', type: 'weekly' },
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);

      // Verify all tasks are returned
      const taskUuids = response.body.map((task: any) => task.uuid);
      expect(taskUuids).toContain(task1.uuid);
      expect(taskUuids).toContain(task2.uuid);
      expect(taskUuids).toContain(task3.uuid);

      // Verify task details
      const task1Response = response.body.find((task: any) => task.uuid === task1.uuid);
      expect(task1Response.operations.action).toBe('task1');

      const task2Response = response.body.find((task: any) => task.uuid === task2.uuid);
      expect(task2Response.operations.action).toBe('task2');

      const task3Response = response.body.find((task: any) => task.uuid === task3.uuid);
      expect(task3Response.operations.action).toBe('task3');
    });

    it('should not return deleted scheduled tasks', async () => {
      // Create tasks with different statuses
      const activeTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 1 * * *',
        operations: { action: 'active_task' },
      });

      const inactiveTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 2 * * *',
        operations: { action: 'inactive_task' },
      });

      const deletedTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 3 * * *',
        operations: { action: 'deleted_task' },
      });

      // Update statuses
      await require('../../dbClient').default.scheduledTask.update({
        where: { id: inactiveTask.id },
        data: { status: 'INACTIVE' },
      });

      await require('../../dbClient').default.scheduledTask.update({
        where: { id: deletedTask.id },
        data: { status: 'DELETED' },
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2); // Only active and inactive, not deleted

      const taskActions = response.body.map((task: any) => task.operations.action);
      expect(taskActions).toContain('active_task');
      expect(taskActions).toContain('inactive_task');
      expect(taskActions).not.toContain('deleted_task');
    });
  });

  describe('Response Format Validation', () => {
    it('should return correctly formatted response with all required fields', async () => {
      const testScheduledTask = await scheduledTask(testUser.id, testFile.id);

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);

      const task = response.body[0];

      // Check all required fields exist and have correct types
      expect(task).toHaveProperty('id');
      expect(typeof task.id).toBe('number');

      expect(task).toHaveProperty('uuid');
      expect(typeof task.uuid).toBe('string');

      expect(task).toHaveProperty('fileId');
      expect(task.fileId).toBe(testFile.id);
      expect(typeof task.fileId).toBe('number');

      expect(task).toHaveProperty('userId');
      expect(task.userId).toBe(testUser.id);
      expect(typeof task.userId).toBe('number');

      expect(task).toHaveProperty('cronExpression');
      expect(typeof task.cronExpression).toBe('string');

      expect(task).toHaveProperty('operations');
      expect(typeof task.operations).toBe('object');

      expect(task).toHaveProperty('status');
      expect(typeof task.status).toBe('string');

      expect(task).toHaveProperty('nextRunTime');
      expect(typeof task.nextRunTime).toBe('string');

      expect(task).toHaveProperty('lastRunTime');
      expect(typeof task.lastRunTime).toBe('string');

      expect(task).toHaveProperty('createdDate');
      expect(typeof task.createdDate).toBe('string');

      expect(task).toHaveProperty('updatedDate');
      expect(typeof task.updatedDate).toBe('string');
    });

    it('should return valid date strings for date fields', async () => {
      const testScheduledTask = await scheduledTask(testUser.id, testFile.id);

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      const task = response.body[0];

      // Check that date fields are valid ISO date strings
      expect(new Date(task.createdDate).toISOString()).toBe(task.createdDate);
      expect(new Date(task.updatedDate).toISOString()).toBe(task.updatedDate);
      expect(new Date(task.nextRunTime).toISOString()).toBe(task.nextRunTime);

      // nextRunTime should be in the future
      const nextRunTime = new Date(task.nextRunTime);
      const now = new Date();
      expect(nextRunTime.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should preserve complex operations object structure in list', async () => {
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

      const complexTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 2 * * *',
        operations: complexOperations,
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].operations).toEqual(complexOperations);
    });
  });

  describe('Edge Cases', () => {
    it('should handle scheduled tasks with null lastRunTime', async () => {
      const testScheduledTask = await scheduledTask(testUser.id, testFile.id);

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body[0].lastRunTime).toBe('');
    });

    it('should handle operations with special characters and unicode', async () => {
      const specialOperations = {
        message: 'Special chars: àáâãäåçèéêë 中文 العربية 🚀🔥💯',
        sql: "SELECT * FROM table WHERE name = 'O''Reilly'",
        unicode: '\u{1F600}\u{1F601}\u{1F602}',
      };

      const specialTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: specialOperations,
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body[0].operations).toEqual(specialOperations);
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

      const nullTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: operationsWithNulls,
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body[0].operations.nullValue).toBeNull();
      expect(response.body[0].operations.emptyString).toBe('');
      expect(response.body[0].operations.zeroNumber).toBe(0);
      expect(response.body[0].operations.falseBoolean).toBe(false);
      expect(response.body[0].operations.emptyArray).toEqual([]);
      expect(response.body[0].operations.emptyObject).toEqual({});
    });

    it('should handle different cron expressions correctly', async () => {
      const cronExpressions = [
        '0 0 * * *', // Daily at midnight
        '0 */6 * * *', // Every 6 hours
        '0 0 * * 1', // Every Monday at midnight
        '30 14 * * *', // Daily at 2:30 PM
        '0 9 * * 1-5', // Weekdays at 9 AM
        '*/15 * * * *', // Every 15 minutes
      ];

      for (const cron of cronExpressions) {
        await createScheduledTask({
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: cron,
          operations: { action: 'test', cron },
        });
      }

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(cronExpressions.length);

      // Verify each cron expression is present and has valid nextRunTime
      for (const cron of cronExpressions) {
        const task = response.body.find((t: any) => t.cronExpression === cron);
        expect(task).toBeDefined();
        expect(task.cronExpression).toBe(cron);

        // Verify nextRunTime is calculated correctly for the cron expression
        const nextRunTime = new Date(task.nextRunTime);
        expect(nextRunTime.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('should handle different task statuses (excluding DELETED)', async () => {
      const activeTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: { action: 'active_task' },
      });

      const inactiveTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 1 * * *',
        operations: { action: 'inactive_task' },
      });

      // Update status to INACTIVE
      await require('../../dbClient').default.scheduledTask.update({
        where: { id: inactiveTask.id },
        data: { status: 'INACTIVE' },
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);

      const activeTaskResponse = response.body.find((t: any) => t.uuid === activeTask.uuid);
      expect(activeTaskResponse.status).toBe('ACTIVE');

      const inactiveTaskResponse = response.body.find((t: any) => t.uuid === inactiveTask.uuid);
      expect(inactiveTaskResponse.status).toBe('INACTIVE');
    });
  });

  describe('Multiple Files Isolation', () => {
    it('should only return scheduled tasks for the requested file', async () => {
      // Create another file for the same user and team using the test data generator
      const { createFile } = require('../../tests/testDataGenerator');
      const otherFile = await createFile({
        data: {
          name: 'Other Test File',
          ownerTeamId: testTeam.id,
          creatorUserId: testUser.id,
        },
      });

      // Create tasks for both files
      const task1 = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 1 * * *',
        operations: { action: 'task_for_file1' },
      });

      const task2 = await createScheduledTask({
        userId: testUser.id,
        fileId: otherFile.id,
        cronExpression: '0 2 * * *',
        operations: { action: 'task_for_file2' },
      });

      // Request tasks for first file
      const response1 = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response1.status).toBe(200);
      expect(response1.body).toHaveLength(1);
      expect(response1.body[0].operations.action).toBe('task_for_file1');
      expect(response1.body[0].fileId).toBe(testFile.id);

      // Request tasks for second file
      const response2 = await request(app)
        .get(`/v0/files/${otherFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response2.status).toBe(200);
      expect(response2.body).toHaveLength(1);
      expect(response2.body[0].operations.action).toBe('task_for_file2');
      expect(response2.body[0].fileId).toBe(otherFile.id);
    });
  });

  describe('Performance and Large Data Sets', () => {
    it('should handle large number of scheduled tasks', async () => {
      // Create many scheduled tasks
      const taskCount = 50;
      const tasks: any[] = [];

      for (let i = 0; i < taskCount; i++) {
        const task = await createScheduledTask({
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: `${i % 60} ${i % 24} * * *`,
          operations: { action: `task_${i}`, index: i },
        });
        tasks.push(task);
      }

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(taskCount);

      // Verify all tasks are returned
      const returnedUuids = response.body.map((task: any) => task.uuid);
      for (const task of tasks) {
        expect(returnedUuids).toContain(task.uuid);
      }
    });

    it('should handle tasks with large operations objects', async () => {
      const largeOperations = {
        type: 'bulk_processing',
        data: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `This is a description for item ${i}`.repeat(10),
          metadata: {
            created: new Date().toISOString(),
            tags: [`tag${i}`, `category${i % 5}`, 'bulk'],
          },
        })),
        config: {
          batchSize: 50,
          retryAttempts: 3,
          timeout: 30000,
        },
      };

      const largeTask = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 0 * * *',
        operations: largeOperations,
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].operations).toEqual(largeOperations);
    });
  });
});
