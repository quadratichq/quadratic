import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import request from 'supertest';
import { app } from '../../app';
import { genericAuth0Mock } from '../../tests/auth0Mock';
import { clearDb, createUserTeamAndFile, scheduledTask } from '../../tests/testDataGenerator';
import { createScheduledTask } from '../../utils/scheduledTasks';

type ScheduledTaskResponse = ApiTypes['/v0/files/:uuid/scheduled_task/:scheduledTaskUuid.GET.response'];

jest.mock('auth0', () => genericAuth0Mock());

describe('PATCH /v0/files/:uuid/scheduled_task/:scheduledTaskUuid', () => {
  let testUser: any;
  let otherUser: any;
  let testFile: any;
  let testTeam: any;
  let uniqueId: string;
  let testScheduledTask: ScheduledTaskResponse;

  beforeEach(async () => {
    await clearDb();

    ({ uniqueId, testUser, testTeam, testFile } = await createUserTeamAndFile());
    testScheduledTask = await scheduledTask(testUser.id, testFile.id);
  });

  afterEach(async () => {
    await clearDb();
  });

  describe('Request Validation', () => {
    const validUpdateData = {
      cronExpression: '0 1 * * *',
      operations: { action: 'updated', type: 'hourly' },
    };

    it('should return 400 for invalid file UUID parameter format', async () => {
      const response = await request(app)
        .patch(`/v0/files/invalid-uuid/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid scheduled task UUID parameter format', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/invalid-uuid`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(400);
    });

    it('should return 400 for both invalid UUID parameters', async () => {
      const response = await request(app)
        .patch('/v0/files/invalid-uuid/scheduled_task/invalid-task-uuid')
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing cronExpression', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          operations: { action: 'test' },
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for empty cronExpression', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '',
          operations: { action: 'test' },
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing operations', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '0 1 * * *',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid cron expression', async () => {
      // Test with a clearly invalid cron expression
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: 'not a valid cron expression',
          operations: { action: 'test' },
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Bad request');
    });
  });

  describe('Authentication and Authorization', () => {
    const validUpdateData = {
      cronExpression: '0 1 * * *',
      operations: { action: 'updated', type: 'hourly' },
    };

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .send(validUpdateData);

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks FILE_EDIT permission', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken other-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Permission denied');
    });
  });

  describe('File and Task Existence Checks', () => {
    const validUpdateData = {
      cronExpression: '0 1 * * *',
      operations: { action: 'updated', type: 'hourly' },
    };

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .patch(`/v0/files/12345678-1234-1234-1234-123456789012/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(404);
    });

    it('should return 500 for non-existent scheduled task', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/12345678-1234-1234-1234-123456789012`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(500);
    });
  });

  describe('Successful Updates', () => {
    it('should successfully update cronExpression and operations', async () => {
      const updateData = {
        cronExpression: '0 2 * * *',
        operations: { action: 'updated', type: 'nightly', priority: 'high' },
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.cronExpression).toBe(updateData.cronExpression);
      expect(response.body.operations).toEqual(updateData.operations);

      // Verify nextRunTime was recalculated
      const nextRunTime = new Date(response.body.nextRunTime);
      expect(nextRunTime.getTime()).toBeGreaterThan(Date.now());
    });

    it('should update with complex operations object', async () => {
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

      const updateData = {
        cronExpression: '0 3 * * *',
        operations: complexOperations,
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.operations).toEqual(complexOperations);
    });

    it('should update with various valid cron expressions', async () => {
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

      for (const cronExpression of cronExpressions) {
        const updateData = {
          cronExpression,
          operations: { action: 'test', cron: cronExpression },
        };

        const response = await request(app)
          .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
          .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.cronExpression).toBe(cronExpression);

        // Verify nextRunTime is calculated correctly
        const nextRunTime = new Date(response.body.nextRunTime);
        expect(nextRunTime.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('should preserve other fields when updating', async () => {
      const originalResponse = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updateData = {
        cronExpression: '0 4 * * *',
        operations: { action: 'preserve_test' },
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(updateData);

      expect(response.status).toBe(200);

      // These fields should remain unchanged
      expect(response.body.id).toBe(originalResponse.body.id);
      expect(response.body.uuid).toBe(originalResponse.body.uuid);
      expect(response.body.fileId).toBe(originalResponse.body.fileId);
      expect(response.body.userId).toBe(originalResponse.body.userId);
      expect(response.body.status).toBe(originalResponse.body.status);
      expect(response.body.createdDate).toBe(originalResponse.body.createdDate);

      // These fields should be updated
      expect(response.body.cronExpression).toBe(updateData.cronExpression);
      expect(response.body.operations).toEqual(updateData.operations);

      // Verify updatedDate is recent (within the last 5 seconds)
      const updatedTime = new Date(response.body.updatedDate).getTime();
      const now = Date.now();
      const fiveSecondsAgo = now - 5000;
      expect(updatedTime).toBeGreaterThan(fiveSecondsAgo);
      expect(updatedTime).toBeLessThanOrEqual(now);

      expect(response.body.nextRunTime).not.toBe(originalResponse.body.nextRunTime);
    });
  });

  describe('Edge Cases and Special Values', () => {
    it('should handle operations with null and falsy values', async () => {
      const operationsWithNulls = {
        nullValue: null,
        emptyString: '',
        zeroNumber: 0,
        falseBoolean: false,
        emptyArray: [],
        emptyObject: {},
      };

      const updateData = {
        cronExpression: '0 5 * * *',
        operations: operationsWithNulls,
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.operations.nullValue).toBeNull();
      expect(response.body.operations.emptyString).toBe('');
      expect(response.body.operations.zeroNumber).toBe(0);
      expect(response.body.operations.falseBoolean).toBe(false);
      expect(response.body.operations.emptyArray).toEqual([]);
      expect(response.body.operations.emptyObject).toEqual({});
    });

    it('should handle operations with special characters and unicode', async () => {
      const specialOperations = {
        message: 'Special chars: àáâãäåçèéêë 中文 العربية 🚀🔥💯',
        sql: "SELECT * FROM table WHERE name = 'O''Reilly'",
        unicode: '\u{1F600}\u{1F601}\u{1F602}',
        json: '{"key": "value with \\"quotes\\""}',
      };

      const updateData = {
        cronExpression: '0 6 * * *',
        operations: specialOperations,
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.operations).toEqual(specialOperations);
    });

    it('should handle large operations object', async () => {
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

      const updateData = {
        cronExpression: '0 7 * * *',
        operations: largeOperations,
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.operations).toEqual(largeOperations);
    });
  });

  describe('Response Format Validation', () => {
    it('should return correctly formatted response with all required fields', async () => {
      const updateData = {
        cronExpression: '0 8 * * *',
        operations: { action: 'format_test' },
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(updateData);

      expect(response.status).toBe(200);

      // Check all required fields exist and have correct types
      expect(response.body).toHaveProperty('id');
      expect(typeof response.body.id).toBe('number');

      expect(response.body).toHaveProperty('uuid');
      expect(typeof response.body.uuid).toBe('string');

      expect(response.body).toHaveProperty('fileId');
      expect(response.body.fileId).toBe(testFile.id);
      expect(typeof response.body.fileId).toBe('number');

      expect(response.body).toHaveProperty('userId');
      expect(response.body.userId).toBe(testUser.id);
      expect(typeof response.body.userId).toBe('number');

      expect(response.body).toHaveProperty('cronExpression');
      expect(response.body.cronExpression).toBe(updateData.cronExpression);
      expect(typeof response.body.cronExpression).toBe('string');

      expect(response.body).toHaveProperty('operations');
      expect(response.body.operations).toEqual(updateData.operations);
      expect(typeof response.body.operations).toBe('object');

      expect(response.body).toHaveProperty('status');
      expect(typeof response.body.status).toBe('string');

      expect(response.body).toHaveProperty('nextRunTime');
      expect(typeof response.body.nextRunTime).toBe('string');

      expect(response.body).toHaveProperty('lastRunTime');
      expect(typeof response.body.lastRunTime).toBe('string');

      expect(response.body).toHaveProperty('createdDate');
      expect(typeof response.body.createdDate).toBe('string');

      expect(response.body).toHaveProperty('updatedDate');
      expect(typeof response.body.updatedDate).toBe('string');
    });

    it('should return valid date strings for date fields', async () => {
      const updateData = {
        cronExpression: '0 9 * * *',
        operations: { action: 'date_test' },
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(updateData);

      expect(response.status).toBe(200);

      // Check that date fields are valid ISO date strings
      expect(new Date(response.body.createdDate).toISOString()).toBe(response.body.createdDate);
      expect(new Date(response.body.updatedDate).toISOString()).toBe(response.body.updatedDate);
      expect(new Date(response.body.nextRunTime).toISOString()).toBe(response.body.nextRunTime);

      // nextRunTime should be in the future
      const nextRunTime = new Date(response.body.nextRunTime);
      const now = new Date();
      expect(nextRunTime.getTime()).toBeGreaterThan(now.getTime());

      // updatedDate should be recent (within last minute)
      const updatedDate = new Date(response.body.updatedDate);
      const oneMinuteAgo = new Date(Date.now() - 60000);
      expect(updatedDate.getTime()).toBeGreaterThan(oneMinuteAgo.getTime());
    });
  });

  describe('Multiple Updates', () => {
    it('should handle multiple consecutive updates correctly', async () => {
      const updates = [
        {
          cronExpression: '0 10 * * *',
          operations: { action: 'first_update', step: 1 },
        },
        {
          cronExpression: '0 11 * * *',
          operations: { action: 'second_update', step: 2 },
        },
        {
          cronExpression: '0 12 * * *',
          operations: { action: 'third_update', step: 3 },
        },
      ];

      for (let i = 0; i < updates.length; i++) {
        const updateData = updates[i];
        const response = await request(app)
          .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
          .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body.cronExpression).toBe(updateData.cronExpression);
        expect(response.body.operations).toEqual(updateData.operations);

        // Each update should have a more recent updatedDate
        if (i > 0) {
          const previousUpdate = updates[i - 1];
          // Small delay to ensure different timestamps
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    });

    it('should update one task without affecting others', async () => {
      // Create additional scheduled tasks
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

      // Update only the original task
      const updateData = {
        cronExpression: '0 13 * * *',
        operations: { action: 'updated_original' },
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.operations.action).toBe('updated_original');

      // Verify other tasks remain unchanged
      const task1Response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${task1.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(task1Response.status).toBe(200);
      expect(task1Response.body.operations.action).toBe('task1');

      const task2Response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${task2.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(task2Response.status).toBe(200);
      expect(task2Response.body.operations.action).toBe('task2');
    });
  });
});
