import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createTeam, createUser, upgradeTeamToBusiness } from '../../tests/testDataGenerator';

const teamUuid = '00000000-0000-0000-0000-000000000030';

let ownerId: number;
let editorId: number;
let viewerId: number;
let memberId: number;
let teamId: number;

beforeEach(async () => {
  ownerId = (await createUser({ auth0Id: 'user-budget-owner' })).id;
  editorId = (await createUser({ auth0Id: 'user-budget-editor' })).id;
  viewerId = (await createUser({ auth0Id: 'user-budget-viewer' })).id;
  memberId = (await createUser({ auth0Id: 'user-budget-member' })).id;
  const team = await createTeam({
    team: { uuid: teamUuid },
    users: [
      { userId: ownerId, role: 'OWNER' },
      { userId: editorId, role: 'EDITOR' },
      { userId: viewerId, role: 'VIEWER' },
      { userId: memberId, role: 'EDITOR' },
    ],
  });
  teamId = team.id;
  await upgradeTeamToBusiness(teamId);
});

afterEach(clearDb);

describe('PATCH /v0/teams/:uuid/users/:userId/budget', () => {
  it('responds with 401 when not authenticated', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/users/${memberId}/budget`)
      .send({ monthlyBudgetLimit: 25 })
      .set('Authorization', 'Bearer InvalidToken user-budget-owner')
      .expect(401);
  });

  it('responds with 403 when user is a viewer', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/users/${memberId}/budget`)
      .send({ monthlyBudgetLimit: 25 })
      .set('Authorization', 'Bearer ValidToken user-budget-viewer')
      .expect(403);
  });

  it('responds with 200 when user is an editor', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/users/${memberId}/budget`)
      .send({ monthlyBudgetLimit: 25 })
      .set('Authorization', 'Bearer ValidToken user-budget-editor')
      .expect(200)
      .expect(({ body }) => {
        expect(body.monthlyBudgetLimit).toBe(25);
      });
  });

  it('sets a user budget limit', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/users/${memberId}/budget`)
      .send({ monthlyBudgetLimit: 30 })
      .set('Authorization', 'Bearer ValidToken user-budget-owner')
      .expect(200)
      .expect(({ body }) => {
        expect(body.monthlyBudgetLimit).toBe(30);
      });

    const limit = await dbClient.userBudgetLimit.findUnique({
      where: { userId_teamId: { userId: memberId, teamId } },
    });
    expect(limit?.monthlyBudgetLimit).toBe(30);
  });

  it('updates an existing user budget limit', async () => {
    await dbClient.userBudgetLimit.create({
      data: { userId: memberId, teamId, monthlyBudgetLimit: 10 },
    });

    await request(app)
      .patch(`/v0/teams/${teamUuid}/users/${memberId}/budget`)
      .send({ monthlyBudgetLimit: 50 })
      .set('Authorization', 'Bearer ValidToken user-budget-owner')
      .expect(200)
      .expect(({ body }) => {
        expect(body.monthlyBudgetLimit).toBe(50);
      });

    const limit = await dbClient.userBudgetLimit.findUnique({
      where: { userId_teamId: { userId: memberId, teamId } },
    });
    expect(limit?.monthlyBudgetLimit).toBe(50);
  });

  it('removes a user budget limit when set to null', async () => {
    await dbClient.userBudgetLimit.create({
      data: { userId: memberId, teamId, monthlyBudgetLimit: 10 },
    });

    await request(app)
      .patch(`/v0/teams/${teamUuid}/users/${memberId}/budget`)
      .send({ monthlyBudgetLimit: null })
      .set('Authorization', 'Bearer ValidToken user-budget-owner')
      .expect(200)
      .expect(({ body }) => {
        expect(body.monthlyBudgetLimit).toBeNull();
      });

    const limit = await dbClient.userBudgetLimit.findUnique({
      where: { userId_teamId: { userId: memberId, teamId } },
    });
    expect(limit).toBeNull();
  });

  it('responds with 404 when target user is not in the team', async () => {
    const outsider = await createUser({ auth0Id: 'user-budget-outsider' });

    await request(app)
      .patch(`/v0/teams/${teamUuid}/users/${outsider.id}/budget`)
      .send({ monthlyBudgetLimit: 25 })
      .set('Authorization', 'Bearer ValidToken user-budget-owner')
      .expect(404);
  });

  it('responds with 400 for non-business plan', async () => {
    await dbClient.team.update({
      where: { uuid: teamUuid },
      data: { planType: 'PRO' },
    });

    await request(app)
      .patch(`/v0/teams/${teamUuid}/users/${memberId}/budget`)
      .send({ monthlyBudgetLimit: 25 })
      .set('Authorization', 'Bearer ValidToken user-budget-owner')
      .expect(400);
  });

  it('rejects negative budget limits', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/users/${memberId}/budget`)
      .send({ monthlyBudgetLimit: -5 })
      .set('Authorization', 'Bearer ValidToken user-budget-owner')
      .expect(400);
  });
});
