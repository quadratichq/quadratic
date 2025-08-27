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
});

afterEach(clearDb);

describe('POST /v0/teams/:uuid/billing/retention-discount', () => {
  describe('invalid requests', () => {
    it('responds with a 401 when the token is invalid', async () => {
      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/retention-discount`)
        .set('Authorization', `Bearer InvalidToken userOwner`)
        .expect(401)
        .expect(expectError);
    });

    it('responds with a 403 when user does not have TEAM_MANAGE access', async () => {
      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/retention-discount`)
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect(403)
        .expect(expectError);
    });

    it('responds with a 403 when user does not have permission', async () => {
      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/retention-discount`)
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect(403)
        .expect(expectError);
    });
  });

  // Exhaustive testing of all cases is tested in the GET request, so we just check one here
  describe('ineligible & no discount applied', () => {
    it('responds with a 400 when the team is not eligible', async () => {
      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/retention-discount`)
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(400)
        .expect(expectError);

      // Verify database was not updated
      const updatedTeam = await dbClient.team.findUnique({
        where: { uuid: '00000000-0000-0000-0000-000000000000' },
      });
      expect(updatedTeam?.stripeSubscriptionRetentionCouponId).toBeNull();
    });
  });

  describe('eligible & applied', () => {
    it('successfully applies the discount for a monthly subscription', async () => {
      (getIsMonthlySubscription as jest.Mock).mockResolvedValue(true);

      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/retention-discount`)
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toHaveProperty('message');
        });

      // Verify database was updated
      const updatedTeam = await dbClient.team.findUnique({
        where: { uuid: '00000000-0000-0000-0000-000000000000' },
      });
      expect(updatedTeam?.stripeSubscriptionRetentionCouponId).toBeDefined();
    });
  });
});
