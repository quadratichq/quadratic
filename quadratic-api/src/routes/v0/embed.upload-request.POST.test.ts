import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb } from '../../tests/testDataGenerator';

describe('POST /v0/embed/upload-request', () => {
  afterAll(clearDb);

  describe('successful requests', () => {
    it('returns upload URL and server-generated claim token', async () => {
      const response = await request(app)
        .post('/v0/embed/upload-request')
        .send({ version: '1.12' })
        .expect(200);

      expect(response.body).toHaveProperty('uploadUrl');
      expect(response.body.uploadUrl).toMatch(/^https?:\/\//);
      expect(response.body).toHaveProperty('claimToken');
      expect(response.body.claimToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      const claimToken = response.body.claimToken;
      const unclaimedFile = await dbClient.unclaimedFile.findUnique({
        where: { claimToken },
      });
      expect(unclaimedFile).not.toBeNull();
      expect(unclaimedFile?.version).toBe('1.12');
      expect(unclaimedFile?.storageKey).toContain('unclaimed/');
      expect(unclaimedFile?.storageKey).toContain('.grid');
      expect(unclaimedFile?.expiresAt).toBeInstanceOf(Date);
      const now = new Date();
      const twentyThreeHours = 23 * 60 * 60 * 1000;
      const twentyFiveHours = 25 * 60 * 60 * 1000;
      expect(unclaimedFile!.expiresAt.getTime() - now.getTime()).toBeGreaterThan(twentyThreeHours);
      expect(unclaimedFile!.expiresAt.getTime() - now.getTime()).toBeLessThan(twentyFiveHours);
    });

    it('creates different storage keys for different requests', async () => {
      const response1 = await request(app)
        .post('/v0/embed/upload-request')
        .send({ version: '1.12' })
        .expect(200);

      const response2 = await request(app)
        .post('/v0/embed/upload-request')
        .send({ version: '1.12' })
        .expect(200);

      expect(response1.body.claimToken).not.toBe(response2.body.claimToken);
      expect(response1.body.uploadUrl).not.toBe(response2.body.uploadUrl);
    });
  });

  describe('bad requests', () => {
    it('rejects request without version', async () => {
      await request(app).post('/v0/embed/upload-request').send({}).expect(400);
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

      await request(app)
        .post('/v0/embed/upload-request')
        .send({ version: '1.12' })
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
