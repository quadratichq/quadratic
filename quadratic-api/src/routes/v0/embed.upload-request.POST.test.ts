import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb } from '../../tests/testDataGenerator';

describe('POST /v0/embed/upload-request', () => {
  afterAll(clearDb);

  describe('successful requests', () => {
    it('returns upload URL for client-provided claim token', async () => {
      const claimToken = '00000000-0000-4000-8000-000000000100';
      const response = await request(app)
        .post('/v0/embed/upload-request')
        .send({ version: '1.12', claimToken })
        .expect(200);

      expect(response.body).toHaveProperty('uploadUrl');
      expect(response.body.uploadUrl).toMatch(/^https?:\/\//);

      // Verify an unclaimed file record was created in the database
      const unclaimedFile = await dbClient.unclaimedFile.findUnique({
        where: { claimToken },
      });
      expect(unclaimedFile).not.toBeNull();
      expect(unclaimedFile?.version).toBe('1.12');
      expect(unclaimedFile?.storageKey).toContain('unclaimed/');
      expect(unclaimedFile?.storageKey).toContain('.grid');
      expect(unclaimedFile?.expiresAt).toBeInstanceOf(Date);
      // Expiration should be approximately 24 hours from now
      const now = new Date();
      const twentyThreeHours = 23 * 60 * 60 * 1000;
      const twentyFiveHours = 25 * 60 * 60 * 1000;
      expect(unclaimedFile!.expiresAt.getTime() - now.getTime()).toBeGreaterThan(twentyThreeHours);
      expect(unclaimedFile!.expiresAt.getTime() - now.getTime()).toBeLessThan(twentyFiveHours);
    });

    it('creates different storage keys for different claim tokens', async () => {
      const claimToken1 = '00000000-0000-4000-8000-000000000101';
      const claimToken2 = '00000000-0000-4000-8000-000000000102';

      const response1 = await request(app)
        .post('/v0/embed/upload-request')
        .send({ version: '1.12', claimToken: claimToken1 })
        .expect(200);

      const response2 = await request(app)
        .post('/v0/embed/upload-request')
        .send({ version: '1.12', claimToken: claimToken2 })
        .expect(200);

      expect(response1.body.uploadUrl).not.toBe(response2.body.uploadUrl);
    });
  });

  describe('bad requests', () => {
    it('rejects request without version', async () => {
      await request(app)
        .post('/v0/embed/upload-request')
        .send({ claimToken: '00000000-0000-4000-8000-000000000200' })
        .expect(400);
    });

    it('rejects request without claimToken', async () => {
      await request(app).post('/v0/embed/upload-request').send({ version: '1.12' }).expect(400);
    });

    it('rejects request with invalid claimToken format', async () => {
      await request(app)
        .post('/v0/embed/upload-request')
        .send({ version: '1.12', claimToken: 'not-a-uuid' })
        .expect(400);
    });
  });

  describe('cleanup of expired files', () => {
    it('cleans up expired unclaimed files opportunistically', async () => {
      // Create an expired unclaimed file directly in the database
      const expiredClaimToken = '00000000-0000-4000-8000-000000000099';
      await dbClient.unclaimedFile.create({
        data: {
          claimToken: expiredClaimToken,
          storageKey: 'unclaimed/expired-file.grid',
          version: '1.0',
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      // Verify it exists
      let expiredFile = await dbClient.unclaimedFile.findUnique({
        where: { claimToken: expiredClaimToken },
      });
      expect(expiredFile).not.toBeNull();

      // Make a new upload request (which triggers cleanup)
      const newClaimToken = '00000000-0000-4000-8000-000000000300';
      await request(app)
        .post('/v0/embed/upload-request')
        .send({ version: '1.12', claimToken: newClaimToken })
        .expect(200);

      // Give the async cleanup a moment to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the expired file was cleaned up
      expiredFile = await dbClient.unclaimedFile.findUnique({
        where: { claimToken: expiredClaimToken },
      });
      expect(expiredFile).toBeNull();
    });
  });
});
