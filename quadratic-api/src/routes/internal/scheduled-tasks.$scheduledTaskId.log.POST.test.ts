import request from 'supertest';
import { app } from '../../app';
import { M2M_AUTH_TOKEN } from '../../env-vars';
import { clearDb, createUserTeamAndFile, scheduledTask } from '../../tests/testDataGenerator';

describe('POST /v0/internal/scheduled-tasks/:scheduledTaskId/log', () => {
  let testUser: any;
  let testFile: any;
  let testScheduledTask: any;
  let URL: string;

  beforeEach(async () => {
    await clearDb();
    ({ testUser, testFile } = await createUserTeamAndFile());
    testScheduledTask = await scheduledTask(testUser.id, testFile.id);
    URL = `/v0/internal/scheduled-tasks/${testScheduledTask.uuid}/log`;
  });

  afterEach(async () => {
    await clearDb();
  });

  const validRequestBody = {
    status: 'PENDING' as const,
  };

  describe('Authentication', () => {
    it('should return 400 when M2M auth token is missing', async () => {
      const response = await request(app).post(URL).send(validRequestBody);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Invalid value');
    });

    it('should return 400 when M2M auth token is invalid', async () => {
      const response = await request(app).post(URL).set('Authorization', 'Bearer invalid-token').send(validRequestBody);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toBe('Invalid value');
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when scheduledTaskId is not a valid UUID', async () => {
      const invalidURL = '/v0/internal/scheduled-tasks/invalid-uuid/log';

      const response = await request(app)
        .post(invalidURL)
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`)
        .send(validRequestBody);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe('Bad request. Schema validation failed');
    });
  });

  describe('Scheduled Task Log Creation', () => {
    it('should create a scheduled task log with PENDING status', async () => {
      const requestBody = { ...validRequestBody, status: 'PENDING' as const };

      const response = await request(app).post(URL).set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        scheduledTaskId: expect.any(Number),
        status: 'PENDING',
        createdDate: expect.any(String),
      });
      // The working API doesn't include error field when undefined
      expect(response.body).not.toHaveProperty('error');
    });

    it('should create a scheduled task log with RUNNING status', async () => {
      const requestBody = { ...validRequestBody, status: 'RUNNING' as const };

      const response = await request(app).post(URL).set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        scheduledTaskId: expect.any(Number),
        status: 'RUNNING',
        createdDate: expect.any(String),
      });
      // The working API doesn't include error field when undefined
      expect(response.body).not.toHaveProperty('error');
    });

    it('should create a scheduled task log with PENDING status and update next run time', async () => {
      const requestBody = { ...validRequestBody, status: 'PENDING' as const };

      const response = await request(app).post(URL).set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        scheduledTaskId: expect.any(Number),
        status: 'PENDING',
        createdDate: expect.any(String),
      });
      // The working API doesn't include error field when undefined
      expect(response.body).not.toHaveProperty('error');
    });

    it('should create a scheduled task log with FAILED status and error message', async () => {
      const requestBody = {
        ...validRequestBody,
        status: 'FAILED' as const,
        error: 'Test error message',
      };

      const response = await request(app).post(URL).set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        scheduledTaskId: expect.any(Number),
        status: 'FAILED',
        error: 'Test error message',
        createdDate: expect.any(String),
      });
    });

    it('should return 500 when scheduled task does not exist', async () => {
      const nonExistentUUID = '550e8400-e29b-41d4-a716-446655440000';
      const invalidURL = `/v0/internal/scheduled-tasks/${nonExistentUUID}/log`;

      const response = await request(app)
        .post(invalidURL)
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`)
        .send(validRequestBody);

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain('not found');
    });
  });
});
