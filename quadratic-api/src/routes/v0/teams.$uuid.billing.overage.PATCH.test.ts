import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createTeam, createUser, upgradeTeamToBusiness } from '../../tests/testDataGenerator';

const teamUuid = '00000000-0000-0000-0000-000000000010';

let ownerId: number;
let editorId: number;
let viewerId: number;
let teamId: number;

beforeEach(async () => {
  ownerId = (await createUser({ auth0Id: 'overage-owner' })).id;
  editorId = (await createUser({ auth0Id: 'overage-editor' })).id;
  viewerId = (await createUser({ auth0Id: 'overage-viewer' })).id;
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

describe('PATCH /v0/teams/:uuid/billing/overage', () => {
  it('responds with 401 when not authenticated', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/overage`)
      .send({ allowOveragePayments: true })
      .set('Authorization', 'Bearer InvalidToken overage-owner')
      .expect(401);
  });

  it('responds with 403 when user is a viewer', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/overage`)
      .send({ allowOveragePayments: true })
      .set('Authorization', 'Bearer ValidToken overage-viewer')
      .expect(403);
  });

  it('responds with 200 when user is an editor', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/overage`)
      .send({ allowOveragePayments: true })
      .set('Authorization', 'Bearer ValidToken overage-editor')
      .expect(200)
      .expect(({ body }) => {
        expect(body.allowOveragePayments).toBe(true);
      });
  });

  it('responds with 200 when user is an owner', async () => {
    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/overage`)
      .send({ allowOveragePayments: true })
      .set('Authorization', 'Bearer ValidToken overage-owner')
      .expect(200)
      .expect(({ body }) => {
        expect(body.allowOveragePayments).toBe(true);
      });

    const team = await dbClient.team.findUnique({ where: { uuid: teamUuid } });
    expect(team?.allowOveragePayments).toBe(true);
  });

  it('responds with 400 for non-business plan', async () => {
    await dbClient.team.update({
      where: { uuid: teamUuid },
      data: { planType: 'PRO' },
    });

    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/overage`)
      .send({ allowOveragePayments: true })
      .set('Authorization', 'Bearer ValidToken overage-owner')
      .expect(400);
  });

  it('can disable overage payments', async () => {
    await dbClient.team.update({
      where: { uuid: teamUuid },
      data: { allowOveragePayments: true, stripeOverageItemId: 'si_existing' },
    });

    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/overage`)
      .send({ allowOveragePayments: false })
      .set('Authorization', 'Bearer ValidToken overage-owner')
      .expect(200)
      .expect(({ body }) => {
        expect(body.allowOveragePayments).toBe(false);
      });

    const team = await dbClient.team.findUnique({ where: { uuid: teamUuid } });
    expect(team?.allowOveragePayments).toBe(false);
  });

  it('responds with 403 for user not in team', async () => {
    await createUser({ auth0Id: 'overage-outsider' });

    await request(app)
      .patch(`/v0/teams/${teamUuid}/billing/overage`)
      .send({ allowOveragePayments: true })
      .set('Authorization', 'Bearer ValidToken overage-outsider')
      .expect(403);
  });
});
