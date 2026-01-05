import type { LinkPermission } from '@prisma/client';
import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import { clearDb, createFile, createTeam, createUser } from '../../tests/testDataGenerator';

const getInviteIdByEmail = async (email: string) => {
  const invite = await dbClient.fileInvite.findFirst({
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
  const userOwner = await createUser({
    auth0Id: 'userOwner',
  });
  const userEditor = await createUser({
    auth0Id: 'userEditor',
  });
  const userViewer = await createUser({
    auth0Id: 'userViewer',
  });
  await createUser({
    auth0Id: 'userNoRole',
  });

  const team = await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000000',
    },
    users: [{ userId: userOwner.id, role: 'OWNER' }],
  });

  await createFile({
    data: {
      creatorUserId: userOwner.id,
      ownerTeamId: team.id,
      version: '1.4',
      name: 'Personal File',
      uuid: '00000000-0000-4000-8000-000000000001',
      publicLinkAccess: 'NOT_SHARED',
      UserFileRole: {
        create: [
          { userId: userEditor.id, role: 'EDITOR' },
          { userId: userViewer.id, role: 'VIEWER' },
        ],
      },
      FileInvite: {
        create: [
          {
            email: 'fileeditor@test.com',
            role: 'EDITOR',
          },
          {
            email: 'fileviewer@test.com',
            role: 'VIEWER',
          },
        ],
      },
    },
  });
});

afterEach(clearDb);

describe('DELETE /v0/files/:uuid/invites/:inviteId', () => {
  describe('sending a bad request', () => {
    it('responds with a 400 for sending a bad user', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000001/invites/foo')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
    it('responds with a 404 for an invite that doesn’t exist', async () => {
      await request(app)
        .delete('/v0/files/00000000-0000-4000-8000-000000000001/invites/9999999')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(404)
        .expect(expectError);
    });
  });

  describe('deleting an invite', () => {
    describe('when the file is in a team you belong to', () => {
      it('responds with a 200 to delete an EDITOR invite', async () => {
        const inviteId = await getInviteIdByEmail('fileeditor@test.com');
        await request(app)
          .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ValidToken userOwner`)
          .expect('Content-Type', /json/)
          .expect(200);
      });
      it('responds with a 200 to delete a VIEWER invite', async () => {
        const inviteId = await getInviteIdByEmail('fileviewer@test.com');
        await request(app)
          .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ValidToken userOwner`)
          .expect('Content-Type', /json/)
          .expect(200);
      });
    });

    describe('when the file is not in a team you belong to, but you have access via an invite to the file', () => {
      // Test results should be identical if file is NOT_SHARED or READONLY
      const access = ['NOT_SHARED', 'READONLY'] as LinkPermission[];
      for (const publicLinkAccess of access) {
        describe(`public link is ${publicLinkAccess}`, () => {
          beforeEach(async () => {
            await dbClient.file.update({
              where: {
                uuid: '00000000-0000-4000-8000-000000000001',
              },
              data: {
                publicLinkAccess,
              },
            });
          });
          it('responds with a 200 for you as an EDITOR to delete an EDITOR invite', async () => {
            const inviteId = await getInviteIdByEmail('fileeditor@test.com');
            await request(app)
              .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ValidToken userEditor`)
              .expect('Content-Type', /json/)
              .expect(200);
          });
          it('responds with a 200 for an EDITOR to delete a VIEWER invite', async () => {
            const inviteId = await getInviteIdByEmail('fileviewer@test.com');
            await request(app)
              .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ValidToken userEditor`)
              .expect('Content-Type', /json/)
              .expect(200);
          });
          it('responds with a 403 for a VIEWER to delete an EDITOR invite', async () => {
            const inviteId = await getInviteIdByEmail('fileeditor@test.com');
            await request(app)
              .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ValidToken userViewer`)
              .expect('Content-Type', /json/)
              .expect(403);
          });
          it('responds with a 403 for a VIEWER to delete a VIEWER invite', async () => {
            const inviteId = await getInviteIdByEmail('fileviewer@test.com');
            await request(app)
              .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ValidToken userViewer`)
              .expect('Content-Type', /json/)
              .expect(403);
          });
          it('responds with a 403 for a user without a file role to delete an EDITOR invite', async () => {
            const inviteId = await getInviteIdByEmail('fileeditor@test.com');
            await request(app)
              .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ValidToken userNoRole`)
              .expect('Content-Type', /json/)
              .expect(403);
          });
          it('responds with a 403 for a user without a file role to delete a VIEWER invite', async () => {
            const inviteId = await getInviteIdByEmail('fileviewer@test.com');
            await request(app)
              .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ValidToken userNoRole`)
              .expect('Content-Type', /json/)
              .expect(403);
          });
        });
      }

      describe('public link is EDIT', () => {
        beforeEach(async () => {
          await dbClient.file.update({
            where: {
              uuid: '00000000-0000-4000-8000-000000000001',
            },
            data: {
              publicLinkAccess: 'EDIT',
            },
          });
        });
        it('responds with a 200 for you as an EDITOR to delete an EDITOR invite', async () => {
          const inviteId = await getInviteIdByEmail('fileeditor@test.com');
          await request(app)
            .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken userEditor`)
            .expect('Content-Type', /json/)
            .expect(200);
        });
        it('responds with a 200 for an EDITOR to delete a VIEWER invite', async () => {
          const inviteId = await getInviteIdByEmail('fileviewer@test.com');
          await request(app)
            .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken userEditor`)
            .expect('Content-Type', /json/)
            .expect(200);
        });
        it('responds with a 200 for a VIEWER to delete an EDITOR invite', async () => {
          const inviteId = await getInviteIdByEmail('fileeditor@test.com');
          await request(app)
            .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken userViewer`)
            .expect('Content-Type', /json/)
            .expect(200);
        });
        it('responds with a 200 for a VIEWER to delete a VIEWER invite', async () => {
          const inviteId = await getInviteIdByEmail('fileviewer@test.com');
          await request(app)
            .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken userViewer`)
            .expect('Content-Type', /json/)
            .expect(200);
        });
        it('responds with a 200 for a user without a file role to delete an EDITOR invite', async () => {
          const inviteId = await getInviteIdByEmail('fileeditor@test.com');
          await request(app)
            .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken userNoRole`)
            .expect('Content-Type', /json/)
            .expect(200);
        });
        it('responds with a 200 for a user without a file role to delete a VIEWER invite', async () => {
          const inviteId = await getInviteIdByEmail('fileviewer@test.com');
          await request(app)
            .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken userNoRole`)
            .expect('Content-Type', /json/)
            .expect(200);
        });
      });
    });
  });

  describe('soft delete behavior', () => {
    it('sets status to DELETED instead of removing the record', async () => {
      const inviteId = await getInviteIdByEmail('fileeditor@test.com');
      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(200);

      // Invite should still exist with DELETED status
      const invite = await dbClient.fileInvite.findUnique({
        where: { id: inviteId },
      });
      expect(invite).not.toBeNull();
      expect(invite?.status).toBe('DELETED');
    });

    it('rejects deleting an already deleted invite with 400', async () => {
      const inviteId = await getInviteIdByEmail('fileeditor@test.com');
      // Soft delete it first
      await dbClient.fileInvite.update({
        where: { id: inviteId },
        data: { status: 'DELETED' },
      });

      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });

    it('rejects deleting an accepted invite with 400', async () => {
      const inviteId = await getInviteIdByEmail('fileeditor@test.com');
      await dbClient.fileInvite.update({
        where: { id: inviteId },
        data: { status: 'ACCEPTED' },
      });

      await request(app)
        .delete(`/v0/files/00000000-0000-4000-8000-000000000001/invites/${inviteId}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect('Content-Type', /json/)
        .expect(400)
        .expect(expectError);
    });
  });
});
