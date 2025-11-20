import request from 'supertest';
import { app } from '../../app';
import { expectError } from '../../tests/helpers';
import { clearDb, createTeam, createUsers } from '../../tests/testDataGenerator';

// Create mock functions inside the factory to avoid temporal dead zone
jest.mock('../../stripe/stripe', () => {
  const actual = jest.requireActual('../../stripe/stripe');
  // Create mocks inside factory
  const checkoutRetrieve = jest.fn();
  const subscriptionsRetrieve = jest.fn();
  const updateStatus = jest.fn();

  // Store references globally so tests can access them
  (global as any).__mockCheckoutSessionsRetrieve = checkoutRetrieve;
  (global as any).__mockSubscriptionsRetrieve = subscriptionsRetrieve;
  (global as any).__mockUpdateTeamStatus = updateStatus;

  return {
    ...actual,
    stripe: {
      checkout: {
        sessions: {
          retrieve: checkoutRetrieve,
        },
      },
      subscriptions: {
        retrieve: subscriptionsRetrieve,
      },
    },
    updateTeamStatus: updateStatus,
  };
});

// Access mocks from global scope - they're set up in the jest.mock factory above
// The factory runs early due to hoisting, so these will be available when tests run
const mockCheckoutSessionsRetrieve = (global as any).__mockCheckoutSessionsRetrieve as jest.Mock;
const mockSubscriptionsRetrieve = (global as any).__mockSubscriptionsRetrieve as jest.Mock;
const mockUpdateTeamStatus = (global as any).__mockUpdateTeamStatus as jest.Mock;

beforeEach(async () => {
  const [owner, editor, viewer] = await createUsers(['userOwner', 'userEditor', 'userViewer']);

  // Team with Stripe customer
  await createTeam({
    team: {
      uuid: '00000000-0000-0000-0000-000000000000',
      stripeCustomerId: 'cus_test123',
    },
    users: [
      { userId: owner.id, role: 'OWNER' },
      { userId: editor.id, role: 'EDITOR' },
      { userId: viewer.id, role: 'VIEWER' },
    ],
  });

  // Team without Stripe customer
  await createTeam({
    team: {
      uuid: '11111111-1111-1111-1111-111111111111',
    },
    users: [{ userId: owner.id, role: 'OWNER' }],
  });

  // Reset mocks
  jest.clearAllMocks();
});

afterEach(clearDb);

describe('POST /v0/teams/:uuid/billing/checkout/verify', () => {
  describe('invalid requests', () => {
    it('responds with a 401 when the token is invalid', async () => {
      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/checkout/verify`)
        .send({ sessionId: 'cs_test123' })
        .set('Authorization', `Bearer InvalidToken userOwner`)
        .expect(401)
        .expect(expectError);
    });

    it('responds with a 403 when user does not have TEAM_MANAGE access', async () => {
      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/checkout/verify`)
        .send({ sessionId: 'cs_test123' })
        .set('Authorization', `Bearer ValidToken userEditor`)
        .expect(403)
        .expect(expectError);
    });

    it('responds with a 403 when user does not have permission', async () => {
      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/checkout/verify`)
        .send({ sessionId: 'cs_test123' })
        .set('Authorization', `Bearer ValidToken userViewer`)
        .expect(403)
        .expect(expectError);
    });

    it('responds with a 400 when team does not have a Stripe customer', async () => {
      await request(app)
        .post(`/v0/teams/11111111-1111-1111-1111-111111111111/billing/checkout/verify`)
        .send({ sessionId: 'cs_test123' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(400)
        .expect(expectError);
    });

    it('responds with a 400 when sessionId is missing', async () => {
      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/checkout/verify`)
        .send({})
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(400)
        .expect(expectError);
    });
  });

  describe('session verification', () => {
    it('responds with subscriptionActive: false when session is not found', async () => {
      const stripeError = new Error('Session not found');
      (stripeError as any).type = 'StripeInvalidRequestError';
      mockCheckoutSessionsRetrieve.mockRejectedValue(stripeError);

      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/checkout/verify`)
        .send({ sessionId: 'cs_invalid' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            subscriptionActive: false,
            error: 'Session not found',
          });
        });
    });

    it('responds with subscriptionActive: false when session belongs to different customer', async () => {
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        customer: 'cus_different',
        status: 'complete',
        subscription: 'sub_test123',
      } as any);

      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/checkout/verify`)
        .send({ sessionId: 'cs_test123' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(403)
        .expect(expectError);
    });

    it('responds with subscriptionActive: false when session is incomplete', async () => {
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        customer: 'cus_test123',
        status: 'open',
        subscription: null,
      } as any);

      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/checkout/verify`)
        .send({ sessionId: 'cs_test123' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            subscriptionActive: false,
            sessionStatus: 'open',
          });
        });
    });

    it('responds with subscriptionActive: false when session is complete but subscription is not active', async () => {
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        customer: 'cus_test123',
        status: 'complete',
        subscription: 'sub_test123',
      } as any);

      mockSubscriptionsRetrieve.mockResolvedValue({
        id: 'sub_test123',
        status: 'incomplete',
        customer: 'cus_test123',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days from now
      } as any);

      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/checkout/verify`)
        .send({ sessionId: 'cs_test123' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            subscriptionActive: false,
            sessionStatus: 'complete',
          });
        });
    });

    it('responds with subscriptionActive: true and updates team status when subscription is active', async () => {
      const subscriptionId = 'sub_test123';
      const customerId = 'cus_test123';
      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now

      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        customer: customerId,
        status: 'complete',
        subscription: subscriptionId,
      } as any);

      mockSubscriptionsRetrieve.mockResolvedValue({
        id: subscriptionId,
        status: 'active',
        customer: customerId,
        current_period_end: periodEnd,
      } as any);

      mockUpdateTeamStatus.mockResolvedValue(undefined);

      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/checkout/verify`)
        .send({ sessionId: 'cs_test123' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            subscriptionActive: true,
            status: 'active',
          });
        });

      // Verify updateTeamStatus was called with correct parameters
      expect(mockUpdateTeamStatus).toHaveBeenCalledTimes(1);
      expect(mockUpdateTeamStatus).toHaveBeenCalledWith(subscriptionId, 'active', customerId, expect.any(Date));
    });

    it('responds with subscriptionActive: true when subscription is trialing', async () => {
      const subscriptionId = 'sub_test123';
      const customerId = 'cus_test123';
      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now

      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        customer: customerId,
        status: 'complete',
        subscription: subscriptionId,
      } as any);

      mockSubscriptionsRetrieve.mockResolvedValue({
        id: subscriptionId,
        status: 'trialing',
        customer: customerId,
        current_period_end: periodEnd,
      } as any);

      mockUpdateTeamStatus.mockResolvedValue(undefined);

      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/checkout/verify`)
        .send({ sessionId: 'cs_test123' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            subscriptionActive: true,
            status: 'trialing',
          });
        });

      expect(mockUpdateTeamStatus).toHaveBeenCalledWith(subscriptionId, 'trialing', customerId, expect.any(Date));
    });

    it('handles expanded subscription in session response', async () => {
      const subscriptionId = 'sub_test123';
      const customerId = 'cus_test123';
      const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      // When subscription is expanded, it's an object, not a string
      mockCheckoutSessionsRetrieve.mockResolvedValue({
        id: 'cs_test123',
        customer: customerId,
        status: 'complete',
        subscription: {
          id: subscriptionId,
          status: 'active',
          customer: customerId,
          current_period_end: periodEnd,
        },
      } as any);

      mockUpdateTeamStatus.mockResolvedValue(undefined);

      await request(app)
        .post(`/v0/teams/00000000-0000-0000-0000-000000000000/billing/checkout/verify`)
        .send({ sessionId: 'cs_test123' })
        .set('Authorization', `Bearer ValidToken userOwner`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({
            subscriptionActive: true,
            status: 'active',
          });
        });

      // Should not call subscriptions.retrieve when subscription is already expanded
      expect(mockSubscriptionsRetrieve).not.toHaveBeenCalled();
      expect(mockUpdateTeamStatus).toHaveBeenCalledWith(subscriptionId, 'active', customerId, expect.any(Date));
    });
  });
});
