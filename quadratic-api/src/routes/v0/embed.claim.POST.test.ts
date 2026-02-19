import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createTeam, createUsers, upgradeTeamToPro } from '../../tests/testDataGenerator';

describe('POST /v0/embed/claim', () => {
  let testUser: Awaited<ReturnType<typeof createUsers>>[0];
  let testTeam: Awaited<ReturnType<typeof createTeam>>;

  beforeAll(async () => {
    // Create a test user and team
    [testUser] = await createUsers(['embed_claim_user']);
    testTeam = await createTeam({
      team: { uuid: '00000000-0000-4000-8000-000000000010' },
      users: [{ userId: testUser.id, role: 'OWNER' }],
    });
    // Upgrade the team to avoid file limits
    await upgradeTeamToPro(testTeam.id);
  });

  afterAll(clearDb);

  describe('successful claims', () => {
    it('claims an unclaimed file and creates a new file for the user', async () => {
      // Create an unclaimed file record
      const claimToken = '00000000-0000-4000-8000-000000000001';
      await dbClient.unclaimedFile.create({
        data: {
          claimToken,
          storageKey: `unclaimed/${claimToken}.grid`,
          version: '1.12',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      });

      const response = await request(app)
        .post('/v0/embed/claim')
        .send({ claimToken })
        .set('Authorization', 'Bearer ValidToken embed_claim_user')
        .expect(201);

      expect(response.body).toHaveProperty('file');
      expect(response.body.file).toHaveProperty('uuid');
      expect(response.body.file).toHaveProperty('name');
      expect(response.body.file.name).toBe('Imported Spreadsheet');
      expect(response.body).toHaveProperty('team');
      expect(response.body.team).toHaveProperty('uuid');
      expect(response.body).toHaveProperty('redirectUrl');
      expect(response.body.redirectUrl).toContain('/file/');

      // Verify the file was created in the database
      const createdFile = await dbClient.file.findUnique({
        where: { uuid: response.body.file.uuid },
        include: { FileCheckpoint: true },
      });
      expect(createdFile).not.toBeNull();
      expect(createdFile?.creatorUserId).toBe(testUser.id);
      expect(createdFile?.ownerUserId).toBe(testUser.id); // Private file
      expect(createdFile?.FileCheckpoint).toHaveLength(1);
      expect(createdFile?.FileCheckpoint[0].version).toBe('1.12');

      // Verify the unclaimed file record was deleted
      const unclaimedFile = await dbClient.unclaimedFile.findUnique({
        where: { claimToken },
      });
      expect(unclaimedFile).toBeNull();
    });
  });

  describe('bad requests', () => {
    it('rejects unauthorized request', async () => {
      await request(app)
        .post('/v0/embed/claim')
        .send({ claimToken: '00000000-0000-4000-8000-000000000002' })
        .expect(401)
        .expect(expectError);
    });

    it('rejects request without claim token', async () => {
      await request(app)
        .post('/v0/embed/claim')
        .send({})
        .set('Authorization', 'Bearer ValidToken embed_claim_user')
        .expect(400)
        .expect(expectError);
    });

    it('returns 404 for non-existent claim token', async () => {
      await request(app)
        .post('/v0/embed/claim')
        .send({ claimToken: '00000000-0000-4000-8000-999999999999' })
        .set('Authorization', 'Bearer ValidToken embed_claim_user')
        .expect(404)
        .expect(expectError);
    });

    it('returns 410 for expired claim token', async () => {
      // Create an expired unclaimed file
      const expiredClaimToken = '00000000-0000-4000-8000-000000000003';
      await dbClient.unclaimedFile.create({
        data: {
          claimToken: expiredClaimToken,
          storageKey: `unclaimed/${expiredClaimToken}.grid`,
          version: '1.12',
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        },
      });

      await request(app)
        .post('/v0/embed/claim')
        .send({ claimToken: expiredClaimToken })
        .set('Authorization', 'Bearer ValidToken embed_claim_user')
        .expect(410)
        .expect(expectError);

      // Verify the expired record was cleaned up
      const unclaimedFile = await dbClient.unclaimedFile.findUnique({
        where: { claimToken: expiredClaimToken },
      });
      expect(unclaimedFile).toBeNull();
    });

    it('prevents double-claiming the same token', async () => {
      // Create an unclaimed file
      const claimToken = '00000000-0000-4000-8000-000000000004';
      await dbClient.unclaimedFile.create({
        data: {
          claimToken,
          storageKey: `unclaimed/${claimToken}.grid`,
          version: '1.12',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // First claim should succeed
      await request(app)
        .post('/v0/embed/claim')
        .send({ claimToken })
        .set('Authorization', 'Bearer ValidToken embed_claim_user')
        .expect(201);

      // Second claim should fail with 404 (token no longer exists)
      await request(app)
        .post('/v0/embed/claim')
        .send({ claimToken })
        .set('Authorization', 'Bearer ValidToken embed_claim_user')
        .expect(404)
        .expect(expectError);
    });
  });

  describe('user without team', () => {
    it('returns 400 when user has no team', async () => {
      // Create a user without any team membership
      const [noTeamUser] = await createUsers(['no_team_user']);

      // Create an unclaimed file
      const claimToken = '00000000-0000-4000-8000-000000000005';
      await dbClient.unclaimedFile.create({
        data: {
          claimToken,
          storageKey: `unclaimed/${claimToken}.grid`,
          version: '1.12',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await request(app)
        .post('/v0/embed/claim')
        .send({ claimToken })
        .set('Authorization', 'Bearer ValidToken no_team_user')
        .expect(400)
        .expect(expectError);
    });
  });
});
