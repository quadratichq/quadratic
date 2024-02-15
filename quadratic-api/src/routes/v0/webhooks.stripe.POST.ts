import { SubscriptionStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { Stripe } from 'stripe';
import dbClient from '../../dbClient';
import { STRIPE_WEBHOOK_SECRET, stripe } from '../../stripe/stripe';

export default [handler];

async function handler(req: Request, res: Response) {
  console.log('webhook hit');

  const sig = req.headers['stripe-signature']?.toString();

  if (!sig) {
    return res.status(400).send('No signature');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionUpdate(event.data.object);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
}

async function handleSubscriptionUpdate(event: Stripe.Subscription) {
  const { id: stripeSubscriptionId, status, customer } = event;

  // if customer is not a string, then the following line will throw an error
  if (typeof customer !== 'string') {
    console.error('Invalid customer ID:', customer);
    return;
  }

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
    where: { stripeCustomerId: customer },
    data: {
      stripeSubscriptionId,
      stripeSubscriptionStatus,
      stripeCurrentPeriodEnd: new Date(event.current_period_end * 1000),
    },
  });
}
