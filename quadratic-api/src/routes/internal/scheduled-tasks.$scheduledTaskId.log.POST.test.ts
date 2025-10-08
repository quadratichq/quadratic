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
    sequenceNumber: 1,
    version: '1.0.0',
    s3Key: 'test-key',
    s3Bucket: 'test-bucket',
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
    it('should return 400 when sequenceNumber is missing', async () => {
      const invalidBody = { ...validRequestBody };
      delete (invalidBody as any).sequenceNumber;

      const response = await request(app).post(URL).set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 when sequenceNumber is not a number', async () => {
      const invalidBody = { ...validRequestBody, sequenceNumber: 'invalid' };

      const response = await request(app).post(URL).set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 when version is missing', async () => {
      const invalidBody = { ...validRequestBody };
      delete (invalidBody as any).version;

      const response = await request(app).post(URL).set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 when s3Key is missing', async () => {
      const invalidBody = { ...validRequestBody };
      delete (invalidBody as any).s3Key;

      const response = await request(app).post(URL).set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 when s3Bucket is missing', async () => {
      const invalidBody = { ...validRequestBody };
      delete (invalidBody as any).s3Bucket;

      const response = await request(app).post(URL).set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 when scheduledTaskId is not a valid UUID', async () => {
      const invalidURL = '/v0/internal/scheduled-tasks/invalid-uuid/log';

      const response = await request(app)
        .post(invalidURL)
        .set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`)
        .send(validRequestBody);

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
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
        error: undefined,
        createdDate: expect.any(String),
      });
    });

    it('should create a scheduled task log with RUNNING status', async () => {
      const requestBody = { ...validRequestBody, status: 'RUNNING' as const };

      const response = await request(app).post(URL).set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        scheduledTaskId: expect.any(Number),
        status: 'RUNNING',
        error: undefined,
        createdDate: expect.any(String),
      });
    });

    it('should create a scheduled task log with PENDING status and update next run time', async () => {
      const requestBody = { ...validRequestBody, status: 'PENDING' as const };

      const response = await request(app).post(URL).set('Authorization', `Bearer ${M2M_AUTH_TOKEN}`).send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: expect.any(Number),
        scheduledTaskId: expect.any(Number),
        status: 'PENDING',
        error: undefined,
        createdDate: expect.any(String),
      });
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
      expect(response.body.message).toContain('not found');
    });
  });
});
