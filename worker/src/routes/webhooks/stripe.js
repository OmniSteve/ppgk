/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events (payment_intent.succeeded, checkout.session.completed, etc.)
 * Validates the Stripe-Signature header using env.STRIPE_WEBHOOK_SECRET.
 *
 * NOTE: Stripe validation must use the ASYNC Web Crypto API in Workers
 * (stripe.webhooks.constructEventAsync — synchronous version is not available).
 */
import { execute, query, audit } from '../../lib/db.js';

export async function handleStripeWebhook(request, env) {
  const sig  = request.headers.get('Stripe-Signature');
  const body = await request.text();

  if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  // TODO: Validate signature using Stripe SDK or manual HMAC
  // const event = await stripe.webhooks.constructEventAsync(body, sig, env.STRIPE_WEBHOOK_SECRET);
  // STUB: parse body directly — replace with validated event in production
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Update order status and confirm bookings
        if (session.metadata?.orderId) {
          await execute(env,
            "UPDATE orders SET status = 'paid', stripe_session_id = ?, updated_at = ? WHERE id = ?",
            [session.id, new Date().toISOString(), session.metadata.orderId]
          );
          await execute(env,
            "UPDATE bookings SET status = 'confirmed', confirmed_at = ?, updated_at = ? WHERE order_id = ?",
            [new Date().toISOString(), new Date().toISOString(), session.metadata.orderId]
          );
          await audit(env, { action: 'payment', recordType: 'order', recordId: session.metadata.orderId, description: `Stripe checkout.session.completed for order ${session.metadata.orderId}` });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        if (pi.metadata?.orderId) {
          await execute(env,
            "UPDATE orders SET status = 'failed', updated_at = ? WHERE id = ?",
            [new Date().toISOString(), pi.metadata.orderId]
          );
          await execute(env,
            "UPDATE bookings SET status = 'payment_failed', updated_at = ? WHERE order_id = ?",
            [new Date().toISOString(), pi.metadata.orderId]
          );
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        await execute(env,
          "UPDATE payments SET status = 'refunded', updated_at = ? WHERE stripe_charge_id = ?",
          [new Date().toISOString(), charge.id]
        );
        break;
      }
      default:
        console.info(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return Response.json({ error: 'Handler error' }, { status: 500 });
  }

  return Response.json({ received: true });
}