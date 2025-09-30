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

describe('PATCH /v0/teams/:uuid/files/:fileUuid', () => {
  describe('bad requests', () => {
    it('responds with a 401 for unauthorized request', async () => {
      await request(app)
        .patch('/v0/teams/00000000-0000-4000-8000-000000000001/files/00000000-0000-4000-8000-000000000001')
        .send({ action: 'undelete' })
        .expect(401)
        .expect(expectError);
    });

    it('responds with a 404 for requesting a team that does not exist', async () => {
      await request(app)
        .patch('/v0/teams/00000000-0000-4000-8000-999999999999/files/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .send({ action: 'undelete' })
        .expect(404)
        .expect(expectError);
    });

    it('responds with a 404 for requesting a file that does not exist', async () => {
      await request(app)
        .patch('/v0/teams/00000000-0000-4000-8000-000000000001/files/00000000-0000-4000-8000-999999999999')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .send({ action: 'undelete' })
        .expect(404)
        .expect(expectError);
    });

    it('responds with a 404 for requesting a file from a different team', async () => {
      // Create another team and file
      const user_4 = await createUser({ auth0Id: 'user_without_team' });
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

      await request(app)
        .patch('/v0/teams/00000000-0000-4000-8000-000000000001/files/00000000-0000-4000-8000-000000000003')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .send({ action: 'undelete' })
        .expect(404)
        .expect(expectError);
    });

    it('responds with a 400 for trying to un-delete a non-deleted file', async () => {
      await request(app)
        .patch('/v0/teams/00000000-0000-4000-8000-000000000001/files/00000000-0000-4000-8000-000000000002')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .send({ action: 'undelete' })
        .expect(400)
        .expect(expectError);
    });

    it('responds with a 400 for invalid action', async () => {
      await request(app)
        .patch('/v0/teams/00000000-0000-4000-8000-000000000001/files/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .send({ action: 'invalid' })
        .expect(400)
        .expect(expectError);
    });

    it('responds with a 403 for requesting a team you do not have access to', async () => {
      await request(app)
        .patch('/v0/teams/00000000-0000-4000-8000-000000000001/files/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ValidToken user_without_team`)
        .send({ action: 'undelete' })
        .expect(403)
        .expect(expectError);
    });

    it('responds with a 403 for viewer trying to un-delete', async () => {
      await request(app)
        .patch('/v0/teams/00000000-0000-4000-8000-000000000001/files/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ValidToken team_1_viewer`)
        .send({ action: 'undelete' })
        .expect(403)
        .expect(expectError);
    });
  });

  describe('valid requests', () => {
    it('successfully un-deletes a file for team owner', async () => {
      const response = await request(app)
        .patch('/v0/teams/00000000-0000-4000-8000-000000000001/files/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .send({ action: 'undelete' })
        .expect(200);

      expect(response.body.message).toBe('File un-deleted successfully');
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

    it('successfully un-deletes a file for team editor', async () => {
      const response = await request(app)
        .patch('/v0/teams/00000000-0000-4000-8000-000000000001/files/00000000-0000-4000-8000-000000000001')
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .send({ action: 'undelete' })
        .expect(200);

      expect(response.body.message).toBe('File un-deleted successfully');
      expect(response.body.file.deleted).toBe(false);
    });
  });
});
