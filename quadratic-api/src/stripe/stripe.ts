import { SubscriptionStatus, Team } from '@prisma/client';
import Stripe from 'stripe';
import dbClient from '../dbClient';
import { NODE_ENV, STRIPE_SECRET_KEY } from '../env-vars';

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
    return_url: `${returnUrlBase}/teams/${teamUuid}`,
  });
};

export const createCheckoutSession = async (teamUuid: string, priceId: string, returnUrlBase: string) => {
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
    success_url: `${returnUrlBase}/teams/${teamUuid}?subscription=created&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrlBase}`,
  });
};

export const getMonthlyPriceId = async () => {
  const prices = await stripe.prices.list({
    active: true,
  });

  const data = prices.data.filter((price) => price.lookup_key === 'team_monthly');
  if (data.length === 0) {
    throw new Error('No monthly price found');
  }

  return data[0].id;
};

const updateTeamStatus = async (
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
      console.error(`Unhandled subscription status: ${status}`);
      return;
  }

  // Associate the subscription with the team and update the status
  await dbClient.team.update({
    where: { stripeCustomerId: customerId },
    data: {
      activated: true, // activate the team
      stripeSubscriptionId,
      stripeSubscriptionStatus,
      stripeCurrentPeriodEnd: endDate,
      stripeSubscriptionLastUpdated: new Date(),
    },
  });
};

export const handleSubscriptionWebhookEvent = async (event: Stripe.Subscription) => {
  const { id: stripeSubscriptionId, status, customer } = event;

  // if customer is not a string, then the following line will throw an error
  if (typeof customer !== 'string') {
    console.error('Invalid customer ID:', customer);
    return;
  }

  updateTeamStatus(stripeSubscriptionId, status, customer, new Date(event.current_period_end * 1000));
};

export const updateBillingIfNecessary = async (team: Team) => {
  // if not updated in the last 24 hours, update the customer
  if (NODE_ENV === 'production')
    if (
      team.stripeSubscriptionLastUpdated &&
      Date.now() - team.stripeSubscriptionLastUpdated.getTime() < 24 * 60 * 60 * 1000
    ) {
      return;
    }

  if (!team.stripeCustomerId) {
    return;
  }

  // retrieve the customer
  const customer = await stripe.customers.retrieve(team.stripeCustomerId, {
    expand: ['subscriptions'],
  });

  // This should not happen, but if it does, we should not update the team
  if (customer.deleted) {
    console.error('Unexpected Error: Customer is deleted:', customer);
    return;
  }

  if (customer.subscriptions && customer.subscriptions.data.length === 1) {
    // if we have exactly one subscription, update the team
    const subscription = customer.subscriptions.data[0];
    await updateTeamStatus(
      subscription.id,
      subscription.status,
      team.stripeCustomerId,
      new Date(subscription.current_period_end * 1000)
    );
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
    // This should not happen.
    console.error('Unexpected Error: Unhandled number of subscriptions:', customer.subscriptions?.data);
  }
};
