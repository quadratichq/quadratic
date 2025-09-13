import { workosMock } from '../../tests/workosMock';

jest.mock('@workos-inc/node', () => workosMock([{ id: 'user1' }, { id: 'user2' }]));

import request from 'supertest';
import { app } from '../../app';
import { clearDb, createUserTeamAndFile } from '../../tests/testDataGenerator';

// Helper function to generate expected serialized Buffer format for HTTP responses
const expectSerializedBuffer = (data: any) => ({
  type: 'Buffer',
  data: Array.from(Buffer.from(JSON.stringify(data))),
});

describe('POST /v0/files/:uuid/scheduled-tasks', () => {
  let uniqueId: string;
  let testUser: any;
  let testTeam: any;
  let testFile: any;

  beforeEach(async () => {
    await clearDb();

    ({ uniqueId, testUser, testTeam, testFile } = await createUserTeamAndFile());
  });

  afterEach(async () => await clearDb());

  describe('Request Validation', () => {
    it('should return 400 for invalid UUID parameter format', async () => {
      const response = await request(app)
        .post('/v0/files/invalid-uuid/scheduled-tasks')
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'test' })),
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 when cronExpression is missing', async () => {
      const response = await request(app)
        .post(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          operations: Buffer.from(JSON.stringify({ action: 'test' })),
        });

      expect(response.status).toBe(400);
    });

    it('should return 400 when operations is missing', async () => {
      const response = await request(app)
        .post(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '0 0 * * *',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('File Permission Checks', () => {
    it('should return 403 when user lacks FILE_EDIT permission', async () => {
      const response = await request(app)
        .post(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken other-user-${uniqueId}`)
        .send({
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'test' })),
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Permission denied');
    });

    it('should succeed when user has FILE_EDIT permission', async () => {
      const response = await request(app)
        .post(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'test' })),
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('uuid');
      expect(response.body.cronExpression).toBe('0 0 * * *');
      expect(response.body.operations).toEqual({
        type: 'Buffer',
        data: Array.from(Buffer.from(JSON.stringify({ action: 'test' }))),
      });
      expect(response.body.status).toBe('ACTIVE');
    });
  });

  describe('Successful Task Creation', () => {
    it('should create scheduled task with simple cron expression', async () => {
      const response = await request(app)
        .post(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '0 0 * * *', // Daily at midnight
          operations: Buffer.from(JSON.stringify({ action: 'backup', type: 'daily' })),
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        fileId: testFile.id,
        userId: testUser.id,
        cronExpression: '0 0 * * *',
        operations: expectSerializedBuffer({ action: 'backup', type: 'daily' }),
        status: 'ACTIVE',
      });
      expect(response.body.id).toBeDefined();
      expect(response.body.uuid).toBeDefined();
      expect(response.body.nextRunTime).toBeDefined();
      expect(response.body.createdDate).toBeDefined();
      expect(response.body.updatedDate).toBeDefined();
    });

    it('should create scheduled task with complex cron expression', async () => {
      const response = await request(app)
        .post(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '30 14 * * 1-5', // 2:30 PM on weekdays
          operations: Buffer.from(
            JSON.stringify({
              action: 'weekday_report',
              recipients: ['admin@example.com'],
              format: 'pdf',
            })
          ),
        });

      expect(response.status).toBe(201);
      expect(response.body.cronExpression).toBe('30 14 * * 1-5');
      expect(response.body.operations).toEqual({
        type: 'Buffer',
        data: Array.from(
          Buffer.from(
            JSON.stringify({
              action: 'weekday_report',
              recipients: ['admin@example.com'],
              format: 'pdf',
            })
          )
        ),
      });
    });

    it('should handle complex operations object', async () => {
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
          {
            name: 'load',
            destination: { type: 's3', bucket: 'analytics-data' },
            format: 'parquet',
          },
        ],
        notifications: {
          onSuccess: ['data-team@example.com'],
          onFailure: ['alerts@example.com'],
        },
      };

      const response = await request(app)
        .post(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '0 2 * * *', // Daily at 2 AM
          operations: Buffer.from(JSON.stringify(complexOperations)),
        });

      expect(response.status).toBe(201);
      expect(response.body.operations).toEqual({
        type: 'Buffer',
        data: Array.from(Buffer.from(JSON.stringify(complexOperations))),
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .post('/v0/files/12345678-1234-1234-1234-123456789012/scheduled-tasks')
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'test' })),
        });

      expect(response.status).toBe(404);
    });

    it('should return 400 for invalid cron expression', async () => {
      const response = await request(app)
        .post(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: 'invalid cron',
          operations: Buffer.from(JSON.stringify({ action: 'test' })),
        });

      expect(response.status).toBe(400);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .post(`/v0/files/${testFile.uuid}/scheduled_task`)
        .send({
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'test' })),
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Response Format', () => {
    it('should return correctly formatted response', async () => {
      const response = await request(app)
        .post(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'test' })),
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(typeof response.body.id).toBe('number');
      expect(response.body).toHaveProperty('uuid');
      expect(typeof response.body.uuid).toBe('string');
      expect(response.body).toHaveProperty('fileId');
      expect(response.body.fileId).toBe(testFile.id);
      expect(response.body).toHaveProperty('userId');
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body).toHaveProperty('nextRunTime');
      expect(typeof response.body.nextRunTime).toBe('string');
      expect(response.body).toHaveProperty('lastRunTime');
      expect(response.body.lastRunTime).toBe('');
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ACTIVE');
      expect(response.body).toHaveProperty('cronExpression');
      expect(response.body.cronExpression).toBe('0 0 * * *');
      expect(response.body).toHaveProperty('operations');
      expect(response.body.operations).toEqual({
        type: 'Buffer',
        data: Array.from(Buffer.from(JSON.stringify({ action: 'test' }))),
      });
      expect(response.body).toHaveProperty('createdDate');
      expect(typeof response.body.createdDate).toBe('string');
      expect(response.body).toHaveProperty('updatedDate');
      expect(typeof response.body.updatedDate).toBe('string');
    });

    it('should validate nextRunTime is in the future', async () => {
      const response = await request(app)
        .post(`/v0/files/${testFile.uuid}/scheduled_task`)
        .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
        .send({
          cronExpression: '0 0 * * *',
          operations: Buffer.from(JSON.stringify({ action: 'test' })),
        });

      expect(response.status).toBe(201);
      const nextRunTime = new Date(response.body.nextRunTime);
      const now = new Date();
      expect(nextRunTime.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('Different Cron Expressions', () => {
    const cronExpressions = [
      { cron: '0 0 * * *', description: 'Daily at midnight' },
      { cron: '0 */6 * * *', description: 'Every 6 hours' },
      { cron: '0 0 * * 1', description: 'Every Monday at midnight' },
      { cron: '30 14 * * *', description: 'Daily at 2:30 PM' },
      { cron: '0 9 * * 1-5', description: 'Weekdays at 9 AM' },
      { cron: '*/15 * * * *', description: 'Every 15 minutes' },
    ];

    cronExpressions.forEach(({ cron, description }) => {
      it(`should handle ${description} (${cron})`, async () => {
        const response = await request(app)
          .post(`/v0/files/${testFile.uuid}/scheduled_task`)
          .set('Authorization', `Bearer ValidToken test-user-${uniqueId}`)
          .send({
            cronExpression: cron,
            operations: Buffer.from(JSON.stringify({ action: 'test', description })),
          });

        expect(response.status).toBe(201);
        expect(response.body.cronExpression).toBe(cron);
        const nextRunTime = new Date(response.body.nextRunTime);
        expect(nextRunTime.getTime()).toBeGreaterThan(Date.now());
      });
    });
  });
});
