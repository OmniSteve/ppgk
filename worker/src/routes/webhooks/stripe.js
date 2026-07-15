/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events. Verifies the signature using STRIPE_WEBHOOK_SECRET,
 * then fulfils orders on checkout.session.completed.
 *
 * Events handled:
 *   - checkout.session.completed  → mark order paid, confirm bookings, record payment, issue package credits
 *                                    (or, for a store order — see metadata.payment_type — mark it paid,
 *                                    confirm stock, and send store emails; never both)
 *   - payment_intent.payment_failed → mark the order failed
 *   - charge.refunded             → mark the matching coaching payment refunded; reconcile any
 *                                    attached refund objects into store_refunds for store orders
 *   - refund.created/updated/failed,
 *     charge.refund.updated       → reconcile the refund object into store_refunds (idempotent on
 *                                    stripe_refund_id) — covers refunds issued directly in the
 *                                    Stripe dashboard, not just the admin refund endpoint
 *
 * Every processed event is recorded in stripe_events (idempotency across retries).
 */
import { queryOne, query, execute } from '../../lib/db.js';
import { issuePackageCredits }      from '../../lib/credits.js';
import { confirmStockForOrder, releaseReservationsForOrder } from '../../lib/store.js';
import { sendStoreCustomerEmail, sendStoreAdminEmail } from '../../lib/storeEmail.js';

// Reject events whose signature timestamp is older/newer than this (replay protection)
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/** Constant-time comparison of two hex strings. */
function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify Stripe webhook signature using SubtleCrypto (Cloudflare Workers compatible).
 * Stripe signs with HMAC-SHA256 over `${timestamp}.${rawBody}`.
 * The header may carry multiple v1 signatures (e.g. during secret rotation).
 */
async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  let timestamp = null;
  const v1Signatures = [];
  for (const part of signatureHeader.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === 't') timestamp = v;
    if (k === 'v1') v1Signatures.push(v);
  }
  if (!timestamp || v1Signatures.length === 0) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > TIMESTAMP_TOLERANCE_SECONDS) return false;

  const encoder   = new TextEncoder();
  const key       = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signed    = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  const hex       = Array.from(new Uint8Array(signed)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return v1Signatures.some((sig) => timingSafeEqualHex(hex, sig));
}

/**
 * Record a payment row for a paid order. Idempotent — skips if a payment
 * already exists for this order or payment intent.
 */
async function recordPayment(env, { order, session, now }) {
  const paymentIntent = session.payment_intent ?? null;

  const existing = await queryOne(env,
    `SELECT id FROM payments
     WHERE order_id = ? OR (stripe_payment_intent IS NOT NULL AND stripe_payment_intent = ?)`,
    [order.id, paymentIntent]
  );
  if (existing) return existing.id;

  const paymentId = crypto.randomUUID();
  // amount_total is in the smallest currency unit; fall back to the server-computed order total
  const amount = Number.isFinite(session.amount_total)
    ? session.amount_total / 100
    : (order.total_amount ?? 0);
  const currency  = (session.currency || 'eur').toUpperCase();
  const reference = `PAY-${paymentId.slice(0, 8).toUpperCase()}`;

  await execute(env,
    `INSERT INTO payments
       (id, order_id, client_id, amount, currency, status, stripe_payment_intent, description, reference, paid_at)
     VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?)`,
    [paymentId, order.id, order.client_id, amount, currency, paymentIntent,
     `Stripe checkout for order ${order.id}`, reference, now]
  );
  return paymentId;
}

/**
 * Store order fulfilment — entirely separate from the coaching path above.
 * Dispatched by session.metadata.payment_type === 'store_order' so a
 * completed store checkout can never be mistaken for a coaching order (and
 * vice versa) and never issues coaching credits.
 */
async function handleStoreCheckoutCompleted(env, event) {
  const session = event.data.object;
  const orderId = session.metadata?.store_order_id;
  if (!orderId) {
    console.error('Stripe webhook: no store_order_id in metadata', session.id);
    return;
  }

  const order = await queryOne(env, 'SELECT * FROM store_orders WHERE id = ?', [orderId]);
  if (!order) {
    console.error('Stripe webhook: store order not found', orderId);
    return;
  }
  if (order.payment_status === 'paid') return; // idempotent — already processed

  const now = new Date().toISOString();
  await execute(env,
    `UPDATE store_orders SET payment_status = 'paid', stripe_payment_intent = ?, updated_at = ? WHERE id = ?`,
    [session.payment_intent ?? null, now, orderId]
  );

  await confirmStockForOrder(env, orderId);

  const paidOrder = { ...order, payment_status: 'paid' };
  await sendStoreCustomerEmail(env, { eventTrigger: 'store_order_confirmation', order: paidOrder });
  await sendStoreAdminEmail(env, { eventTrigger: 'store_new_order_admin', order: paidOrder });

  console.log('Stripe webhook: store order fulfilled', orderId);
}

async function handleStorePaymentFailed(env, event) {
  const intent  = event.data.object;
  const orderId = intent.metadata?.store_order_id;
  if (!orderId) return;

  const order = await queryOne(env, "SELECT * FROM store_orders WHERE id = ? AND payment_status = 'pending'", [orderId]);
  if (!order) return;

  const now = new Date().toISOString();
  await execute(env, `UPDATE store_orders SET payment_status = 'failed', updated_at = ? WHERE id = ?`, [now, orderId]);
  await releaseReservationsForOrder(env, orderId); // free the stock back up for other shoppers
  await sendStoreCustomerEmail(env, { eventTrigger: 'store_payment_failed', order });
  console.log('Stripe webhook: store order marked failed', orderId);
}

async function handleCheckoutCompleted(env, event) {
  const session = event.data.object;
  if (session.metadata?.payment_type === 'store_order') {
    return handleStoreCheckoutCompleted(env, event);
  }

  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error('Stripe webhook: no orderId in metadata', session.id);
    return;
  }

  // Idempotency — skip if already paid
  const order = await queryOne(env, 'SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) {
    console.error('Stripe webhook: order not found', orderId);
    return;
  }
  if (order.status === 'paid') return;

  const now = new Date().toISOString();

  // Mark order paid — column is stripe_payment_intent (not stripe_payment_intent_id)
  await execute(env,
    `UPDATE orders SET status = 'paid', stripe_payment_intent = ?, updated_at = ? WHERE id = ?`,
    [session.payment_intent ?? null, now, orderId]
  );

  // Record the payment so it appears in admin Payment Management and can be refunded
  await recordPayment(env, { order, session, now });

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

async function handlePaymentFailed(env, event) {
  const intent = event.data.object;
  if (intent.metadata?.payment_type === 'store_order') {
    return handleStorePaymentFailed(env, event);
  }

  const orderId = intent.metadata?.orderId;
  if (!orderId) return;

  const now = new Date().toISOString();
  await execute(env,
    `UPDATE orders SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'pending'`,
    [now, orderId]
  );
  console.log('Stripe webhook: order marked failed', orderId);
}

/**
 * Reconcile a single Stripe Refund object into store_refunds — the
 * authoritative refund ledger for store orders. Idempotent on
 * stripe_refund_id: a webhook re-delivery or a refund moving
 * pending -> succeeded/failed both resolve to a single up-to-date row.
 * Covers refunds issued directly in the Stripe dashboard, not just ones
 * created via the admin refund endpoint.
 */
async function reconcileStripeRefund(env, refundObj) {
  if (!refundObj || refundObj.object !== 'refund') return;
  const paymentIntentId = typeof refundObj.payment_intent === 'string' ? refundObj.payment_intent : refundObj.payment_intent?.id;
  if (!paymentIntentId) return;

  const order = await queryOne(env, 'SELECT id, currency FROM store_orders WHERE stripe_payment_intent = ?', [paymentIntentId]);
  if (!order) return; // not a store order — coaching payments are reconciled separately below

  const status = refundObj.status === 'succeeded' ? 'succeeded' : (refundObj.status === 'failed' ? 'failed' : 'pending');
  const now = new Date().toISOString();

  const existing = await queryOne(env, 'SELECT id, status FROM store_refunds WHERE stripe_refund_id = ?', [refundObj.id]);
  if (existing) {
    if (existing.status === status) return; // already reconciled at this status — no-op
    await execute(env, 'UPDATE store_refunds SET status = ?, updated_at = ? WHERE id = ?', [status, now, existing.id]);
  } else {
    await execute(env,
      `INSERT INTO store_refunds (id, order_id, stripe_refund_id, stripe_payment_intent_id, amount_cents, currency, status, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(stripe_refund_id) DO NOTHING`,
      [crypto.randomUUID(), order.id, refundObj.id, paymentIntentId, refundObj.amount ?? 0,
       (refundObj.currency || order.currency || 'eur').toUpperCase(), status, refundObj.reason ?? null]
    );
  }

  // Recompute the order's authoritative refunded total from succeeded refunds —
  // safer than incrementing, since a refund can move pending -> succeeded and
  // this event may be re-delivered.
  const sumRow = await queryOne(env,
    "SELECT COALESCE(SUM(amount_cents), 0) as total FROM store_refunds WHERE order_id = ? AND status = 'succeeded'", [order.id]);
  await execute(env, 'UPDATE store_orders SET amount_refunded_cents = ?, updated_at = ? WHERE id = ?', [sumRow?.total ?? 0, now, order.id]);

  console.log(`Stripe webhook: store refund ${refundObj.id} reconciled (status=${status}) for order ${order.id}`);
}

async function handleChargeRefunded(env, event) {
  const charge        = event.data.object;
  const paymentIntent = charge.payment_intent;
  if (!paymentIntent) return;

  const payment = await queryOne(env,
    'SELECT id, status FROM payments WHERE stripe_payment_intent = ?',
    [paymentIntent]
  );
  if (payment) {
    if (payment.status === 'refunded') return;
    const now = new Date().toISOString();
    await execute(env, `UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?`, [now, payment.id]);
    // Mark any pending refund rows for this payment as succeeded
    await execute(env, `UPDATE refunds SET status = 'succeeded', updated_at = ? WHERE payment_id = ? AND status = 'pending'`, [now, payment.id]);
    console.log('Stripe webhook: payment marked refunded', payment.id);
    return;
  }

  // Not a coaching payment — reconcile every refund object attached to this
  // charge into store_refunds (covers dashboard-issued refunds; the
  // admin-initiated flow in admin/store/orders.js already writes its own row
  // and this is idempotent against that via stripe_refund_id).
  const refundObjects = charge.refunds?.data ?? [];
  for (const refundObj of refundObjects) {
    await reconcileStripeRefund(env, { ...refundObj, payment_intent: refundObj.payment_intent ?? paymentIntent });
  }
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

  // Event-level idempotency — Stripe retries deliveries; skip already-processed events
  if (event.id) {
    const seen = await queryOne(env,
      'SELECT id FROM stripe_events WHERE stripe_event_id = ?', [event.id]);
    if (seen) {
      return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200 });
    }
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(env, event);
    } else if (event.type === 'payment_intent.payment_failed') {
      await handlePaymentFailed(env, event);
    } else if (event.type === 'charge.refunded') {
      await handleChargeRefunded(env, event);
    } else if (['refund.created', 'refund.updated', 'refund.failed', 'charge.refund.updated'].includes(event.type)) {
      await reconcileStripeRefund(env, event.data.object);
    }

    if (event.id) {
      await execute(env,
        `INSERT INTO stripe_events (id, stripe_event_id, event_type) VALUES (?, ?, ?)
         ON CONFLICT(stripe_event_id) DO NOTHING`,
        [crypto.randomUUID(), event.id, event.type ?? 'unknown']
      );
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
