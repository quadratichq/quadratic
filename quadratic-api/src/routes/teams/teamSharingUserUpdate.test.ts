import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeEach(async () => {
  // Create some users
  const user_1 = await dbClient.user.create({
    data: {
      auth0_id: 'test_user_1',
      id: 1,
    },
  });
  const user_2 = await dbClient.user.create({
    data: {
      auth0_id: 'test_user_2',
      id: 2,
    },
  });
  const user_3 = await dbClient.user.create({
    data: {
      auth0_id: 'test_user_3',
      id: 3,
    },
  });

  // Create a team with one owner and one with two
  await dbClient.team.create({
    data: {
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
      id: 1,
      UserTeamRole: {
        create: [
          {
            userId: user_1.id,
            role: 'OWNER',
          },
          { userId: user_2.id, role: 'EDITOR' },
          { userId: user_3.id, role: 'VIEWER' },
        ],
      },
    },
  });
  await dbClient.team.create({
    data: {
      name: 'Test Team 2',
      uuid: '00000000-0000-4000-8000-000000000002',
      id: 2,
      UserTeamRole: {
        create: [
          {
            userId: user_1.id,
            role: 'OWNER',
          },
          { userId: user_2.id, role: 'OWNER' },
        ],
      },
    },
  });
});

afterEach(async () => {
  const deleteTeamUsers = dbClient.userTeamRole.deleteMany();
  const deleteUsers = dbClient.user.deleteMany();
  const deleteTeams = dbClient.team.deleteMany();

  await dbClient.$transaction([deleteTeamUsers, deleteUsers, deleteTeams]);
});

// describe('POST /v0/teams/:uuid/sharing/:userId - unauthenticated requests', () => {
//   it('responds with a 401', async () => {
//     await request(app)
//       .delete('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/1')
//       .set('Accept', 'application/json')
//       .expect('Content-Type', /json/)
//       .expect(401);
//   });
// });

// TODO sending bad data

describe('POST /v0/teams/:uuid/sharing/:userId - update yourself as OWNER', () => {
  it('responds with 204 for OWNER -> OWNER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .send({ role: 'OWNER' })
      .expect(204);
  });

  it('rejects OWNER -> EDITOR if there’s only one OWNER on the team', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/1')
      .send({ role: 'EDITOR' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('changes OWNER -> EDITOR if there’s more than one OWNER on the team', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000002/sharing/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .send({ role: 'EDITOR' })
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(({ body: { role } }) => {
        expect(role).toBe('EDITOR');
      });
  });

  it('rejects OWNER -> VIEWER if there’s only one OWNER on the team', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/1')
      .send({ role: 'VIEWER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('changes OWNER -> VIEWER if there’s more than one OWNER on the team', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000002/sharing/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .send({ role: 'VIEWER' })
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(({ body: { role } }) => {
        expect(role).toBe('VIEWER');
      });
  });
});

describe('POST /v0/teams/:uuid/sharing/:userId - update yourself as EDITOR', () => {
  it('rejects EDITOR -> OWNER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/2')
      .send({
        role: 'OWNER',
      })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('responds with 204 for EDITOR -> EDITOR', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/2')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .send({ role: 'EDITOR' })
      .expect(204);
  });
  it('changes EDITOR -> VIEWER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/2')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .send({ role: 'VIEWER' })
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(({ body: { role } }) => {
        expect(role).toBe('VIEWER');
      });
  });
});

describe('POST /v0/teams/:uuid/sharing/:userId - update yourself as VIEWER', () => {
  it('rejects VIEWER -> OWNER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/3')
      .send({
        role: 'OWNER',
      })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('rejects VIEWER -> EDITOR', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/3')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .send({ role: 'EDITOR' })
      .expect(403);
  });
  it('responds with 204 for VIEWER -> VIEWER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/3')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .send({ role: 'VIEWER' })
      .expect(204);
  });
});

describe('POST /v0/teams/:uuid/sharing/:userId - update others as OWNER', () => {
  it('responds with 204 for OWNER -> OWNER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000002/sharing/2')
      .send({ role: 'OWNER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(204);
  });
  it('changes OWNER -> EDITOR', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000002/sharing/2')
      .send({ role: 'EDITOR' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(({ body: { role } }) => {
        expect(role).toBe('EDITOR');
      });
  });
  it('changes OWNER -> VIEWER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000002/sharing/2')
      .send({ role: 'VIEWER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(({ body: { role } }) => {
        expect(role).toBe('VIEWER');
      });
  });

  it('changes EDITOR -> OWNER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/2')
      .send({ role: 'OWNER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(({ body: { role } }) => {
        expect(role).toBe('OWNER');
      });
  });
  it('changes EDITOR -> VIEWER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/2')
      .send({ role: 'VIEWER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(({ body: { role } }) => {
        expect(role).toBe('VIEWER');
      });
  });
  it('responds with 204 for EDITOR -> EDITOR', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/2')
      .send({ role: 'EDITOR' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(204);
  });

  it('changes VIEWER -> OWNER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/3')
      .send({ role: 'OWNER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(({ body: { role } }) => {
        expect(role).toBe('OWNER');
      });
  });
  it('changes VIEWER -> EDITOR', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/3')
      .send({ role: 'EDITOR' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200)
      .expect(({ body: { role } }) => {
        expect(role).toBe('EDITOR');
      });
  });
  it('responds with a 204 for VIEWER -> VIEWER', async () => {
    await request(app)
      .post('/v0/teams/00000000-0000-4000-8000-000000000001/sharing/3')
      .send({ role: 'VIEWER' })
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect(204);
  });
});

// TODO trying to change a user that don't exist or exists but not part of the team
