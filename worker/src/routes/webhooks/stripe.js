/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events. Verifies the signature using STRIPE_WEBHOOK_SECRET,
 * then fulfils orders on checkout.session.completed.
 */
import { queryOne, query, execute } from '../../lib/db.js';
import { issuePackageCredits }      from '../../lib/credits.js';

/**
 * Verify Stripe webhook signature using SubtleCrypto (Cloudflare Workers compatible).
 * Stripe signs with HMAC-SHA256 over `${timestamp}.${rawBody}`.
 */
async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  // Parse t= and v1= from header
  const parts    = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=')));
  const timestamp = parts['t'];
  const v1        = parts['v1'];
  if (!timestamp || !v1) return false;

  const encoder   = new TextEncoder();
  const key       = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signed    = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  const hex       = Array.from(new Uint8Array(signed)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === v1;
}

export async function handleStripeWebhook(request, env) {
  const rawBody   = await request.text();
  const sigHeader = request.headers.get('stripe-signature');

  const valid = await verifyStripeSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    console.error('Stripe webhook signature verification failed');
    return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (!orderId) {
        console.error('Stripe webhook: no orderId in metadata', session.id);
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      // Idempotency — skip if already paid
      const order = await queryOne(env, 'SELECT * FROM orders WHERE id = ?', [orderId]);
      if (!order) {
        console.error('Stripe webhook: order not found', orderId);
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }
      if (order.status === 'paid') {
        return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200 });
      }

      const now = new Date().toISOString();

      // Mark order paid — column is stripe_payment_intent (not stripe_payment_intent_id)
      await execute(env,
        `UPDATE orders SET status = 'paid', stripe_payment_intent = ?, updated_at = ? WHERE id = ?`,
        [session.payment_intent ?? null, now, orderId]
      );

      // Confirm any session bookings on this order
      await execute(env,
        `UPDATE bookings SET status = 'confirmed', confirmed_at = ?, updated_at = ? WHERE order_id = ? AND status = 'pending_payment'`,
        [now, now, orderId]
      );

      // Handle package purchases — issue credits
      const items = await query(env,
        `SELECT oi.*, pd.credits, pd.validity_months, pd.name, pd.price AS pkg_price
         FROM order_items oi
         JOIN package_definitions pd ON pd.id = oi.package_definition_id
         WHERE oi.order_id = ? AND oi.item_type = 'package_purchase'`,
        [orderId]
      );

      for (const item of items) {
        // Idempotency — skip if already created
        let pkgPurchase = await queryOne(env,
          'SELECT id FROM package_purchases WHERE order_id = ? AND package_definition_id = ?',
          [orderId, item.package_definition_id]
        );

        if (!pkgPurchase) {
          const pkgPurchaseId = crypto.randomUUID();
          const expiresAt = item.validity_months
            ? new Date(Date.now() + item.validity_months * 30 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 3 * 30 * 24 * 60 * 60 * 1000).toISOString();
          await execute(env,
            `INSERT INTO package_purchases (id, client_id, package_definition_id, order_id, credits_granted, credits_remaining, price_paid, status, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
            [pkgPurchaseId, order.client_id, item.package_definition_id, orderId, item.credits, item.credits, item.pkg_price ?? item.unit_price ?? 0, expiresAt]
          );
          pkgPurchase = { id: pkgPurchaseId };

          await issuePackageCredits(env, {
            clientId:          order.client_id,
            packagePurchaseId: pkgPurchaseId,
            credits:           item.credits,
            expiresAt,
            description:       `Credits from ${item.name}`,
          });
        }
      }

      console.log('Stripe webhook: order fulfilled', orderId);
    }
  } catch (err) {
    console.error('Stripe webhook processing error:', err);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}