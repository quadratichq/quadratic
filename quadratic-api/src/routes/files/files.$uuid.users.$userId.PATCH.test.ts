import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

async function getUserIdByAuth0Id(id: string) {
  const user = await dbClient.user.findFirst({
    where: {
      auth0_id: id,
    },
  });
  if (!user) throw new Error('User not found');
  return user.id;
}

beforeEach(async () => {
  // Create some users
  const user1 = await dbClient.user.create({
    data: {
      auth0_id: 'user1',
    },
  });
  const user2 = await dbClient.user.create({
    data: {
      auth0_id: 'user2',
    },
  });
  const user3 = await dbClient.user.create({
    data: {
      auth0_id: 'user3',
    },
  });

  // Create a file with an owner, editor, and viewer
  await dbClient.file.create({
    data: {
      ownerUserId: user1.id,
      contents: Buffer.from('contents_0'),
      version: '1.4',
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
      UserFileRole: {
        create: [
          { userId: user2.id, role: 'EDITOR' },
          { userId: user3.id, role: 'VIEWER' },
        ],
      },
    },
  });
});

afterEach(async () => {
  const deleteFileUsers = dbClient.userFileRole.deleteMany();
  const deleteFiles = dbClient.file.deleteMany();
  const deleteUsers = dbClient.user.deleteMany();

  await dbClient.$transaction([deleteFileUsers, deleteFiles, deleteUsers]);
});

// describe('POST /v0/teams/:uuid/users/:userId - unauthenticated requests', () => {
//   it('responds with a 401', async () => {
//     await request(app)
//       .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/1')
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(401);
//   });
// });

// TODO sending bad data

describe('PATCH /v0/files/:uuid/users/:userId', () => {
  describe('🔒 Private file', () => {
    describe('Update yourself', () => {
      describe('as file OWNER', () => {
        it('accepts OWNER -> OWNER', async () => {
          const id = await getUserIdByAuth0Id('user1');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user1`)
            .send({ role: 'OWNER' })
            .expect(200)
            .expect(({ body: { role } }) => {
              expect(role).toBe('OWNER');
            });
        });

        it('rejects OWNER -> EDITOR', async () => {
          const id = await getUserIdByAuth0Id('user1');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${id}`)
            .send({ role: 'EDITOR' })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user1`)
            .expect('Content-Type', /json/)
            .expect(403);
        });

        it('rejects OWNER -> VIEWER', async () => {
          const id = await getUserIdByAuth0Id('user1');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${id}`)
            .send({ role: 'VIEWER' })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user1`)
            .expect('Content-Type', /json/)
            .expect(403);
        });
      });
      describe('as file EDITOR', () => {
        it('rejects EDITOR -> OWNER', async () => {
          const userId = await getUserIdByAuth0Id('user2');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .send({ role: 'OWNER' })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user2`)
            .expect('Content-Type', /json/)
            .expect(403);
        });
        it('accepts EDITOR -> EDITOR', async () => {
          const userId = await getUserIdByAuth0Id('user2');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user2`)
            .send({ role: 'EDITOR' })
            .expect(200)
            .expect(({ body: { role } }) => {
              expect(role).toBe('EDITOR');
            });
        });
        it('changes EDITOR -> VIEWER', async () => {
          const userId = await getUserIdByAuth0Id('user2');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user2`)
            .send({ role: 'VIEWER' })
            .expect('Content-Type', /json/)
            .expect(200)
            .expect(({ body: { role } }) => {
              expect(role).toBe('VIEWER');
            });
        });
      });
      describe('as file VIEWER', () => {
        it('rejects VIEWER -> OWNER', async () => {
          const userId = await getUserIdByAuth0Id('user3');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .send({ role: 'OWNER' })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user3`)
            .expect('Content-Type', /json/)
            .expect(403);
        });
        it('rejects VIEWER -> EDITOR', async () => {
          const userId = await getUserIdByAuth0Id('user3');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user3`)
            .send({ role: 'EDITOR' })
            .expect(403);
        });
        it('accepts VIEWER -> VIEWER', async () => {
          const userId = await getUserIdByAuth0Id('user3');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user3`)
            .send({ role: 'VIEWER' })
            .expect(200)
            .expect(({ body: { role } }) => {
              expect(role).toBe('VIEWER');
            });
        });
      });
    });
    describe('Update others', () => {
      describe('as file OWNER', () => {
        // There shouldn't be more than 1 owner ever, so we don't test updating other owners

        it('rejects EDITOR -> OWNER', async () => {
          const userId = await getUserIdByAuth0Id('user2');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .send({ role: 'OWNER' })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user1`)
            .expect(403);
        });
        it('accepts EDITOR -> EDITOR', async () => {
          const userId = await getUserIdByAuth0Id('user2');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .send({ role: 'EDITOR' })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user1`)
            .expect(200)
            .expect(({ body: { role } }) => {
              expect(role).toBe('EDITOR');
            });
        });
        it('accepts EDITOR -> VIEWER', async () => {
          const userId = await getUserIdByAuth0Id('user2');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .send({ role: 'VIEWER' })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user1`)
            .expect(200)
            .expect(({ body: { role } }) => {
              expect(role).toBe('VIEWER');
            });
        });

        it('rejects VIEWER -> OWNER', async () => {
          const userId = await getUserIdByAuth0Id('user3');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .send({ role: 'OWNER' })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user1`)
            .expect(403);
        });
        it('changes VIEWER -> EDITOR', async () => {
          const userId = await getUserIdByAuth0Id('user3');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .send({ role: 'EDITOR' })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user1`)
            .expect(200)
            .expect(({ body: { role } }) => {
              expect(role).toBe('EDITOR');
            });
        });
        it('accepts VIEWER -> VIEWER', async () => {
          const userId = await getUserIdByAuth0Id('user3');
          await request(app)
            .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
            .send({ role: 'VIEWER' })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ValidToken user1`)
            .expect(200)
            .expect(({ body: { role } }) => {
              expect(role).toBe('VIEWER');
            });
        });
      });
      describe('as file EDITOR', () => {
        it.todo('rejects EDITOR -> OWNER');
        it.todo('accepts EDITOR -> EDITOR');
        it.todo('changes EDITOR -> VIEWER');
      });
      describe('as file VIEWER', () => {
        it.todo('rejects VIEWER -> OWNER');
        it.todo('rejects VIEWER -> EDITOR');
        it.todo('accepts EDITOR -> VIEWER');
      });
    });
  });
  describe('👁️ Public file READONLY', () => {
    it.todo('TODO');
  });
  describe('📝 Public file EDIT', () => {
    it.todo('TODO');
  });
  describe('👩‍👧 Team file', () => {
    describe('Update yourself', () => {
      describe('as team OWNER', () => {
        // what do we do if you try to add yourself to a file that you already get access to via a team?
        it.todo('TODO');
      });
      describe('as team EDITOR', () => {
        it.todo('TODO');
      });
      describe('as team VIEWER', () => {
        it.todo('TODO');
      });
    });
    describe('Update others', () => {
      describe('as team OWNER', () => {
        it.todo('rejects OWNER -> OWNER');
      });
      describe('as team EDITOR', () => {
        it.todo('TODO');
      });
      describe('as team VIEWER', () => {
        it.todo('TODO');
      });
    });
  });

  // TODO trying to change a user that don't exist or exists but not part of the team
});
