import { workosMock } from '../../tests/workosMock';
jest.mock('@workos-inc/node', () => workosMock([{ id: 'user1' }, { id: 'user2' }]));

import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createUser, createUserTeamAndFile, scheduledTask } from '../../tests/testDataGenerator';

type ScheduledTaskResponse = ApiTypes['/v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid.GET.response'];

describe('PATCH /v0/files/:uuid/scheduled-tasks/:scheduledTaskUuid', () => {
  let testUser: any;
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
      operations: Array.from(Buffer.from(JSON.stringify({ action: 'updated', type: 'hourly' }))),
    };

    it('should return 400 for invalid file UUID parameter format', async () => {
      const response = await request(app)
        .patch(`/v0/files/invalid-uuid/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid scheduled task UUID parameter format', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/invalid-uuid`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(400);
    });

    it('should return 400 for both invalid UUID parameters', async () => {
      const response = await request(app)
        .patch('/v0/files/invalid-uuid/scheduled-tasks/invalid-task-uuid')
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing cronExpression', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          operations: Array.from(Buffer.from(JSON.stringify({ action: 'test' }))),
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for empty cronExpression', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '',
          operations: Array.from(Buffer.from(JSON.stringify({ action: 'test' }))),
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing operations', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '0 1 * * *',
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid cron expression', async () => {
      // Test with a clearly invalid cron expression
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: 'not a valid cron expression',
          operations: Array.from(Buffer.from(JSON.stringify({ action: 'test' }))),
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Bad request');
    });
  });

  describe('Authentication and Authorization', () => {
    const validUpdateData = {
      cronExpression: '0 1 * * *',
      operations: Array.from(Buffer.from(JSON.stringify({ action: 'updated', type: 'hourly' }))),
    };

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .send(validUpdateData);

      expect(response.status).toBe(401);
    });
  });

  describe('Permission Checks', () => {
    const validUpdateData = {
      cronExpression: '0 1 * * *',
      operations: Array.from(Buffer.from(JSON.stringify({ action: 'updated', type: 'hourly' }))),
    };

    it('should return 403 when user lacks FILE_EDIT permission (but has TEAM_EDIT)', async () => {
      // Make the file private so team permissions don't grant file edit
      await dbClient.file.update({
        where: { id: testFile.id },
        data: { ownerUserId: testUser.id },
      });

      // Create a user with EDITOR team role (has TEAM_EDIT) but no file role
      const editorUser = await createUser({ auth0Id: `editor-user-${uniqueId}` });

      await dbClient.userTeamRole.create({
        data: {
          userId: editorUser.id,
          teamId: testTeam.id,
          role: 'EDITOR',
        },
      });

      // Explicitly give them VIEWER role on the file so they don't get FILE_EDIT
      await dbClient.userFileRole.create({
        data: {
          userId: editorUser.id,
          fileId: testFile.id,
          role: 'VIEWER',
        },
      });

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken editor-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Permission denied');
    });

    it('should return 403 when user lacks TEAM_EDIT permission (but has FILE_EDIT)', async () => {
      // Create a user with VIEWER team role (no TEAM_EDIT) but give them EDITOR on the file (has FILE_EDIT)
      const viewerUser = await createUser({ auth0Id: `viewer-user-${uniqueId}` });

      await dbClient.userTeamRole.create({
        data: {
          userId: viewerUser.id,
          teamId: testTeam.id,
          role: 'VIEWER',
        },
      });

      await dbClient.userFileRole.create({
        data: {
          userId: viewerUser.id,
          fileId: testFile.id,
          role: 'EDITOR',
        },
      });

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken viewer-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Permission denied');
    });

    it('should succeed when user has both FILE_EDIT and TEAM_EDIT permission', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(200);
      expect(response.body.cronExpression).toBe(validUpdateData.cronExpression);
    });
  });

  describe('File and Task Existence Checks', () => {
    const validUpdateData = {
      cronExpression: '0 1 * * *',
      operations: Array.from(Buffer.from(JSON.stringify({ action: 'updated', type: 'hourly' }))),
    };

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .patch(`/v0/files/12345678-1234-1234-1234-123456789012/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(404);
    });

    it('should return 500 for non-existent scheduled task', async () => {
      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/12345678-1234-1234-1234-123456789012`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(validUpdateData);

      expect(response.status).toBe(500);
    });
  });

  describe('Successful Updates', () => {
    it('should successfully update cronExpression and operations', async () => {
      const updateData = {
        cronExpression: '0 2 * * *',
        operations: Array.from(Buffer.from(JSON.stringify({ action: 'updated', type: 'nightly', priority: 'high' }))),
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.cronExpression).toBe(updateData.cronExpression);
      // expect(response.body.operations).toEqual(updateData.operations);

      // Verify nextRunTime was recalculated
      const nextRunTime = new Date(response.body.nextRunTime);
      expect(nextRunTime.getTime()).toBeGreaterThan(Date.now());
    });
    it('should preserve other fields when updating', async () => {
      const originalResponse = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updateData = {
        cronExpression: '0 4 * * *',
        operations: Array.from(Buffer.from(JSON.stringify({ action: 'preserve_test' }))),
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
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
      // expect(response.body.operations).toEqual(updateData.operations);

      // Verify updatedDate is recent (within the last 5 seconds)
      const updatedTime = new Date(response.body.updatedDate).getTime();
      const now = Date.now();
      const fiveSecondsAgo = now - 5000;
      expect(updatedTime).toBeGreaterThan(fiveSecondsAgo);
      expect(updatedTime).toBeLessThanOrEqual(now);

      expect(response.body.nextRunTime).not.toBe(originalResponse.body.nextRunTime);
    });
  });

  describe('Response Format Validation', () => {
    it('should return correctly formatted response with all required fields', async () => {
      const updateData = {
        cronExpression: '0 8 * * *',
        operations: Array.from(Buffer.from(JSON.stringify({ action: 'format_test' }))),
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
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
        operations: Array.from(Buffer.from(JSON.stringify({ action: 'date_test' }))),
      };

      const response = await request(app)
        .patch(`/v0/files/${testFile.uuid}/scheduled-tasks/${testScheduledTask.uuid}`)
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
});
