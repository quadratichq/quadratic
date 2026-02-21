import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { expectError } from '../../tests/helpers';
import {
  clearDb,
  createTeam,
  createUser,
  upgradeTeamToBusiness,
  upgradeTeamToPro,
} from '../../tests/testDataGenerator';

const teamUuid = '00000000-0000-0000-0000-000000000060';
const redirectSuccess = 'http://localhost:3000/success';
const redirectCancel = 'http://localhost:3000/cancel';

function endpoint(plan = 'pro') {
  return `/v0/teams/${teamUuid}/billing/checkout/session?redirect-success=${encodeURIComponent(redirectSuccess)}&redirect-cancel=${encodeURIComponent(redirectCancel)}&plan=${plan}`;
}

let ownerId: number;
let editorId: number;
let teamId: number;

beforeEach(async () => {
  ownerId = (await createUser({ auth0Id: 'checkoutOwner' })).id;
  editorId = (await createUser({ auth0Id: 'checkoutEditor' })).id;
  const team = await createTeam({
    team: { uuid: teamUuid },
    users: [
      { userId: ownerId, role: 'OWNER' },
      { userId: editorId, role: 'EDITOR' },
    ],
  });
  teamId = team.id;
});

afterEach(clearDb);

describe('GET /v0/teams/:uuid/billing/checkout/session', () => {
  describe('authentication', () => {
    it('responds with a 401 when the token is invalid', async () => {
      await request(app)
        .get(endpoint())
        .set('Authorization', 'Bearer InvalidToken checkoutOwner')
        .expect(401)
        .expect(expectError);
    });
  });

  describe('authorization', () => {
    it('responds with a 403 when user does not have TEAM_MANAGE permission', async () => {
      await request(app).get(endpoint()).set('Authorization', 'Bearer ValidToken checkoutEditor').expect(403);
    });

    it('responds with a 403 for a user not in the team', async () => {
      await createUser({ auth0Id: 'checkoutOutsider' });
      await request(app).get(endpoint()).set('Authorization', 'Bearer ValidToken checkoutOutsider').expect(403);
    });
  });

  describe('new subscription checkout', () => {
    it('creates a checkout session for pro plan', async () => {
      await request(app)
        .get(endpoint('pro'))
        .set('Authorization', 'Bearer ValidToken checkoutOwner')
        .expect(200)
        .expect(({ body }) => {
          expect(body.url).toBeDefined();
          expect(typeof body.url).toBe('string');
        });
    });

    it('creates a checkout session for business plan', async () => {
      await request(app)
        .get(endpoint('business'))
        .set('Authorization', 'Bearer ValidToken checkoutOwner')
        .expect(200)
        .expect(({ body }) => {
          expect(body.url).toBeDefined();
        });
    });

    it('creates a Stripe customer if one does not exist', async () => {
      const teamBefore = await dbClient.team.findUnique({ where: { uuid: teamUuid } });
      expect(teamBefore?.stripeCustomerId).toBeNull();

      await request(app).get(endpoint()).set('Authorization', 'Bearer ValidToken checkoutOwner').expect(200);

      const teamAfter = await dbClient.team.findUnique({ where: { uuid: teamUuid } });
      expect(teamAfter?.stripeCustomerId).toBe('cus_test123');
    });

    it('reuses existing Stripe customer', async () => {
      await dbClient.team.update({
        where: { uuid: teamUuid },
        data: { stripeCustomerId: 'cus_existing' },
      });

      await request(app).get(endpoint()).set('Authorization', 'Bearer ValidToken checkoutOwner').expect(200);

      const team = await dbClient.team.findUnique({ where: { uuid: teamUuid } });
      expect(team?.stripeCustomerId).toBe('cus_existing');
    });
  });

  describe('existing subscription', () => {
    it('responds with 400 when team already has same plan', async () => {
      await upgradeTeamToPro(teamId);

      await request(app).get(endpoint('pro')).set('Authorization', 'Bearer ValidToken checkoutOwner').expect(400);
    });

    it('upgrades from Pro to Business', async () => {
      await upgradeTeamToPro(teamId);

      await request(app)
        .get(endpoint('business'))
        .set('Authorization', 'Bearer ValidToken checkoutOwner')
        .expect(200)
        .expect(({ body }) => {
          expect(body.url).toContain('subscription=upgraded');
        });
    });

    it('responds with 400 when downgrading from Business to Pro', async () => {
      await upgradeTeamToBusiness(teamId);

      await request(app).get(endpoint('pro')).set('Authorization', 'Bearer ValidToken checkoutOwner').expect(400);
    });

    it('responds with 400 when already on Business plan requesting Business', async () => {
      await upgradeTeamToBusiness(teamId);

      await request(app).get(endpoint('business')).set('Authorization', 'Bearer ValidToken checkoutOwner').expect(400);
    });
  });

  describe('team validation', () => {
    it('responds with a 404 for a non-existent team', async () => {
      const nonExistentEndpoint = `/v0/teams/11111111-1111-1111-1111-111111111111/billing/checkout/session?redirect-success=${encodeURIComponent(redirectSuccess)}&redirect-cancel=${encodeURIComponent(redirectCancel)}&plan=pro`;
      await request(app).get(nonExistentEndpoint).set('Authorization', 'Bearer ValidToken checkoutOwner').expect(404);
    });
  });
});
