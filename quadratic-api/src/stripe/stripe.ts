import Stripe from 'stripe';
import dbClient from '../dbClient';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('No STRIPE_SECRET_KEY found');
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('No STRIPE_WEBHOOK_SECRET found');
}

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  typescript: true,
});

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
  const numUsersOnTeam = await dbClient.userTeamRole.count({
    where: {
      teamId,
    },
  });

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

export const createSubscription = async (customerId: string, priceId: string, quantity: number) => {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [
      {
        price: priceId,
        quantity,
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

export const createBillingPortalSession = async (teamUuid: string) => {
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
    // TODO: change this to the actual frontend URL
    return_url: `http://localhost:3000/teams/${teamUuid}`,
  });
};

export const createCheckoutSession = async (teamUuid: string, priceId: string) => {
  const team = await dbClient.team.findUnique({
    where: {
      uuid: teamUuid,
    },
  });

  if (!team?.stripeCustomerId) {
    throw new Error('Team does not have a stripe customer. Cannot create checkout session.');
  }

  return stripe.checkout.sessions.create({
    customer: team?.stripeCustomerId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `http://localhost:3000/teams/${teamUuid}`,
    cancel_url: `http://localhost:3000/teams/${teamUuid}`,
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
