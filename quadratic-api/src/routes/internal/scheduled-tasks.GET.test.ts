import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { M2M_AUTH_TOKEN } from '../../env-vars';
import { clearDb, createUserTeamAndFile } from '../../tests/testDataGenerator';

describe('GET /v0/internal/scheduled-tasks', () => {
  let testUser: any;
  let testFile: any;

  beforeEach(async () => {
    await clearDb();
    ({ testUser, testFile } = await createUserTeamAndFile());
  });

  afterEach(async () => {
    await clearDb();
  });

  describe('Authentication', () => {
    it('should return 400 when M2M auth token is missing', async () => {
      const response = await request(app).get('/v0/internal/scheduled-tasks');

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Invalid value');
    });

    it('should return 400 when M2M auth token is invalid', async () => {
      const response = await request(app)
        .get('/v0/internal/scheduled-tasks')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Invalid value');
    });

    it('should allow access with valid M2M auth token', async () => {
      const response = await request(app)
        .get('/v0/internal/scheduled-tasks')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Scheduled Task Retrieval', () => {
    it('should return empty array when no scheduled tasks exist', async () => {
      const response = await request(app)
        .get('/v0/internal/scheduled-tasks')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return only ACTIVE scheduled tasks that are due for execution', async () => {
      // Create a scheduled task that is due (past nextRunTime)
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago
      const dueTask = await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'test', type: 'daily' })),
          status: 'ACTIVE',
          nextRunTime: pastDate,
        },
      });

      // Create a scheduled task that is not due yet (future nextRunTime)
      const futureDate = new Date(Date.now() + 300000); // 5 minutes from now
      await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 1 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'test2', type: 'hourly' })),
          status: 'ACTIVE',
          nextRunTime: futureDate,
        },
      });

      // Create an INACTIVE scheduled task that is due
      await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 2 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'test3', type: 'weekly' })),
          status: 'INACTIVE',
          nextRunTime: pastDate,
        },
      });

      const response = await request(app)
        .get('/v0/internal/scheduled-tasks')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(dueTask.id);
    });

    it('should return scheduled tasks due exactly at current time', async () => {
      const now = new Date();
      const exactTask = await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'exact', type: 'daily' })),
          status: 'ACTIVE',
          nextRunTime: now,
        },
      });

      const response = await request(app)
        .get('/v0/internal/scheduled-tasks')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(exactTask.id);
    });

    it('should return multiple scheduled tasks when multiple are due', async () => {
      const pastDate = new Date(Date.now() - 60000);

      const task1 = await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'task1', type: 'daily' })),
          status: 'ACTIVE',
          nextRunTime: pastDate,
        },
      });

      const task2 = await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 1 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'task2', type: 'hourly' })),
          status: 'ACTIVE',
          nextRunTime: pastDate,
        },
      });

      const response = await request(app)
        .get('/v0/internal/scheduled-tasks')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);

      const returnedIds = response.body.map((task: any) => task.id);
      expect(returnedIds).toContain(task1.id);
      expect(returnedIds).toContain(task2.id);
    });
  });

  describe('Response Format', () => {
    it('should return only the required fields for each scheduled task', async () => {
      const pastDate = new Date(Date.now() - 60000);
      const operations = { action: 'test', type: 'daily', config: { param: 'value' } };

      const task = await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify(operations)),
          status: 'ACTIVE',
          nextRunTime: pastDate,
        },
      });

      const response = await request(app)
        .get('/v0/internal/scheduled-tasks')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);

      const returnedTask = response.body[0];

      // Should include these fields
      expect(returnedTask).toHaveProperty('id', task.id);
      expect(returnedTask).toHaveProperty('nextRunTime');
      expect(returnedTask).toHaveProperty('operations', operations);

      // Should NOT include sensitive or unnecessary fields
      expect(returnedTask).not.toHaveProperty('userId');
      expect(returnedTask).not.toHaveProperty('fileId');
      expect(returnedTask).not.toHaveProperty('cronExpression');
      expect(returnedTask).not.toHaveProperty('status');
      expect(returnedTask).not.toHaveProperty('createdAt');
      expect(returnedTask).not.toHaveProperty('updatedAt');

      // Verify nextRunTime format
      expect(new Date(returnedTask.nextRunTime)).toEqual(pastDate);
    });

    it('should handle complex operations objects correctly', async () => {
      const pastDate = new Date(Date.now() - 60000);
      const complexOperations = {
        action: 'complex_action',
        type: 'scheduled',
        config: {
          parameters: ['param1', 'param2'],
          settings: {
            timeout: 30000,
            retries: 3,
            nested: {
              value: 'test',
            },
          },
        },
      };

      await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify(complexOperations)),
          status: 'ACTIVE',
          nextRunTime: pastDate,
        },
      });

      const response = await request(app)
        .get('/v0/internal/scheduled-tasks')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);

      // Operations should be parsed JSON object
      expect(response.body[0].operations).toEqual(complexOperations);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tasks with empty operations', async () => {
      const pastDate = new Date(Date.now() - 60000);

      await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 0 * * *',
          operations: Buffer.from('{}'),
          status: 'ACTIVE',
          nextRunTime: pastDate,
        },
      });

      const response = await request(app)
        .get('/v0/internal/scheduled-tasks')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].operations).toEqual({});
    });

    it('should not return DELETED scheduled tasks', async () => {
      const pastDate = new Date(Date.now() - 60000);

      await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'deleted', type: 'daily' })),
          status: 'DELETED',
          nextRunTime: pastDate,
        },
      });

      const response = await request(app)
        .get('/v0/internal/scheduled-tasks')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(0);
    });

    it('should handle multiple statuses correctly', async () => {
      const pastDate = new Date(Date.now() - 60000);

      // Create one ACTIVE task (should be returned)
      await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'active', type: 'daily' })),
          status: 'ACTIVE',
          nextRunTime: pastDate,
        },
      });

      // Create one INACTIVE task (should not be returned)
      await dbClient.scheduledTask.create({
        data: {
          userId: testUser.id,
          fileId: testFile.id,
          cronExpression: '0 1 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'inactive', type: 'daily' })),
          status: 'INACTIVE',
          nextRunTime: pastDate,
        },
      });

      const response = await request(app)
        .get('/v0/internal/scheduled-tasks')
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);

      // Verify the returned task has the correct operations
      expect(response.body[0].operations.action).toBe('active');
    });
  });
});
