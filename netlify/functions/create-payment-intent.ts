import { Handler, HandlerEvent } from '@netlify/functions';
import stripe from 'stripe';

const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { amount } = JSON.parse(event.body || '{}');

    if (!amount || typeof amount !== 'number') {
      return { statusCode: 400, body: 'Invalid amount' };
    }

    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: amount,
      currency: 'usd', // You can make this dynamic if needed
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error creating payment intent' }),
    };
  }
};

export { handler };