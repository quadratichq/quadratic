import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createTeam, createUser, upgradeTeamToBusiness } from '../../tests/testDataGenerator';

const teamUuid = '00000000-0000-0000-0000-000000000020';

let ownerId: number;
let editorId: number;
let viewerId: number;
let teamId: number;

beforeEach(async () => {
  ownerId = (await createUser({ auth0Id: 'budget-owner' })).id;
  editorId = (await createUser({ auth0Id: 'budget-editor' })).id;
  viewerId = (await createUser({ auth0Id: 'budget-viewer' })).id;
  const team = await createTeam({
    team: { uuid: teamUuid },
    users: [
      { userId: ownerId, role: 'OWNER' },
      { userId: editorId, role: 'EDITOR' },
      { userId: viewerId, role: 'VIEWER' },
    ],
  });
  teamId = team.id;
  await upgradeTeamToBusiness(teamId);
});

afterEach(clearDb);

describe('PATCH /v0/teams/:uuid/billing/budget', () => {
  it('responds with 401 when not authenticated', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/budget`)
      .send({ teamMonthlyBudgetLimit: 100 })
      .set('Authorization', 'Bearer InvalidToken budget-owner')
      .expect(401);
  });

  it('responds with 403 when user is a viewer', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/budget`)
      .send({ teamMonthlyBudgetLimit: 100 })
      .set('Authorization', 'Bearer ValidToken budget-viewer')
      .expect(403);
  });

  it('responds with 200 when user is an editor', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/budget`)
      .send({ teamMonthlyBudgetLimit: 100 })
      .set('Authorization', 'Bearer ValidToken budget-editor')
      .expect(200)
      .expect(({ body }) => {
        expect(body.teamMonthlyBudgetLimit).toBe(100);
      });
  });

  it('sets team monthly budget limit', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/budget`)
      .send({ teamMonthlyBudgetLimit: 50.5 })
      .set('Authorization', 'Bearer ValidToken budget-owner')
      .expect(200)
      .expect(({ body }) => {
        expect(body.teamMonthlyBudgetLimit).toBe(50.5);
      });

    const team = await dbClient.team.findUnique({ where: { uuid: teamUuid } });
    expect(team?.teamMonthlyBudgetLimit).toBe(50.5);
  });

  it('removes team monthly budget limit when set to null', async () => {
    await dbClient.team.update({
      where: { uuid: teamUuid },
      data: { teamMonthlyBudgetLimit: 100 },
    });

    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/budget`)
      .send({ teamMonthlyBudgetLimit: null })
      .set('Authorization', 'Bearer ValidToken budget-owner')
      .expect(200)
      .expect(({ body }) => {
        expect(body.teamMonthlyBudgetLimit).toBeNull();
      });

    const team = await dbClient.team.findUnique({ where: { uuid: teamUuid } });
    expect(team?.teamMonthlyBudgetLimit).toBeNull();
  });

  it('responds with 400 for non-business plan', async () => {
    await dbClient.team.update({
      where: { uuid: teamUuid },
      data: { planType: 'PRO' },
    });

    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/budget`)
      .send({ teamMonthlyBudgetLimit: 100 })
      .set('Authorization', 'Bearer ValidToken budget-owner')
      .expect(400);
  });

  it('rejects negative budget limits', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/budget`)
      .send({ teamMonthlyBudgetLimit: -10 })
      .set('Authorization', 'Bearer ValidToken budget-owner')
      .expect(400);
  });

  it('rejects zero budget limits', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/budget`)
      .send({ teamMonthlyBudgetLimit: 0 })
      .set('Authorization', 'Bearer ValidToken budget-owner')
      .expect(400);
  });
});
