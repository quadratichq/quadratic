import { workosMock } from '../../tests/workosMock';
jest.mock('@workos-inc/node', () =>
  workosMock([
    {
      id: 'team_1_owner',
      firstName: 'Test',
      lastName: 'User 1',
    },
    {
      id: 'team_1_editor',
      firstName: 'Test',
      lastName: 'User 2',
    },
    {
      id: 'team_1_viewer',
      firstName: 'Test',
      lastName: 'User 3',
    },
    {
      id: 'user_without_team',
      firstName: 'Test',
      lastName: 'User 4',
    },
  ])
);

import request from 'supertest';
import { app } from '../../app';
import dbClient from '../../dbClient';
import { clearDb, createFile, createTeam, createUser } from '../../tests/testDataGenerator';

// Mock Stripe
jest.mock('../../stripe/stripe', () => {
  // Create mock inside factory to avoid temporal dead zone
  const customersRetrieve = jest.fn();

  // Store reference globally so tests can access it
  (global as any).__mockCustomersRetrieve = customersRetrieve;

  // Import dbClient for the mock updateBilling implementation
  const dbClient = require('../../dbClient').default;
  const logger = require('../../utils/logger').default;

  return {
    stripe: {
      customers: {
        retrieve: customersRetrieve,
      },
      coupons: {
        create: jest.fn().mockResolvedValue({ id: 'coupon_test123' }),
      },
      subscriptions: {
        update: jest.fn().mockResolvedValue({}),
      },
    },
    updateBilling: jest.fn().mockImplementation(async (team) => {
      if (!team.stripeCustomerId) {
        return;
      }

      // retrieve the customer using the mocked function
      const customer = await customersRetrieve(team.stripeCustomerId, {
        expand: ['subscriptions'],
      });

      // This should not happen, but if it does, we should not update the team
      if (customer.deleted) {
        logger.error('Unexpected Error: Customer is deleted', { customer });
        return;
      }

      if (customer.subscriptions && customer.subscriptions.data.length === 1) {
        // For this test, we're only testing the zero subscription case
        // so this branch doesn't need full implementation
        throw new Error('Test does not handle single subscription case');
      } else if (customer.subscriptions && customer.subscriptions.data.length === 0) {
        // if we have zero subscriptions, update the team
        await dbClient.team.update({
          where: { id: team.id },
          data: {
            stripeSubscriptionId: null,
            stripeSubscriptionStatus: null,
            stripeCurrentPeriodEnd: null,
            stripeSubscriptionLastUpdated: null,
          },
        });
      } else {
        // If we have more than one subscription, log an error
        logger.error('Unexpected Error: Unhandled number of subscriptions', {
          subscriptions: customer.subscriptions?.data,
        });
      }
    }),
    updateCustomer: jest.fn().mockImplementation(async () => {}),
    updateSeatQuantity: jest.fn().mockImplementation(async () => {}),
    getIsMonthlySubscription: jest.fn().mockResolvedValue(false),
  };
});

// Access mock from global scope - it's set up in the jest.mock factory above
// The factory runs early due to hoisting, so this will be available when tests run
const mockCustomersRetrieve = (global as any).__mockCustomersRetrieve as jest.Mock;

beforeEach(async () => {
  const user_1 = await createUser({ auth0Id: 'team_1_owner' });
  const user_2 = await createUser({ auth0Id: 'team_1_editor' });
  const user_3 = await createUser({ auth0Id: 'team_1_viewer' });
  await createUser({ auth0Id: 'user_without_team' });

  const team = await createTeam({
    team: {
      name: 'Test Team 1',
      uuid: '00000000-0000-4000-8000-000000000001',
    },
    users: [
      {
        userId: user_1.id,
        role: 'OWNER',
      },
      { userId: user_2.id, role: 'EDITOR' },
      { userId: user_3.id, role: 'VIEWER' },
    ],
    connections: [{ type: 'POSTGRES' }],
  });

  await createFile({
    data: {
      name: 'Test File 1',
      ownerTeamId: team.id,
      creatorUserId: user_1.id,
    },
  });

  // Reset mocks
  mockCustomersRetrieve.mockClear();
});

afterEach(clearDb);

describe('GET /v0/teams/:uuid', () => {
  describe('get a team you belong to', () => {
    // TODO different responses for OWNER, EDITOR, VIEWER?
    it('responds with a team', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('team');
          expect(res.body.team.uuid).toBe('00000000-0000-4000-8000-000000000001');

          expect(res.body.team.settings.analyticsAi).toBe(true);
          expect(res.body.clientDataKv).toStrictEqual({});
          expect(res.body.connections).toHaveLength(2); // 1 created + 1 demo
          expect(res.body.files).toHaveLength(1);
          expect(typeof res.body.files[0].file.creatorId).toBe('number');

          expect(res.body.users[0].email).toBe('team_1_owner@test.com');
          expect(res.body.users[0].role).toBe('OWNER');
          expect(res.body.users[0].name).toBe('Test User 1');

          expect(res.body.users[1].email).toBe('team_1_editor@test.com');
          expect(res.body.users[1].role).toBe('EDITOR');
          expect(res.body.users[1].name).toBe('Test User 2');

          expect(res.body.users[2].email).toBe('team_1_viewer@test.com');
          expect(res.body.users[2].role).toBe('VIEWER');
          expect(res.body.users[2].name).toBe('Test User 3');
        });
    });

    it('does not return archived connections', async () => {
      // delete all connections in a team
      const team = await dbClient.team.findUniqueOrThrow({
        where: {
          uuid: '00000000-0000-4000-8000-000000000001',
        },
      });
      await dbClient.connection.deleteMany({
        where: {
          teamId: team.id,
        },
      });

      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.connections).toHaveLength(1);
          expect(res.body.connections[0].isDemo).toBe(true);
        });
    });

    it('does not call updateBilling when updateBilling query param is not present', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200);

      expect(mockCustomersRetrieve).not.toHaveBeenCalled();
    });

    it('calls updateBilling when updateBilling=true query param is present', async () => {
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
      });

      // Update team to have a Stripe customer ID
      await dbClient.team.update({
        where: { id: team.id },
        data: { stripeCustomerId: 'cus_test123' },
      });

      // Mock Stripe customer response with no subscriptions
      mockCustomersRetrieve.mockResolvedValue({
        id: 'cus_test123',
        deleted: false,
        subscriptions: {
          data: [],
        },
      });

      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001?updateBilling=true`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200);

      expect(mockCustomersRetrieve).toHaveBeenCalledTimes(1);
      expect(mockCustomersRetrieve).toHaveBeenCalledWith('cus_test123', {
        expand: ['subscriptions'],
      });
    });

    it('does not call updateBilling when team has no Stripe customer', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001?updateBilling=true`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200);

      // updateBilling should return early if no stripeCustomerId, so Stripe shouldn't be called
      expect(mockCustomersRetrieve).not.toHaveBeenCalled();
    });
  });
});
