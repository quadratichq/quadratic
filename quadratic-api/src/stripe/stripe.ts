import type { Team } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';
import { UserTeamRoleSchema } from 'quadratic-shared/typesAndSchemas';
import Stripe from 'stripe';
import { trackEvent } from '../analytics/mixpanel';
import dbClient from '../dbClient';
import { STRIPE_SECRET_KEY } from '../env-vars';
import logger from '../utils/logger';
import type { DecryptedTeam } from '../utils/teams';

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  typescript: true,
});

const getTeamSeatQuantity = async (teamId: number) => {
  return dbClient.userTeamRole.count({
    where: {
      teamId,
    },
  });
};

export const updateSeatQuantity = async (teamId: number) => {
  const team = await dbClient.team.findUnique({
    where: {
      id: teamId,
    },
  });
  if (!team?.stripeSubscriptionId) {
    throw new Error('Team does not have a stripe subscription. Cannot add user.');
  }

  // Get the number of users on the team
  const numUsersOnTeam = await getTeamSeatQuantity(teamId);

  // Get the subscription item id
  const subscription = await stripe.subscriptions.retrieve(team.stripeSubscriptionId);
  const subscriptionItems = subscription.items.data;

  if (subscriptionItems.length !== 1) {
    throw new Error('Subscription does not have exactly 1 item');
  }

  // Update the stripe subscription
  return stripe.subscriptions.update(team.stripeSubscriptionId, {
    items: [
      {
        id: subscriptionItems[0].id,
        quantity: numUsersOnTeam,
      },
    ],
  });
};

export const createCustomer = async (name: string, email: string) => {
  return stripe.customers.create({
    name,
    email,
  });
};

export const updateCustomer = async (customerId: string, name: string) => {
  return stripe.customers.update(customerId, {
    name,
  });
};

export const createBillingPortalSession = async (teamUuid: string, returnUrlBase: string) => {
  const team = await dbClient.team.findUnique({
    where: {
      uuid: teamUuid,
    },
  });

  if (!team?.stripeCustomerId) {
    throw new Error('Team does not have a stripe customer. Cannot create billing portal session.');
  }

  return stripe.billingPortal.sessions.create({
    customer: team?.stripeCustomerId,
    return_url: `${returnUrlBase}/teams/${teamUuid}/settings`,
  });
};

export const createCheckoutSession = async (
  teamUuid: string,
  priceId: string,
  redirectUrlSuccess: string,
  redirectUrlCancel: string
) => {
  const team = await dbClient.team.findUnique({
    where: {
      uuid: teamUuid,
    },
  });

  if (!team?.stripeCustomerId) {
    throw new Error('Team does not have a stripe customer. Cannot create checkout session.');
  }

  // get the number of users on the team
  const numUsersOnTeam = await getTeamSeatQuantity(team.id);

  // Set the callback URL on success
  //
  // We track `subscription=created` via google analytics, so any URL that has
  // that search param will get tracked as a signup in stripe.
  //
  // Stripe will swap out the `session_id` value, but you can't URL encode it or
  // it won't work. So we have to manually set it.
  const url = new URL(redirectUrlSuccess);
  url.searchParams.set('subscription', 'created');
  const redirectUrlSuccessWithTracking = url.toString() + '&session_id={CHECKOUT_SESSION_ID}';

  return stripe.checkout.sessions.create({
    customer: team?.stripeCustomerId,
    line_items: [
      {
        price: priceId,
        quantity: numUsersOnTeam,
      },
    ],
    mode: 'subscription',
    allow_promotion_codes: true,
    success_url: redirectUrlSuccessWithTracking,
    cancel_url: redirectUrlCancel,
  });
};

export const getMonthlyPriceId = async () => {
  const prices = await stripe.prices.list({
    active: true,
  });

  const data = prices.data.filter((price) => price.lookup_key === 'team_monthly_ai');
  if (data.length === 0) {
    throw new Error('No monthly price found');
  }

  return data[0].id;
};

export const updateTeamStatus = async (
  stripeSubscriptionId: string,
  status: Stripe.Subscription.Status,
  customerId: string,
  endDate: Date
) => {
  // convert the status to SubscriptionStatus enum
  let stripeSubscriptionStatus: SubscriptionStatus;
  switch (status) {
    case 'active':
      stripeSubscriptionStatus = SubscriptionStatus.ACTIVE;
      break;
    case 'canceled':
      stripeSubscriptionStatus = SubscriptionStatus.CANCELED;
      break;
    case 'incomplete':
      stripeSubscriptionStatus = SubscriptionStatus.INCOMPLETE;
      break;
    case 'incomplete_expired':
      stripeSubscriptionStatus = SubscriptionStatus.INCOMPLETE_EXPIRED;
      break;
    case 'past_due':
      stripeSubscriptionStatus = SubscriptionStatus.PAST_DUE;
      break;
    case 'trialing':
      stripeSubscriptionStatus = SubscriptionStatus.TRIALING;
      break;
    case 'unpaid':
      stripeSubscriptionStatus = SubscriptionStatus.UNPAID;
      break;
    default:
      logger.error('Unhandled subscription status', { status });
      return;
  }

  // Use a transaction to get old data and update atomically
  const result = await dbClient.$transaction(async (tx) => {
    // Get the team before updating
    const oldTeam = await tx.team.findUnique({
      where: { stripeCustomerId: customerId },
      select: {
        stripeSubscriptionStatus: true,
        id: true,
      },
    });

    if (!oldTeam) {
      logger.error('Team not found', { customerId });
      return;
    }

    // Get the teams first owner
    const userTeamRole = await tx.userTeamRole.findFirst({
      where: {
        teamId: oldTeam.id,
        role: UserTeamRoleSchema.enum.OWNER,
      },
      select: {
        user: {
          select: {
            auth0Id: true,
          },
        },
      },
    });
    const teamOwner = userTeamRole?.user;

    if (!teamOwner) {
      logger.error('First owner not found', { teamId: oldTeam.id });
      return;
    }

    // Update the team
    const updatedTeam = await tx.team.update({
      where: { stripeCustomerId: customerId },
      data: {
        // activated: true, // activate the team
        stripeSubscriptionId,
        stripeSubscriptionStatus,
        stripeCurrentPeriodEnd: endDate,
        stripeSubscriptionLastUpdated: new Date(),
      },
    });

    return { oldTeam, updatedTeam, teamOwner };
  });

  if (!result) {
    return;
  }

  const { oldTeam, updatedTeam, teamOwner } = result;

  // Now you can compare the statuses
  const statusChanged = oldTeam?.stripeSubscriptionStatus !== updatedTeam.stripeSubscriptionStatus;

  // If the status changed, track the event
  if (statusChanged && updatedTeam.stripeSubscriptionStatus !== null) {
    // track the event
    trackEvent('[Stripe].statusChangedTo.' + updatedTeam.stripeSubscriptionStatus.toLowerCase(), {
      distinct_id: teamOwner.auth0Id,
      teamId: updatedTeam.id,
      oldStatus: oldTeam?.stripeSubscriptionStatus?.toLowerCase(),
      newStatus: updatedTeam.stripeSubscriptionStatus?.toLowerCase(),
    });
  }
};

export const handleSubscriptionWebhookEvent = async (event: Stripe.Subscription) => {
  const { id: stripeSubscriptionId, status, customer } = event;

  // if customer is not a string, then the following line will throw an error
  if (typeof customer !== 'string') {
    logger.error('Invalid customer ID', { customer });
    return;
  }

  updateTeamStatus(stripeSubscriptionId, status, customer, new Date(event.current_period_end * 1000));
};

export const getIsMonthlySubscription = async (stripeSubscriptionId: string): Promise<boolean> => {
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const isMonthly = subscription.items.data[0]?.price?.recurring?.interval === 'month';
  return isMonthly;
};

// Priority order for choosing the best subscription when multiple exist.
// Lower index = higher priority.
const SUBSCRIPTION_STATUS_PRIORITY: Stripe.Subscription.Status[] = [
  'active',
  'trialing',
  'past_due',
  'incomplete',
  'unpaid',
  'canceled',
  'incomplete_expired',
  'paused',
];

/**
 * Selects the best subscription from a list of subscriptions.
 * Prefers active subscriptions; falls back to the highest-priority status.
 * Among subscriptions with the same status, prefers the most recently created one.
 */
export const selectBestSubscription = (subscriptions: Stripe.Subscription[]): Stripe.Subscription => {
  if (subscriptions.length === 0) {
    throw new Error('selectBestSubscription called with empty array');
  }
  return [...subscriptions].sort((a, b) => {
    const priorityA = SUBSCRIPTION_STATUS_PRIORITY.indexOf(a.status);
    const priorityB = SUBSCRIPTION_STATUS_PRIORITY.indexOf(b.status);
    if (priorityA !== priorityB) return priorityA - priorityB;
    // Same status: prefer more recently created
    return b.created - a.created;
  })[0];
};

/**
 * Cancels any incomplete subscriptions for a Stripe customer.
 * This prevents duplicate subscriptions when a user retries checkout after
 * an abandoned or failed payment attempt.
 *
 * Returns the number of subscriptions canceled.
 */
export const cancelIncompleteSubscriptions = async (stripeCustomerId: string): Promise<number> => {
  const customer = await stripe.customers.retrieve(stripeCustomerId, {
    expand: ['subscriptions'],
  });

  if (customer.deleted) {
    return 0;
  }

  const subscriptions = customer.subscriptions?.data ?? [];
  const incompleteSubscriptions = subscriptions.filter(
    (s) => s.status === 'incomplete' || s.status === 'incomplete_expired'
  );

  // incomplete_expired subscriptions are already terminal and don't need cancellation,
  // but incomplete ones represent abandoned checkout attempts that should be cleaned up.
  const cancelable = incompleteSubscriptions.filter((s) => s.status === 'incomplete');

  for (const sub of cancelable) {
    logger.info('Canceling incomplete subscription before new checkout', {
      customerId: stripeCustomerId,
      subscriptionId: sub.id,
    });
    await stripe.subscriptions.cancel(sub.id);
  }

  return cancelable.length;
};

export const updateBilling = async (team: Team | DecryptedTeam) => {
  if (!team.stripeCustomerId) {
    return;
  }

  // retrieve the customer
  const customer = await stripe.customers.retrieve(team.stripeCustomerId, {
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

  if (subscriptions.length > 1) {
    // Multiple subscriptions is unexpected but can happen when users retry checkout.
    // Log a warning and pick the best one instead of bailing out.
    logger.warn('Multiple subscriptions found for customer, selecting best one', {
      customerId: team.stripeCustomerId,
      subscriptionCount: subscriptions.length,
      statuses: subscriptions.map((s) => s.status),
    });
  }

  const subscription = selectBestSubscription(subscriptions);
  await updateTeamStatus(
    subscription.id,
    subscription.status,
    team.stripeCustomerId,
    new Date(subscription.current_period_end * 1000)
  );
};
