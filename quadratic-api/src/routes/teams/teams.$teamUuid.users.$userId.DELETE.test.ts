import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';

beforeEach(async () => {
  // Create some users
  const user_1 = await dbClient.user.upsert({
    create: {
      auth0Id: 'test_user_1',
      id: 1,
    },
    update: {},
    where: {
      id: 1,
    },
  });
  const user_2 = await dbClient.user.upsert({
    create: {
      auth0Id: 'test_user_2',
      id: 2,
    },
    update: {},
    where: {
      id: 2,
    },
  });
  const user_3 = await dbClient.user.upsert({
    create: {
      auth0Id: 'test_user_3',
      id: 3,
    },
    update: {},
    where: {
      id: 3,
    },
  });
  const user_4 = await dbClient.user.upsert({
    create: {
      auth0Id: 'test_user_4',
      id: 4,
    },
    update: {},
    where: {
      id: 4,
    },
  });
  const user_5 = await dbClient.user.upsert({
    create: {
      auth0Id: 'test_user_5',
      id: 5,
    },
    update: {},
    where: {
      id: 5,
    },
  });
  const user_6 = await dbClient.user.upsert({
    create: {
      auth0Id: 'test_user_6',
      id: 6,
    },
    update: {},
    where: {
      id: 6,
    },
  });

  // Create a team with one owner
  await dbClient.team.create({
    data: {
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
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
  // Create a team with 2 owners
  await dbClient.team.create({
    data: {
      name: 'Test Team 2',
      uuid: '00000000-0000-4000-8000-000000000002',
      UserTeamRole: {
        create: [
          {
            userId: user_1.id,
            role: 'OWNER',
          },
          { userId: user_2.id, role: 'OWNER' },
          { userId: user_3.id, role: 'EDITOR' },
          { userId: user_4.id, role: 'EDITOR' },
          { userId: user_5.id, role: 'VIEWER' },
          { userId: user_6.id, role: 'VIEWER' },
        ],
      },
    },
  });
  // Create a team nobody has access to except 1
});

afterEach(async () => {
  const deleteTeamUsers = dbClient.userTeamRole.deleteMany();
  const deleteUsers = dbClient.user.deleteMany();
  const deleteTeams = dbClient.team.deleteMany();

  await dbClient.$transaction([deleteTeamUsers, deleteUsers, deleteTeams]);
});

describe('DELETE /v0/teams/:uuid/users/:userId - unauthenticated requests', () => {
  it('responds with a 401', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/1')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(401);
  });
});

// TODO move to a teamSharing middleware?
describe('DELETE /v0/teams/:uuid/users/:userId - invalid user', () => {
  it('responds with a 404 for a valid user that doesn’t exist', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/245')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(404);
  });
  it('responds with a 400 for an invalid user', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/foo')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(400);
  });
});

describe('DELETE /v0/teams/:uuid/users/:userId - deleting yourself', () => {
  it('allows viewers to remove themselves from a team', async () => {
    await request(app)
      .delete(`/v0/teams/00000000-0000-4000-8000-000000000001/users/3`)
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('allows editors to remove themselves from a team', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/2')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_2`)
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('allows owners to remove themselves from a team IF there’s at least one other owner', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000002/users/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('does not allow owners to remove themselves from a team IF they’re the only one', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
});

describe('DELETE /v0/teams/:uuid/users/:userId - deleteing others as an owner', () => {
  it('allows owners to remove other owners', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000002/users/2')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('allows owners to remove editors', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/2')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('allows owners to remove viewers', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000001/users/3')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_1`)
      .expect('Content-Type', /json/)
      .expect(200);
  });
});

describe('DELETE /v0/teams/:uuid/users/:userId - deleteing others as an editor', () => {
  it('doesn’t allow editors to remove owners', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000002/users/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('allows editors to remove other editors', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000002/users/4')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('allows editors to remove viewers', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000002/users/5')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_3`)
      .expect('Content-Type', /json/)
      .expect(200);
  });
});

describe('DELETE /v0/teams/:uuid/users/:userId - deleteing others as a viewer', () => {
  it('doesn’t allow viewers to remove owners', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000002/users/1')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_5`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('doesn’t allow viewers to remove editors', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000002/users/3')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_5`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
  it('doesn’t allow viewers to remove other viewers', async () => {
    await request(app)
      .delete('/v0/teams/00000000-0000-4000-8000-000000000002/users/6')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ValidToken test_user_5`)
      .expect('Content-Type', /json/)
      .expect(403);
  });
});
