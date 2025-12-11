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
      id: 'team_1_viewer',
      firstName: 'Test',
      lastName: 'User 3',
    },
    {
      id: 'user_without_team',
      firstName: 'Test',
      lastName: 'User 4',
    },
  ])
);

import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFile, createTeam, createUser } from '../../tests/testDataGenerator';

beforeEach(async () => {
  const user_1 = await createUser({ auth0Id: 'team_1_owner' });
  const user_2 = await createUser({ auth0Id: 'team_1_editor' });
  const user_3 = await createUser({ auth0Id: 'team_1_viewer' });
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
      { userId: user_3.id, role: 'VIEWER' },
    ],
  });

  // Create a deleted file
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      name: 'Deleted File',
      uuid: '00000000-0000-4000-8000-000000000001',
      deleted: true,
      deletedDate: new Date('2024-01-01'),
    },
  });

  // Create a non-deleted file
  await createFile({
    data: {
      creatorUserId: user_1.id,
      ownerTeamId: team.id,
      name: 'Active File',
      uuid: '00000000-0000-4000-8000-000000000002',
      deleted: false,
    },
  });
});

afterEach(clearDb);

describe('POST /v0/files/:uuid/restore', () => {
  describe('bad requests', () => {
    it('responds with a 401 for unauthorized request', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/restore')
        .expect(401)
        .expect(expectError);
    });

    it('responds with a 404 for requesting a file that does not exist', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-999999999999/restore')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(404)
        .expect(expectError);
    });

    it('responds with a 403 for user without access to the file', async () => {
      // Get the existing user without team access
      const user_4 = await dbClient.user.findUnique({ where: { auth0Id: 'user_without_team' } });
      if (!user_4) throw new Error('user_4 not found');
      const team2 = await createTeam({
        team: {
          name: 'Test Team 2',
          uuid: '00000000-0000-4000-8000-000000000002',
        },
        users: [
          {
            userId: user_4.id,
            role: 'OWNER',
          },
        ],
      });

      await createFile({
        data: {
          creatorUserId: user_4.id,
          ownerTeamId: team2.id,
          name: 'Other Team File',
          uuid: '00000000-0000-4000-8000-000000000003',
          deleted: true,
          deletedDate: new Date('2024-01-01'),
        },
      });

      // team_1_owner trying to restore a file from team2
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000003/restore')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(403)
        .expect(expectError);
    });

    it('responds with a 400 for trying to restore a non-deleted file', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000002/restore')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(400)
        .expect(expectError);
    });

    it('responds with a 403 for viewer trying to restore', async () => {
      await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/restore')
        .set('Authorization', `Bearer ValidToken team_1_viewer`)
        .expect(403)
        .expect(expectError);
    });
  });

  describe('valid requests', () => {
    it('successfully restores a file for team owner', async () => {
      const response = await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/restore')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200);

      expect(response.body.message).toBe('File restored successfully');
      expect(response.body.file.uuid).toBe('00000000-0000-4000-8000-000000000001');
      expect(response.body.file.name).toBe('Deleted File');
      expect(response.body.file.deleted).toBe(false);
      expect(response.body.file.deletedDate).toBe(null);

      // Verify in database
      const file = await dbClient.file.findUnique({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
      });
      expect(file?.deleted).toBe(false);
      expect(file?.deletedDate).toBe(null);
    });

    it('successfully restores a file for team editor', async () => {
      const response = await request(app)
        .post('/v0/files/00000000-0000-4000-8000-000000000001/restore')
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect(200);

      expect(response.body.message).toBe('File restored successfully');
      expect(response.body.file.deleted).toBe(false);
    });
  });
});

