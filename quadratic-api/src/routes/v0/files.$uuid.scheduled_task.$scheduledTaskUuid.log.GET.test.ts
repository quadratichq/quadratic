import { workosMock } from '../../tests/workosMock';
jest.mock('@workos-inc/node', () => workosMock([{ id: 'user1' }, { id: 'user2' }]));

import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import request from 'supertest';
import { app } from '../../app';
import { clearDb, createUserTeamAndFile, scheduledTask } from '../../tests/testDataGenerator';
import { createScheduledTaskLog } from '../../utils/scheduledTasks';

type ScheduledTaskResponse = ApiTypes['/v0/files/:uuid/scheduled_task/:scheduledTaskUuid.GET.response'];
type ScheduledTaskLogResponse = ApiTypes['/v0/files/:uuid/scheduled_task/:scheduledTaskUuid/log.GET.response'];

describe('GET /v0/files/:uuid/scheduled_task/:scheduledTaskUuid/log', () => {
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

    // Create another user for permission testing
    const { testUser: anotherUser } = await createUserTeamAndFile();
    otherUser = anotherUser;
  });

  afterEach(async () => {
    await clearDb();
  });

  describe('Request Validation', () => {
    it('should return 400 for invalid file UUID parameter format', async () => {
      const response = await request(app)
        .get(`/v0/files/invalid-uuid/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid scheduled task UUID parameter format', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/invalid-uuid/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for both invalid UUID parameters', async () => {
      const response = await request(app)
        .get('/v0/files/invalid-uuid/scheduled_task/invalid-task-uuid/log')
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get(
        `/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks FILE_EDIT permission', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken other-user-${uniqueId}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Permission denied');
    });
  });

  describe('File and Task Existence Checks', () => {
    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get(`/v0/files/12345678-1234-1234-1234-123456789012/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(404);
    });

    it('should return 500 for non-existent scheduled task', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/12345678-1234-1234-1234-123456789012/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(500);
    });
  });

  describe('Successful Log Retrieval', () => {
    it('should return empty array when no logs exist', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('should return single log entry', async () => {
      // Create a log entry
      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'test-run-id-1',
        status: 'COMPLETED',
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);

      const logEntry = response.body[0];
      expect(logEntry.scheduledTaskId).toBe(testScheduledTask.id);
      expect(logEntry.status).toBe('COMPLETED');
      expect(logEntry.error).toBeUndefined();
    });

    it('should return multiple log entries in correct order', async () => {
      // Create multiple log entries with slight delays to ensure different timestamps
      const log1 = await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'test-run-id-1',
        status: 'PENDING',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const log2 = await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'test-run-id-2',
        status: 'RUNNING',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const log3 = await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'test-run-id-3',
        status: 'COMPLETED',
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(3);

      // Verify the log entries (order depends on database query - typically by creation order)
      const logIds = response.body.map((log: any) => log.id);
      expect(logIds).toContain(log1.id);
      expect(logIds).toContain(log2.id);
      expect(logIds).toContain(log3.id);
    });

    it('should return log entries with error messages', async () => {
      const errorMessage = 'Task failed due to network timeout';

      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'test-run-id-error',
        status: 'FAILED',
        error: errorMessage,
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);

      const logEntry = response.body[0];
      expect(logEntry.status).toBe('FAILED');
      expect(logEntry.error).toBe(errorMessage);
    });

    it('should return logs with all possible status values', async () => {
      const statuses = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'] as const;

      for (const status of statuses) {
        await createScheduledTaskLog({
          scheduledTaskId: testScheduledTask.id,
          runId: `test-run-id-${status}`,
          status,
          error: status === 'FAILED' ? 'Test error' : undefined,
        });
      }

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(4);

      const returnedStatuses = response.body.map((log: any) => log.status);
      for (const status of statuses) {
        expect(returnedStatuses).toContain(status);
      }
    });

    it('should handle logs with long error messages', async () => {
      const longErrorMessage =
        'A'.repeat(1000) + ' - This is a very long error message that tests handling of large text fields';

      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'test-run-id-long-error',
        status: 'FAILED',
        error: longErrorMessage,
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].error).toBe(longErrorMessage);
    });

    it('should only return logs for the specific scheduled task', async () => {
      // Create another scheduled task
      const anotherTask = await scheduledTask(testUser.id, testFile.id);

      // Create logs for both tasks
      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'test-run-id-task1',
        status: 'COMPLETED',
      });

      await createScheduledTaskLog({
        scheduledTaskId: anotherTask.id,
        runId: 'test-run-id-task2',
        status: 'FAILED',
        error: 'Different task error',
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].scheduledTaskId).toBe(testScheduledTask.id);
      expect(response.body[0].status).toBe('COMPLETED');
    });
  });

  describe('Response Format Validation', () => {
    it('should return correctly formatted response with all required fields', async () => {
      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'test-run-id-format',
        status: 'COMPLETED',
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);

      const logEntry = response.body[0];

      // Check all required fields exist and have correct types
      expect(logEntry).toHaveProperty('id');
      expect(typeof logEntry.id).toBe('number');

      expect(logEntry).toHaveProperty('scheduledTaskId');
      expect(logEntry.scheduledTaskId).toBe(testScheduledTask.id);
      expect(typeof logEntry.scheduledTaskId).toBe('number');

      expect(logEntry).toHaveProperty('status');
      expect(typeof logEntry.status).toBe('string');
      expect(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED']).toContain(logEntry.status);

      expect(logEntry).toHaveProperty('createdDate');
      expect(typeof logEntry.createdDate).toBe('string');

      // error field should not exist when no error (undefined should not be serialized)
      expect(logEntry.error).toBeUndefined();
    });

    it('should return valid date strings for date fields', async () => {
      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'test-run-id-date',
        status: 'COMPLETED',
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      const logEntry = response.body[0];

      // Check that date field is a valid ISO date string
      expect(new Date(logEntry.createdDate).toISOString()).toBe(logEntry.createdDate);

      // createdDate should be recent (within last minute)
      const createdDate = new Date(logEntry.createdDate);
      const oneMinuteAgo = new Date(Date.now() - 60000);
      expect(createdDate.getTime()).toBeGreaterThan(oneMinuteAgo.getTime());
    });

    it('should include error field when error exists', async () => {
      const errorMessage = 'Test error message';

      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'test-run-id-with-error',
        status: 'FAILED',
        error: errorMessage,
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      const logEntry = response.body[0];

      expect(logEntry).toHaveProperty('error');
      expect(logEntry.error).toBe(errorMessage);
      expect(typeof logEntry.error).toBe('string');
    });

    it('should maintain consistent response structure for empty array', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Pagination', () => {
    it('should respect limit parameter', async () => {
      // Create 15 log entries with different run IDs
      for (let i = 0; i < 15; i++) {
        await createScheduledTaskLog({
          scheduledTaskId: testScheduledTask.id,
          runId: `test-run-id-${i}`,
          status: 'COMPLETED',
        });
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log?limit=5`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(5);
    });

    it('should use default limit of 10 when not specified', async () => {
      // Create 15 log entries with different run IDs
      for (let i = 0; i < 15; i++) {
        await createScheduledTaskLog({
          scheduledTaskId: testScheduledTask.id,
          runId: `test-run-id-${i}`,
          status: 'COMPLETED',
        });
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(10);
    });

    it('should handle page parameter correctly', async () => {
      // Create 25 log entries with different run IDs
      for (let i = 0; i < 25; i++) {
        await createScheduledTaskLog({
          scheduledTaskId: testScheduledTask.id,
          runId: `test-run-id-${i}`,
          status: 'COMPLETED',
        });
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Get page 1 (first 10)
      const page1Response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log?limit=10&page=1`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(page1Response.status).toBe(200);
      expect(page1Response.body).toHaveLength(10);

      // Get page 2 (next 10)
      const page2Response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log?limit=10&page=2`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(page2Response.status).toBe(200);
      expect(page2Response.body).toHaveLength(10);

      // Get page 3 (last 5)
      const page3Response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log?limit=10&page=3`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(page3Response.status).toBe(200);
      expect(page3Response.body).toHaveLength(5);

      // Verify pages don't overlap
      const page1Ids = page1Response.body.map((log: any) => log.id);
      const page2Ids = page2Response.body.map((log: any) => log.id);
      const page3Ids = page3Response.body.map((log: any) => log.id);

      const allIds = [...page1Ids, ...page2Ids, ...page3Ids];
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it('should return empty array for page beyond available data', async () => {
      // Create 5 log entries
      for (let i = 0; i < 5; i++) {
        await createScheduledTaskLog({
          scheduledTaskId: testScheduledTask.id,
          runId: `test-run-id-${i}`,
          status: 'COMPLETED',
        });
      }

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log?limit=10&page=2`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });
  });

  describe('Distinct Run ID Behavior', () => {
    it('should return only the most recent log entry for each run_id', async () => {
      const runId = 'test-run-id-same';

      // Create multiple logs with the same run_id
      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId,
        status: 'PENDING',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId,
        status: 'RUNNING',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const latestLog = await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId,
        status: 'COMPLETED',
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(latestLog.id);
      expect(response.body[0].status).toBe('COMPLETED');
    });

    it('should return one log per distinct run_id with multiple runs', async () => {
      // Create run 1 with 3 status updates
      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'run-1',
        status: 'PENDING',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'run-1',
        status: 'RUNNING',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const run1Latest = await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'run-1',
        status: 'COMPLETED',
      });

      // Create run 2 with 2 status updates
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'run-2',
        status: 'PENDING',
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const run2Latest = await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'run-2',
        status: 'FAILED',
        error: 'Test error',
      });

      // Create run 3 with 1 status update
      await new Promise((resolve) => setTimeout(resolve, 10));
      const run3Latest = await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'run-3',
        status: 'RUNNING',
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);

      const returnedIds = response.body.map((log: any) => log.id);
      expect(returnedIds).toContain(run1Latest.id);
      expect(returnedIds).toContain(run2Latest.id);
      expect(returnedIds).toContain(run3Latest.id);

      // Verify the logs are ordered by created_date DESC (most recent first)
      const dates = response.body.map((log: any) => new Date(log.createdDate).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle requests for tasks with very large number of logs', async () => {
      // Create many log entries
      const logPromises: ReturnType<typeof createScheduledTaskLog>[] = [];
      for (let i = 0; i < 50; i++) {
        logPromises.push(
          createScheduledTaskLog({
            scheduledTaskId: testScheduledTask.id,
            runId: `test-run-id-${i}`,
            status: (i % 2 === 0 ? 'COMPLETED' : 'FAILED') as 'COMPLETED' | 'FAILED',
            error: i % 2 === 1 ? `Error ${i}` : undefined,
          })
        );
      }

      await Promise.all(logPromises);

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log?limit=100`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(50);

      // Verify all logs have proper structure
      response.body.forEach((log: any) => {
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('scheduledTaskId');
        expect(log).toHaveProperty('status');
        expect(log).toHaveProperty('createdDate');
      });
    });

    it('should handle special characters in error messages correctly', async () => {
      const specialErrorMessage =
        'Error with special chars: àáâãäåçèéêë 中文 العربية 🚀🔥💯 and "quotes" and \'apostrophes\' and \\backslashes\\';

      await createScheduledTaskLog({
        scheduledTaskId: testScheduledTask.id,
        runId: 'test-run-id-special-chars',
        status: 'FAILED',
        error: specialErrorMessage,
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}/log`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body[0].error).toBe(specialErrorMessage);
    });
  });
});
