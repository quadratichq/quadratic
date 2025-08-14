import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb } from '../../tests/testDataGenerator';

const getInviteIdByEmail = async (email: string) => {
  const invite = await dbClient.teamInvite.findFirst({
    where: {
      email,
    },
  });
  if (!invite?.id) {
    throw new Error(`No invite found for email ${email}. This is a test error.`);
  }
  return invite.id;
};

beforeEach(async () => {
  const userOwner = await dbClient.user.create({
    data: {
      auth0Id: 'userOwner',
      email: 'userOwner@test.com',
    },
  });
  const userEditor = await dbClient.user.create({
    data: {
      auth0Id: 'userEditor',
      email: 'userEditor@test.com',
    },
  });
  const userViewer = await dbClient.user.create({
    data: {
      auth0Id: 'userViewer',
      email: 'userViewer@test.com',
    },
  });
  await dbClient.user.create({
    data: {
      auth0Id: 'userNoRole',
      email: 'userNoRole@test.com',
    },
  });
  await dbClient.team.create({
    data: {
      name: 'Team',
      uuid: '00000000-0000-4000-8000-000000000001',
      UserTeamRole: {
        create: [
          { userId: userOwner.id, role: 'OWNER' },
          { userId: userEditor.id, role: 'EDITOR' },
          { userId: userViewer.id, role: 'VIEWER' },
        ],
      },
      TeamInvite: {
        create: [
          {
            email: 'editor@example.com',
            role: 'EDITOR',
          },
        ],
      },
    },
  });
});

afterEach(clearDb);

describe('DELETE /v0/teams/:uuid/invites/:inviteId', () => {
  describe('sending a bad request', () => {
    it('responds with a 400 for sending a bad user', async () => {
      await request(app)
        .delete('/v0/teams/00000000-0000-4000-8000-000000000001/invites/foo')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(400)
        .expect(expectError);
    });
    it('responds with a 404 for an invite that doesn’t exist', async () => {
      await request(app)
        .delete('/v0/teams/00000000-0000-4000-8000-000000000001/invites/9999999')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(404)
        .expect(expectError);
    });
  });

  describe('deleting an invite', () => {
    it('responds with a 404 if you don’t belong to the team', async () => {
      const inviteId = await getInviteIdByEmail('editor@example.com');
      await request(app)
        .delete(`/v0/teams/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
        .set('Authorization', `Bearer ValidToken userNoRole`)
        .expect(403)
        .expect(expectError);
    });
    it('responds with a 403 if you belong to the team but don’t have permission to edit it', async () => {
      const inviteId = await getInviteIdByEmail('editor@example.com');
      await request(app)
        .delete(`/v0/teams/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect(403)
        .expect(expectError);
    });
    it('responds with a 200 if you belong to the team and have permission to edit', async () => {
      const inviteId = await getInviteIdByEmail('editor@example.com');
      await request(app)
        .delete(`/v0/teams/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect(200);
    });
  });
});
