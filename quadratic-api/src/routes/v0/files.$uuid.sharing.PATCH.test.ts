import request from 'supertest';
import { app } from '../../app';
import { clearDb, createFile, createTeam, createUser } from '../../tests/testDataGenerator';

beforeAll(async () => {
  const teamUser1 = await createUser({
    auth0Id: 'teamUser1',
  });
  const teamUser2 = await createUser({ auth0Id: 'teamUser2' });
  await createUser({ auth0Id: 'noTeamUser' });

  // Create a team
  const team = await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000000',
    },
    users: [
      { userId: teamUser1.id, role: 'OWNER' },
      { userId: teamUser2.id, role: 'EDITOR' },
    ],
  });

  // Team file
  await createFile({
    data: {
      creatorUserId: teamUser1.id,
      ownerTeamId: team.id,
      name: 'Public team file',
      uuid: '10000000-0000-4000-8000-000000000000',
    },
  });
  // Team file (with public link)
  await createFile({
    data: {
      creatorUserId: teamUser1.id,
      ownerTeamId: team.id,
      name: 'Public team file',
      uuid: '10000000-0000-4000-8000-000000000001',
      publicLinkAccess: 'EDIT',
    },
  });

  // Private team file (with 1 invite and 1 user)
  await createFile({
    data: {
      ownerTeamId: team.id,
      creatorUserId: teamUser1.id,
      ownerUserId: teamUser1.id,
      name: 'file-owned-by-user-1',
      uuid: '00000000-0000-4000-8000-000000000001',
      FileInvite: {
        create: {
          email: 'usernotinystemyet@example.com',
          role: 'EDITOR',
        },
      },
      UserFileRole: {
        create: {
          userId: teamUser2.id,
          role: 'EDITOR',
        },
      },
    },
  });
  // File you're invited to
  await createFile({
    data: {
      creatorUserId: teamUser2.id,
      ownerTeamId: team.id,
      ownerUserId: teamUser2.id,
      name: 'file-owned-by-user-2',
      uuid: '00000000-0000-4000-8000-000000000002',
      UserFileRole: {
        create: {
          userId: teamUser1.id,
          role: 'EDITOR',
        },
      },
    },
  });
  // Private file
  await createFile({
    data: {
      creatorUserId: teamUser2.id,
      ownerUserId: teamUser2.id,
      ownerTeamId: team.id,
      name: 'Test file',
      uuid: '00000000-0000-4000-8000-000000000003',
    },
  });
  await createFile({
    data: {
      creatorUserId: teamUser2.id,
      ownerTeamId: team.id,
      ownerUserId: teamUser2.id,
      name: 'Test file',
      uuid: '00000000-0000-4000-8000-000000000004',
      publicLinkAccess: 'EDIT',
    },
  });
});

afterAll(clearDb);

describe('PATCH /v0/files/:uuid/sharing', () => {
  describe('public team files', () => {
    it('lets a team member update a team file', async () => {
      await request(app)
        .patch('/v0/files/10000000-0000-4000-8000-000000000000/sharing')
        .send({ publicLinkAccess: 'READONLY' })
        .set('Authorization', `Bearer ValidToken teamUser1`)
        .expect(200)
        .expect((res) => {
          expect(res.body.publicLinkAccess).toEqual('READONLY');
        });
    });
    it('doesn’t let a non-team member update a team file', async () => {
      await request(app)
        .patch('/v0/files/10000000-0000-4000-8000-000000000000/sharing')
        .send({ publicLinkAccess: 'READONLY' })
        .set('Authorization', `Bearer ValidToken noTeamUser`)
        .expect(403);
    });
  });
  describe('private team files', () => {
    it('lets you update your own private file', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000001/sharing')
        .send({ publicLinkAccess: 'READONLY' })
        .set('Authorization', `Bearer ValidToken teamUser1`)
        .expect(200)
        .expect((res) => {
          expect(res.body.publicLinkAccess).toEqual('READONLY');
        });
    });
    it('lets you update a file you belong to', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000002/sharing')
        .send({ publicLinkAccess: 'EDIT' })
        .set('Authorization', `Bearer ValidToken teamUser1`)
        .expect(200)
        .expect((res) => {
          expect(res.body.publicLinkAccess).toEqual('EDIT');
        });
    });
    it('doesn’t let you update someone else’s private file', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000003/sharing')
        .send({ publicLinkAccess: 'EDIT' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ValidToken teamUser1`)
        .expect('Content-Type', /json/)
        .expect(403);
    });
    it('lets you update the public link on someone else’s publicly-editable file, but after that you can’t change it again', async () => {
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000004/sharing')
        .send({ publicLinkAccess: 'READONLY' })
        .set('Authorization', `Bearer ValidToken teamUser1`)
        .expect(200)
        .expect((res) => {
          expect(res.body.publicLinkAccess).toEqual('READONLY');
        });
      // You changed it to READONLY so you can't change it again
      await request(app)
        .patch('/v0/files/00000000-0000-4000-8000-000000000004/sharing')
        .send({ publicLinkAccess: 'EDIT' })
        .set('Authorization', `Bearer ValidToken teamUser1`)
        .expect(403);
    });
  });
});
