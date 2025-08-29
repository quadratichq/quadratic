import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import request from 'supertest';
import { app } from '../../app';
import { genericAuth0Mock } from '../../tests/auth0Mock';
import { clearDb, createUserTeamAndFile, scheduledTask } from '../../tests/testDataGenerator';
import { createScheduledTask } from '../../utils/scheduledTasks';

type ScheduledTaskResponse = ApiTypes['/v0/files/:uuid/scheduled_task/:scheduledTaskUuid.GET.response'];

jest.mock('auth0', () => genericAuth0Mock());

describe('DELETE /v0/files/:uuid/scheduled_task/:scheduledTaskUuid', () => {
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
    it('should return 400 for invalid file UUID parameter format', async () => {
      const response = await request(app)
        .delete(`/v0/files/invalid-uuid/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid scheduled task UUID parameter format', async () => {
      const response = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/invalid-uuid`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(400);
    });

    it('should return 400 for both invalid UUID parameters', async () => {
      const response = await request(app)
        .delete('/v0/files/invalid-uuid/scheduled_task/invalid-task-uuid')
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app).delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`);

      expect(response.status).toBe(401);
    });

    it('should return 403 when user lacks FILE_EDIT permission', async () => {
      const response = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken other-user-${uniqueId}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Permission denied');
    });
  });

  describe('File Permission Checks', () => {
    it('should succeed when user has FILE_EDIT permission (file owner)', async () => {
      const response = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Scheduled task deleted' });
    });
  });

  describe('Scheduled Task Deletion', () => {
    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .delete(`/v0/files/12345678-1234-1234-1234-123456789012/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(404);
    });

    it('should return 500 for non-existent scheduled task', async () => {
      const response = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/12345678-1234-1234-1234-123456789012`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(500);
    });

    it('should successfully delete existing scheduled task', async () => {
      // Verify task exists before deletion
      const beforeResponse = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(beforeResponse.status).toBe(200);
      expect(beforeResponse.body).toHaveLength(1);

      // Delete the task
      const deleteResponse = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body).toEqual({ message: 'Scheduled task deleted' });

      // Verify task is no longer returned in list (soft delete)
      const afterResponse = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(afterResponse.status).toBe(200);
      expect(afterResponse.body).toHaveLength(0);
    });

    it('should soft delete task (mark as DELETED, not physically remove)', async () => {
      // Delete the task
      const response = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);

      // Verify task still exists in database but with DELETED status
      const dbTask = await require('../../dbClient').default.scheduledTask.findUnique({
        where: { id: testScheduledTask.id },
      });

      expect(dbTask).toBeDefined();
      expect(dbTask.status).toBe('DELETED');
      expect(dbTask.uuid).toBe(testScheduledTask.uuid);
    });

    it('should not be able to delete already deleted task', async () => {
      // Delete the task first
      const firstDeleteResponse = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(firstDeleteResponse.status).toBe(200);

      // Try to delete again
      const secondDeleteResponse = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(secondDeleteResponse.status).toBe(500);
    });
  });

  describe('Response Format Validation', () => {
    it('should return correctly formatted success response', async () => {
      const response = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Scheduled task deleted' });
      expect(typeof response.body.message).toBe('string');
    });
  });

  describe('Multiple Scheduled Tasks', () => {
    it('should delete only the specified task when multiple tasks exist', async () => {
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

      // Verify all tasks exist
      const beforeResponse = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(beforeResponse.status).toBe(200);
      expect(beforeResponse.body).toHaveLength(3);

      // Delete only the original task
      const deleteResponse = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(deleteResponse.status).toBe(200);

      // Verify only the specified task was deleted
      const afterResponse = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(afterResponse.status).toBe(200);
      expect(afterResponse.body).toHaveLength(2);

      const remainingTaskUuids = afterResponse.body.map((task: any) => task.uuid);
      expect(remainingTaskUuids).toContain(task1.uuid);
      expect(remainingTaskUuids).toContain(task2.uuid);
      expect(remainingTaskUuids).not.toContain(testScheduledTask.uuid);
    });

    it('should be able to delete multiple tasks independently', async () => {
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

      // Delete first task
      const delete1Response = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(delete1Response.status).toBe(200);

      // Delete second task
      const delete2Response = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${task1.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(delete2Response.status).toBe(200);

      // Verify only one task remains
      const afterResponse = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(afterResponse.status).toBe(200);
      expect(afterResponse.body).toHaveLength(1);
      expect(afterResponse.body[0].uuid).toBe(task2.uuid);
    });
  });

  describe('Edge Cases', () => {
    it('should handle deletion of task with complex operations', async () => {
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
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${complexTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Scheduled task deleted' });
    });

    it('should handle deletion of task with special characters in operations', async () => {
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
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${specialTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Scheduled task deleted' });
    });

    it('should handle deletion of inactive task', async () => {
      // Update task status to INACTIVE
      await require('../../dbClient').default.scheduledTask.update({
        where: { id: testScheduledTask.id },
        data: { status: 'INACTIVE' },
      });

      const response = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Scheduled task deleted' });

      // Verify task is marked as DELETED
      const dbTask = await require('../../dbClient').default.scheduledTask.findUnique({
        where: { id: testScheduledTask.id },
      });

      expect(dbTask.status).toBe('DELETED');
    });
  });

  describe('Multiple Files Isolation', () => {
    it('should not delete tasks from other files', async () => {
      // Create another file for the same user and team using the test data generator
      const { createFile } = require('../../tests/testDataGenerator');
      const otherFile = await createFile({
        data: {
          name: 'Other Test File',
          ownerTeamId: testTeam.id,
          creatorUserId: testUser.id,
        },
      });

      const otherTask = await createScheduledTask({
        userId: testUser.id,
        fileId: otherFile.id,
        cronExpression: '0 1 * * *',
        operations: { action: 'other_file_task' },
      });

      // Delete task from first file
      const response = await request(app)
        .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(200);

      // Verify task from other file still exists
      const otherFileResponse = await request(app)
        .get(`/v0/files/${otherFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(otherFileResponse.status).toBe(200);
      expect(otherFileResponse.body).toHaveLength(1);
      expect(otherFileResponse.body[0].uuid).toBe(otherTask.uuid);
    });

    it('should not be able to delete task using wrong file UUID', async () => {
      // Create another file
      const { testFile: otherFile } = await createUserTeamAndFile();

      // Try to delete task from first file using second file's UUID
      const response = await request(app)
        .delete(`/v0/files/${otherFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(response.status).toBe(403);

      // Verify original task still exists
      const originalFileResponse = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(originalFileResponse.status).toBe(200);
      expect(originalFileResponse.body).toHaveLength(1);
      expect(originalFileResponse.body[0].uuid).toBe(testScheduledTask.uuid);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle deletion while other operations are happening', async () => {
      // Create additional tasks
      const task1 = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 1 * * *',
        operations: { action: 'concurrent_task1' },
      });

      const task2 = await createScheduledTask({
        userId: testUser.id,
        fileId: testFile.id,
        cronExpression: '0 2 * * *',
        operations: { action: 'concurrent_task2' },
      });

      // Perform concurrent operations
      const [deleteResponse, listResponse, getResponse] = await Promise.all([
        request(app)
          .delete(`/v0/files/${testFile.uuid}/scheduled_task/${testScheduledTask.uuid}`)
          .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`),
        request(app)
          .get(`/v0/files/${testFile.uuid}/scheduled_task`)
          .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`),
        request(app)
          .get(`/v0/files/${testFile.uuid}/scheduled_task/${task1.uuid}`)
          .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`),
      ]);

      expect(deleteResponse.status).toBe(200);
      expect(listResponse.status).toBe(200);
      expect(getResponse.status).toBe(200);

      // Verify final state
      const finalResponse = await request(app)
        .get(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`);

      expect(finalResponse.status).toBe(200);
      expect(finalResponse.body).toHaveLength(2);

      const remainingUuids = finalResponse.body.map((task: any) => task.uuid);
      expect(remainingUuids).toContain(task1.uuid);
      expect(remainingUuids).toContain(task2.uuid);
      expect(remainingUuids).not.toContain(testScheduledTask.uuid);
    });
  });
});
