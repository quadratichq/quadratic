// Mock FREE_EDITABLE_FILE_LIMIT for testing
jest.mock('../../env-vars', () => ({
  ...jest.requireActual('../../env-vars'),
  FREE_EDITABLE_FILE_LIMIT: 5,
}));

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
  const dbClient = jest.requireActual('../../dbClient').default;
  const logger = jest.requireActual('../../utils/logger').default;

  // Subscription status priority (same as real implementation in stripe.ts)
  const STATUS_PRIORITY = ['active', 'trialing', 'past_due', 'incomplete', 'unpaid', 'canceled', 'incomplete_expired', 'paused'];

  const subscriptionsCancel = jest.fn().mockResolvedValue({});
  (global as any).__mockSubscriptionsCancel = subscriptionsCancel;

  const TERMINAL_STATUSES = ['canceled', 'incomplete_expired'];

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
        cancel: subscriptionsCancel,
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

      const subscriptions = customer.subscriptions?.data ?? [];

      if (subscriptions.length === 0) {
        // No subscriptions — clear subscription data
        await dbClient.team.update({
          where: { id: team.id },
          data: {
            stripeSubscriptionId: null,
            stripeSubscriptionStatus: null,
            stripeCurrentPeriodEnd: null,
            stripeSubscriptionLastUpdated: null,
          },
        });
        return;
      }

      // Select the best subscription (prefer active, then by priority)
      const sorted = [...subscriptions].sort((a, b) => {
        const pA = STATUS_PRIORITY.indexOf(a.status);
        const pB = STATUS_PRIORITY.indexOf(b.status);
        if (pA !== pB) return pA - pB;
        return b.created - a.created;
      });
      const subscription = sorted[0];

      await dbClient.team.update({
        where: { id: team.id },
        data: {
          stripeSubscriptionId: subscription.id,
          stripeSubscriptionStatus: subscription.status.toUpperCase(),
          stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
          stripeSubscriptionLastUpdated: new Date(),
        },
      });

      // Cancel non-selected stale subscriptions (same as real implementation)
      const staleSubscriptions = subscriptions.filter(
        (s: any) => s.id !== subscription.id && !TERMINAL_STATUSES.includes(s.status)
      );
      for (const staleSub of staleSubscriptions) {
        await subscriptionsCancel(staleSub.id);
      }
    }),
    updateCustomer: jest.fn().mockImplementation(async () => {}),
    updateSeatQuantity: jest.fn().mockImplementation(async () => {}),
    getIsMonthlySubscription: jest.fn().mockResolvedValue(false),
  };
});

// Access mocks from global scope - they're set up in the jest.mock factory above
// The factory runs early due to hoisting, so these will be available when tests run
const mockCustomersRetrieve = (global as any).__mockCustomersRetrieve as jest.Mock;
const mockSubscriptionsCancel = (global as any).__mockSubscriptionsCancel as jest.Mock;

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
  mockSubscriptionsCancel.mockClear();
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

    it('auto-syncs billing when team status is INCOMPLETE_EXPIRED', async () => {
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
      });

      // Set team to INCOMPLETE_EXPIRED with a Stripe customer
      await dbClient.team.update({
        where: { id: team.id },
        data: {
          stripeCustomerId: 'cus_test123',
          stripeSubscriptionStatus: 'INCOMPLETE_EXPIRED',
          stripeSubscriptionId: 'sub_old',
        },
      });

      // Mock: Stripe returns a new active subscription
      mockCustomersRetrieve.mockResolvedValue({
        id: 'cus_test123',
        deleted: false,
        subscriptions: {
          data: [
            {
              id: 'sub_new_active',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              created: Math.floor(Date.now() / 1000),
            },
          ],
        },
      });

      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.billing.status).toBe('ACTIVE');
        });

      // Should have synced without explicit updateBilling param
      expect(mockCustomersRetrieve).toHaveBeenCalledTimes(1);
    });

    it('selects the active subscription when multiple subscriptions exist', async () => {
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
      });

      await dbClient.team.update({
        where: { id: team.id },
        data: {
          stripeCustomerId: 'cus_test123',
          stripeSubscriptionStatus: 'INCOMPLETE',
          stripeSubscriptionId: 'sub_incomplete',
        },
      });

      // Mock: Stripe returns both an incomplete and an active subscription
      mockCustomersRetrieve.mockResolvedValue({
        id: 'cus_test123',
        deleted: false,
        subscriptions: {
          data: [
            {
              id: 'sub_incomplete',
              status: 'incomplete',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              created: Math.floor(Date.now() / 1000) - 3600,
            },
            {
              id: 'sub_active',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              created: Math.floor(Date.now() / 1000),
            },
          ],
        },
      });

      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001?updateBilling=true`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.billing.status).toBe('ACTIVE');
        });

      // Verify the active subscription ID was stored
      const updatedTeam = await dbClient.team.findUniqueOrThrow({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
      });
      expect(updatedTeam.stripeSubscriptionId).toBe('sub_active');
    });

    it('cancels non-selected stale subscriptions during billing sync', async () => {
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
      });

      await dbClient.team.update({
        where: { id: team.id },
        data: {
          stripeCustomerId: 'cus_test123',
          stripeSubscriptionStatus: 'INCOMPLETE',
          stripeSubscriptionId: 'sub_incomplete_1',
        },
      });

      // Mock: Stripe returns active + incomplete + incomplete_expired subscriptions
      mockCustomersRetrieve.mockResolvedValue({
        id: 'cus_test123',
        deleted: false,
        subscriptions: {
          data: [
            {
              id: 'sub_active',
              status: 'active',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              created: Math.floor(Date.now() / 1000),
            },
            {
              id: 'sub_incomplete_1',
              status: 'incomplete',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              created: Math.floor(Date.now() / 1000) - 3600,
            },
            {
              id: 'sub_expired',
              status: 'incomplete_expired',
              current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
              created: Math.floor(Date.now() / 1000) - 7200,
            },
          ],
        },
      });

      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001?updateBilling=true`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.billing.status).toBe('ACTIVE');
        });

      // The incomplete subscription should have been canceled (not terminal)
      // The incomplete_expired subscription should NOT have been canceled (already terminal)
      expect(mockSubscriptionsCancel).toHaveBeenCalledTimes(1);
      expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_incomplete_1');
    });

    it('returns team settings including aiRules', async () => {
      // Set team AI rules
      await dbClient.team.update({
        where: {
          uuid: '00000000-0000-4000-8000-000000000001',
        },
        data: {
          aiRules: 'Team AI rules',
          settingAnalyticsAi: false,
        },
      });

      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.team.settings).toHaveProperty('analyticsAi');
          expect(res.body.team.settings).toHaveProperty('aiRules');
          expect(res.body.team.settings.analyticsAi).toBe(false);
          expect(res.body.team.settings.aiRules).toBe('Team AI rules');
        });
    });

    it('returns null for aiRules when not set', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.team.settings.aiRules).toBeNull();
        });
    });

    it('returns requiresUpgradeToEdit field on files', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.files).toHaveLength(1);
          expect(res.body.files[0]).toHaveProperty('userMakingRequest');
          expect(res.body.files[0].userMakingRequest).toHaveProperty('requiresUpgradeToEdit');
          // With only 1 file, it should not be restricted (under limit of 5)
          expect(res.body.files[0].userMakingRequest.requiresUpgradeToEdit).toBe(false);
        });
    });

    it('marks older files as edit-restricted when over the soft limit', async () => {
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
      });
      const user = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      // Create 6 more files (total 7, with limit of 5)
      // Use different creation dates to control order
      for (let i = 0; i < 6; i++) {
        await createFile({
          data: {
            name: `Extra File ${i}`,
            ownerTeamId: team.id,
            creatorUserId: user.id,
            createdDate: new Date(Date.now() + (i + 1) * 1000), // Newer than existing file
          },
        });
      }

      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.files).toHaveLength(7);

          // Count restricted vs unrestricted files
          const restrictedFiles = res.body.files.filter(
            (f: any) => f.userMakingRequest.requiresUpgradeToEdit === true
          );
          const unrestrictedFiles = res.body.files.filter(
            (f: any) => f.userMakingRequest.requiresUpgradeToEdit === false
          );

          // With limit of 5, 2 should be restricted (oldest ones)
          expect(restrictedFiles).toHaveLength(2);
          expect(unrestrictedFiles).toHaveLength(5);

          // Restricted files should not have FILE_EDIT permission
          for (const file of restrictedFiles) {
            expect(file.userMakingRequest.filePermissions).not.toContain('FILE_EDIT');
          }

          // Unrestricted files should have FILE_EDIT permission
          for (const file of unrestrictedFiles) {
            expect(file.userMakingRequest.filePermissions).toContain('FILE_EDIT');
          }
        });
    });

    it('returns fileLimit field with correct values', async () => {
      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.fileLimit).toBeDefined();
          expect(res.body.fileLimit.isOverLimit).toBe(false);
          expect(res.body.fileLimit.totalFiles).toBe(1);
          expect(res.body.fileLimit.maxEditableFiles).toBe(5);
        });
    });

    it('returns fileLimit.isOverLimit=false when team is at exactly the limit', async () => {
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
      });
      const user = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      // Create 4 more files (total 5, at limit)
      for (let i = 0; i < 4; i++) {
        await createFile({
          data: {
            name: `Extra File ${i}`,
            ownerTeamId: team.id,
            creatorUserId: user.id,
          },
        });
      }

      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          // At exactly 5 files (limit), isOverLimit should be false - all files are editable
          expect(res.body.fileLimit.isOverLimit).toBe(false);
          expect(res.body.fileLimit.totalFiles).toBe(5);
          expect(res.body.fileLimit.maxEditableFiles).toBe(5);
        });
    });

    it('returns fileLimit.isOverLimit=true when team exceeds file limit', async () => {
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
      });
      const user = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      // Create 5 more files (total 6, exceeding limit of 5)
      for (let i = 0; i < 5; i++) {
        await createFile({
          data: {
            name: `Extra File ${i}`,
            ownerTeamId: team.id,
            creatorUserId: user.id,
          },
        });
      }

      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_owner`)
        .expect(200)
        .expect((res) => {
          expect(res.body.fileLimit.isOverLimit).toBe(true);
          expect(res.body.fileLimit.totalFiles).toBe(6);
          expect(res.body.fileLimit.maxEditableFiles).toBe(5);
        });
    });

    it('returns fileLimit.isOverLimit=true for second user even when restricted files are private to another user', async () => {
      const team = await dbClient.team.findUniqueOrThrow({
        where: { uuid: '00000000-0000-4000-8000-000000000001' },
      });
      const owner = await dbClient.user.findUniqueOrThrow({
        where: { auth0Id: 'team_1_owner' },
      });

      // Create 6 PRIVATE files owned by the team owner (total 7 including the 1 existing public file)
      // These won't be visible to team_1_editor, but they still count toward the limit
      for (let i = 0; i < 6; i++) {
        await createFile({
          data: {
            name: `Owner Private File ${i}`,
            ownerTeamId: team.id,
            creatorUserId: owner.id,
            ownerUserId: owner.id, // Private to owner
          },
        });
      }

      // Request as editor - they can only see the 1 public file, not the 6 private ones
      await request(app)
        .get(`/v0/teams/00000000-0000-4000-8000-000000000001`)
        .set('Authorization', `Bearer ValidToken team_1_editor`)
        .expect(200)
        .expect((res) => {
          // Editor only sees 1 public file (not the owner's 6 private files)
          expect(res.body.files).toHaveLength(1);
          expect(res.body.filesPrivate).toHaveLength(0);

          // But the team IS over the limit (7 total files, limit is 5)
          // This is the key assertion - the banner should show for the editor
          expect(res.body.fileLimit.isOverLimit).toBe(true);
          expect(res.body.fileLimit.totalFiles).toBe(7);
          expect(res.body.fileLimit.maxEditableFiles).toBe(5);
        });
    });
  });
});
