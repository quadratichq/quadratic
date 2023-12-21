import { UserRoleFile } from 'quadratic-shared/typesAndSchemas';
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
      publicLinkAccess: 'NOT_SHARED',
      // UserFileRole: {
      //   create: [
      //     { userId: user2.id, role: 'EDITOR' },
      //     { userId: user3.id, role: 'VIEWER' },
      //   ],
      // },
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

const test = (
  userMakingChange: 'user1' | 'user2' | 'user3',
  expectation: 'changes' | 'accepts' | 'rejects',
  fromRole: UserRoleFile,
  toRole: UserRoleFile
) => {
  it(`${expectation} ${fromRole} to ${toRole}`, async () => {
    const userToChange = fromRole === 'OWNER' ? 'user1' : fromRole === 'EDITOR' ? 'user2' : 'user3';
    const userId = await getUserIdByAuth0Id(userToChange);
    await request(app)
      .patch(`/v0/files/00000000-0000-4000-8000-000000000001/users/${userId}`)
      .send({ role: toRole })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken ${userMakingChange}`)
      .expect((res) => {
        if (expectation === 'changes' || expectation === 'accepts') {
          expect(res.status).toBe(200);
          expect(res.body.role).toBe(toRole);
        } else if (expectation === 'rejects') {
          expect(res.status).toBe(403);
        }
      });
  });
};

describe.only('PATCH /v0/files/:uuid/users/:userId', () => {
  describe('🔒 Private user file with 3 members', () => {
    beforeEach(async () => {
      const user2Id = await getUserIdByAuth0Id('user2');
      const user3Id = await getUserIdByAuth0Id('user3');
      await dbClient.file.update({
        data: {
          UserFileRole: {
            create: [
              { userId: user2Id, role: 'EDITOR' },
              { userId: user3Id, role: 'VIEWER' },
            ],
          },
        },
        where: {
          uuid: '00000000-0000-4000-8000-000000000001',
        },
        select: {
          UserFileRole: {},
        },
      });
    });
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
        test('user2', 'rejects', 'EDITOR', 'OWNER');
        test('user2', 'accepts', 'EDITOR', 'EDITOR');
        test('user2', 'changes', 'EDITOR', 'VIEWER');
      });
      describe('as file VIEWER', () => {
        test('user3', 'rejects', 'VIEWER', 'OWNER');
        test('user3', 'rejects', 'VIEWER', 'EDITOR');
        test('user3', 'accepts', 'VIEWER', 'VIEWER');
      });
    });
  });
  describe('👁️ Public user file (READONLY) with 0 members', () => {
    describe('Update yourself', () => {
      describe('as file OWNER', () => {
        test('user1', 'accepts', 'OWNER', 'OWNER');
        test('user1', 'rejects', 'OWNER', 'EDITOR');
        test('user1', 'rejects', 'OWNER', 'VIEWER');
      });
      describe('as file EDITOR', () => {
        test('user2', 'rejects', 'EDITOR', 'OWNER');
        test('user2', 'rejects', 'EDITOR', 'EDITOR');
        test('user2', 'rejects', 'EDITOR', 'VIEWER');
      });
      describe('as file VIEWER', () => {
        test('user2', 'rejects', 'VIEWER', 'OWNER');
        test('user2', 'rejects', 'VIEWER', 'EDITOR');
        test('user2', 'rejects', 'VIEWER', 'VIEWER');
      });
    });
  });
  describe('📝 Public user file (EDIT) with 3 members', () => {
    it.todo('TODO');
  });
  describe('🔒 Private team file', () => {
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
  describe('👁️ Public team file (READONLY)', () => {
    it.todo('TODO');
  });
  describe('📝 Public team file (EDIT)', () => {
    it.todo('TODO');
  });

  // TODO trying to change a user that don't exist or exists but not part of the team
});
