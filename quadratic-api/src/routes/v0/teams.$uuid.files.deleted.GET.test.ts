import { workosMock } from '../../tests/workosMock';
jest.mock('@workos-inc/node', () =>
  workosMock([
    {
      id: 'team_1_owner',
      firstName: 'Test',
      lastName: 'User 1',
    },
    {
      id: 'team_1_editor',
      firstName: 'Test',
      lastName: 'User 2',
    },
    {
      id: 'user_without_team',
      firstName: 'Test',
      lastName: 'User 3',
    },
  ])
);

import request from 'supertest';
import { app } from '../../app';
import { expectError } from '../../tests/helpers';
import { clearDb, createFile, createTeam, createUser } from '../../tests/testDataGenerator';

beforeEach(async () => {
  const user_1 = await createUser({ auth0Id: 'team_1_owner' });
  const user_2 = await createUser({ auth0Id: 'team_1_editor' });
  await createUser({ auth0Id: 'user_without_team' });

  const team = await createTeam({
    team: {
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
    },
    users: [
      {
        userId: user_1.id,
        role: 'OWNER',
      },
      { userId: user_2.id, role: 'EDITOR' },
    ],
  });

  // Create some deleted files (within last 30 days)
  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      name: 'Deleted Public File',
      uuid: '00000000-0000-4000-8000-000000000001',
      deleted: true,
      deletedDate: tenDaysAgo,
    },
  });

  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      ownerUserId: user_1.id,
      name: 'Deleted Private File',
      uuid: '00000000-0000-4000-8000-000000000002',
      deleted: true,
      deletedDate: fiveDaysAgo,
    },
  });

  // Create a file deleted more than 30 days ago (should not appear in results)
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      name: 'Old Deleted File',
      uuid: '00000000-0000-4000-8000-000000000004',
      deleted: true,
      deletedDate: fortyDaysAgo,
    },
  });

  // Create a non-deleted file (should not appear in results)
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      name: 'Active File',
      uuid: '00000000-0000-4000-8000-000000000003',
      deleted: false,
    },
  });
});

afterEach(clearDb);

describe('GET /v0/teams/:uuid/files/deleted', () => {
  describe('bad requests', () => {
    it('responds with a 401 for unauthorized request', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-4000-8000-000000000001/files/deleted')
        .expect(401)
        .expect(expectError);
    });

    it('responds with a 404 for requesting a team that does not exist', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-4000-8000-999999999999/files/deleted')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(404)
        .expect(expectError);
    });

    it('responds with a 403 for requesting a team you do not have access to', async () => {
      await request(app)
        .get('/v0/teams/00000000-0000-4000-8000-000000000001/files/deleted')
        .set('Authorization', `Bearer ValidToken user_without_team`)
        .expect(403)
        .expect(expectError);
    });
  });

  describe('valid requests', () => {
    it('responds with deleted files for team owner', async () => {
      const response = await request(app)
        .get('/v0/teams/00000000-0000-4000-8000-000000000001/files/deleted')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200);

      expect(response.body).toHaveLength(2);

      // Should be ordered by deletedDate desc (most recent first)
      expect(response.body[0].file.name).toBe('Deleted Private File');
      expect(response.body[1].file.name).toBe('Deleted Public File');

      // Check that both files are marked as deleted
      response.body.forEach((item: any) => {
        expect(item.file.deletedDate).toBeTruthy();
        expect(item.userMakingRequest.filePermissions).toBeDefined();
      });
    });

    it('responds with deleted files for team editor', async () => {
      const response = await request(app)
        .get('/v0/teams/00000000-0000-4000-8000-000000000001/files/deleted')
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect(200);

      expect(response.body).toHaveLength(1); // Only public deleted file
      expect(response.body[0].file.name).toBe('Deleted Public File');
    });

    it('does not include non-deleted files', async () => {
      const response = await request(app)
        .get('/v0/teams/00000000-0000-4000-8000-000000000001/files/deleted')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200);

      const fileNames = response.body.map((item: any) => item.file.name);
      expect(fileNames).not.toContain('Active File');
    });

    it('only returns files deleted within the last 30 days', async () => {
      const response = await request(app)
        .get('/v0/teams/00000000-0000-4000-8000-000000000001/files/deleted')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      const fileNames = response.body.map((item: any) => item.file.name);
      expect(fileNames).toContain('Deleted Public File');
      expect(fileNames).toContain('Deleted Private File');
      expect(fileNames).not.toContain('Old Deleted File'); // Deleted 40 days ago
    });
  });
});
