import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { getIsMonthlySubscription } from '../../stripe/stripe';
import { expectError } from '../../tests/helpers';
import { clearDb, createTeam, createUsers } from '../../tests/testDataGenerator';

beforeEach(async () => {
  const [owner, editor, viewer] = await createUsers(['userOwner', 'userEditor', 'userViewer']);

  // Paid team
  await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000000',
      stripeSubscriptionId: 'sub_test123',
      stripeSubscriptionStatus: 'ACTIVE',
    },
    users: [
      { userId: owner.id, role: 'OWNER' },
      { userId: editor.id, role: 'EDITOR' },
      { userId: viewer.id, role: 'VIEWER' },
    ],
  });

  // Paid team but cancelled
  await createTeam({
    team: {
      uuid: '22222222-2222-2222-2222-222222222222',
      stripeSubscriptionId: 'sub_test124',
      stripeSubscriptionStatus: 'CANCELED',
    },
    users: [{ userId: owner.id, role: 'OWNER' }],
  });

  // Free team
  await createTeam({
    team: {
      uuid: '11111111-1111-1111-1111-111111111111',
    },
    users: [{ userId: owner.id, role: 'OWNER' }],
  });
});

afterEach(clearDb);

describe('GET /v0/teams/:uuid/billing/retention-discount', () => {
  describe('invalid requests', () => {
    it('responds with a 401 when the token is invalid', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/retention-discount`)
        .set('Authorization', `Bearer InvalidToken userOwner`)
        .expect(401)
        .expect(expectError);
    });
    it('responds with a 403 when user does not have TEAM_MANAGE access', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/retention-discount`)
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect(403)
        .expect(expectError);
    });
    it('responds with a 403 when user does not have permission', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/retention-discount`)
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect(403)
        .expect(expectError);
    });
  });

  describe('not eligible', () => {
    it('responds as ineligible for a team without a subscription', async () => {
      await request(app)
        .get(`/v0/teams/11111111-1111-1111-1111-111111111111/billing/retention-discount`)
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({ isEligible: false });
        });
    });
    it('responds as ineligible for a paid team with a yearly subscription', async () => {
      (getIsMonthlySubscription as jest.Mock).mockResolvedValue(false);
      await request(app)
        .get(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/retention-discount`)
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({ isEligible: false });
        });
    });
    it('responds as ineligible for a paid team that already used the retention discount', async () => {
      await dbClient.team.update({
        where: { uuid: '00000000-0000-0000-0000-000000000000' },
        data: {
          stripeSubscriptionRetentionCouponId: 'coupon_already_used',
        },
      });
      await request(app)
        .get(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/retention-discount`)
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({ isEligible: false });
        });
    });
    it('responds as ineligible for a paid team that is not active', async () => {
      await request(app)
        .get(`/v0/teams/22222222-2222-2222-2222-222222222222/billing/retention-discount`)
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({ isEligible: false });
        });
    });
  });

  describe('eligible', () => {
    it('responds as eligible for a paid team with a monthly subscription', async () => {
      (getIsMonthlySubscription as jest.Mock).mockResolvedValue(true);

      await request(app)
        .get(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/retention-discount`)
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({ isEligible: true });
        });
    });
  });
});
