import { stripeWebhookHandler } from '../lib/stripe-webhook';

export const handler = stripeWebhookHandler();
