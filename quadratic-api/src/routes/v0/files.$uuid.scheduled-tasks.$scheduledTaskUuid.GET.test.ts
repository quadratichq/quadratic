import { workosMock } from '../../tests/workosMock';
jest.mock('@workos-inc/node', () => workosMock([{ id: 'user1' }, { id: 'user2' }]));

import type { ScheduledTaskStatus } from '@prisma/client';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { toUint8Array } from 'quadratic-shared/utils/Uint8Array';
import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createUserTeamAndFile, scheduledTask } from '../../tests/testDataGenerator';
import { createScheduledTask } from '../../utils/scheduledTasks';

// Helper function to generate expected serialized Buffer format for HTTP responses
const expectSerializedBuffer = (data: any) => Array.from(Buffer.from(JSON.stringify(data)));

export type ScheduledTaskResponse = ApiTypes['/v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid.GET.response'];

describe('GET /v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid', () => {
  let testUser: any;
  let testFile: any;
  let uniqueId: string;
  let testScheduledTask: ScheduledTaskResponse;

  beforeEach(async () => {
    await clearDb();

    ({ uniqueId, testUser, testFile } = await createUserTeamAndFile());
    testScheduledTask = await scheduledTask(testUser.id, testFile.id);
  });

  afterEach(async () => {
    await clearDb();
  });

  describe('Request Validation', () => {
    it('should return 400 for invalid file UUID parameter format', async () => {
      const response = await request(app)
        .get(`/v0/files/invalid-uuid/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid scheduled task UUID parameter format', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/invalid-uuid`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for both invalid UUID parameters', async () => {
      const response = await request(app)
        .get('/v0/files/invalid-uuid/scheduled-tasks/invalid-task-uuid')
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).get(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`);

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks both FILE_VIEW and TEAM_VIEW permissions', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken other-user-${uniqueId}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Permission denied');
    });
  });

  describe('File Permission Checks', () => {
    it('should succeed when user has FILE_VIEW and TEAM_VIEW permissions (file owner)', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('uuid', testScheduledTask.uuid);
    });

    it('should return 403 when user has FILE_VIEW but lacks TEAM_VIEW permission', async () => {
      // Create a private file where a user has FILE_VIEW but no team role
      await dbClient.file.update({
        where: { id: testFile.id },
        data: { ownerUserId: testUser.id },
      });

      // Create a user with file role but no team role
      const fileOnlyUser = await dbClient.user.create({
        data: {
          auth0Id: `file-only-user-${uniqueId}`,
          email: `file-only-user-${uniqueId}@test.com`,
        },
      });

      // Give them VIEWER role on the file
      await dbClient.userFileRole.create({
        data: {
          userId: fileOnlyUser.id,
          fileId: testFile.id,
          role: 'VIEWER',
        },
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken file-only-user-${uniqueId}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Permission denied');
    });

    it('should return 403 when user has TEAM_VIEW but lacks FILE_VIEW permission', async () => {
      // Create another user from a different team
      const otherUser = await dbClient.user.create({
        data: {
          auth0Id: `other-team-user-${uniqueId}`,
          email: `other-team-user-${uniqueId}@test.com`,
        },
      });

      // Add them to the test team as a VIEWER (has TEAM_VIEW but no FILE_VIEW)
      await dbClient.userTeamRole.create({
        data: {
          userId: otherUser.id,
          teamId: testFile.ownerTeamId!,
          role: 'VIEWER',
        },
      });

      // File remains private to the original user
      await dbClient.file.update({
        where: { id: testFile.id },
        data: { ownerUserId: testUser.id },
      });

      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken other-team-user-${uniqueId}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Permission denied');
    });
  });

  describe('Scheduled Task Retrieval', () => {
    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get(`/v0/files/12345678-1234-1234-1234-123456789012/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(404);
    });

    it('should return 500 for non-existent scheduled task', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/12345678-1234-1234-1234-123456789012`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain('Scheduled task 12345678-1234-1234-1234-123456789012 not found');
    });

    it('should successfully retrieve existing scheduled task', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: testScheduledTask.id,
        uuid: testScheduledTask.uuid,
        fileId: testFile.id,
        userId: testUser.id,
        cronExpression: '0 0 * * *',
        operations: expectSerializedBuffer({ action: 'test', type: 'daily' }),
        status: 'ACTIVE',
      });
    });
  });

  describe('Response Format Validation', () => {
    it('should return correctly formatted response with all required fields', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

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
      expect(typeof response.body.cronExpression).toBe('string');

      expect(response.body).toHaveProperty('operations');
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
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);

      // Check that date fields are valid ISO date strings
      expect(new Date(response.body.createdDate).toISOString()).toBe(response.body.createdDate);
      expect(new Date(response.body.updatedDate).toISOString()).toBe(response.body.updatedDate);
      expect(new Date(response.body.nextRunTime).toISOString()).toBe(response.body.nextRunTime);

      // nextRunTime should be in the future
      const nextRunTime = new Date(response.body.nextRunTime);
      const now = new Date();
      expect(nextRunTime.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('Edge Cases', () => {
    it('should handle scheduled task with null lastRunTime', async () => {
      const response = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body.lastRunTime).toBe('');
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
        const cronTask = await createScheduledTask({
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: cron,
          operations: Array.from(toUint8Array({ action: 'test', cron })),
        });

        const response = await request(app)
          .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${cronTask.uuid}`)
          .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

        expect(response.status).toBe(200);
        expect(response.body.cronExpression).toBe(cron);

        // Verify nextRunTime is calculated correctly for the cron expression
        const nextRunTime = new Date(response.body.nextRunTime);
        expect(nextRunTime.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('should handle different task statuses', async () => {
      // Note: The endpoint filters for non-DELETED tasks, so we test ACTIVE and INACTIVE
      const statuses: ScheduledTaskStatus[] = ['ACTIVE', 'INACTIVE'];

      for (const status of statuses) {
        const statusTask = await createScheduledTask({
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 0 * * *',
          operations: Array.from(toUint8Array({ action: 'test', status })),
        });

        // Update status after creation if not ACTIVE (since createScheduledTask always creates ACTIVE)
        if (status !== 'ACTIVE') {
          await dbClient.scheduledTask.update({
            where: { id: statusTask.id },
            data: { status },
          });
        }

        const response = await request(app)
          .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${statusTask.uuid}`)
          .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

        expect(response.status).toBe(200);
        expect(response.body.status).toBe(status);
      }
    });
  });

  describe('Multiple Scheduled Tasks', () => {
    it('should retrieve correct task when multiple tasks exist for the same file', async () => {
      // Create additional scheduled tasks for the same file
      const task1 = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 1 * * *',
        operations: Array.from(toUint8Array({ action: 'task1' })),
      });

      const task2 = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 2 * * *',
        operations: Array.from(toUint8Array({ action: 'task2' })),
      });

      // Test retrieving each task individually
      const response1 = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${task1.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response1.status).toBe(200);
      expect(response1.body.uuid).toBe(task1.uuid);
      expect(response1.body.operations).toEqual(expectSerializedBuffer({ action: 'task1' }));

      const response2 = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${task2.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response2.status).toBe(200);
      expect(response2.body.uuid).toBe(task2.uuid);
      expect(response2.body.operations).toEqual(expectSerializedBuffer({ action: 'task2' }));

      // Test original task still works
      const responseOriginal = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(responseOriginal.status).toBe(200);
      expect(responseOriginal.body.uuid).toBe(testScheduledTask.uuid);
      expect(responseOriginal.body.operations).toEqual(expectSerializedBuffer({ action: 'test', type: 'daily' }));
    });
  });
});
