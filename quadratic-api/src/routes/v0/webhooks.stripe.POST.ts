import type { Request, Response } from 'express';
import { STRIPE_WEBHOOK_SECRET } from '../../env-vars';
import { handleSubscriptionWebhookEvent, stripe } from '../../stripe/stripe';

export default [handler];

async function handler(req: Request, res: Response) {
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
      await handleSubscriptionWebhookEvent(event.data.object);
      break;
    default:
      console.log(JSON.stringify({ message: `Unhandled event type`, eventType: event.type }));
  }

  // Return a 200 response to acknowledge receipt of the event
  res.json({ received: true });
}
