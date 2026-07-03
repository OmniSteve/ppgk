/**
 * POST /api/webhooks/stripe
 *
 * Full Stripe webhook implementation:
 * - Reads raw body BEFORE parsing
 * - Validates Stripe-Signature using HMAC-SHA256 (Web Crypto, async)
 * - Idempotent event processing via stripe_event_id
 * - Confirms bookings only after verified payment
 * - Issues package credits only after verified payment
 * - Updates order and payment records
 */
import { queryOne, execute, query, audit } from '../../lib/db.js';
import { issuePackageCredits }             from '../../lib/credits.js';
import { sendTemplatedEmail }              from '../../lib/email.js';

// ─── Stripe signature verification (Web Crypto, async) ────────────────────────
async function verifyStripeSignature(rawBody, sigHeader, secret) {
  // sigHeader format: t=<timestamp>,v1=<sig>,...
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [key, val] = part.split('=');
    if (key === 't')  acc.timestamp = val;
    if (key === 'v1') acc.signatures.push(val);
    return acc;
  }, { timestamp: null, signatures: [] });

  if (!parts.timestamp || parts.signatures.length === 0) throw new Error('Invalid Stripe-Signature header');

  // Replay protection: reject webhooks older than 5 minutes
  const tsDiff = Math.abs(Date.now() / 1000 - parseInt(parts.timestamp));
  if (tsDiff > 300) throw new Error('Stripe webhook timestamp too old');

  const payload = `${parts.timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  const valid = parts.signatures.some(s => s === computed);
  if (!valid) throw new Error('Stripe signature verification failed');
  return true;
}

// ─── Idempotency guard ────────────────────────────────────────────────────────
async function alreadyProcessed(env, stripeEventId) {
  const row = await queryOne(env,
    'SELECT id FROM stripe_events WHERE stripe_event_id = ?',
    [stripeEventId]
  );
  return !!row;
}

async function markProcessed(env, stripeEventId, eventType) {
  await execute(env,
    `INSERT OR IGNORE INTO stripe_events (id, stripe_event_id, event_type, processed_at)
     VALUES (?, ?, ?, ?)`,
    [crypto.randomUUID(), stripeEventId, eventType, new Date().toISOString()]
  );
}

// ─── Event handlers ───────────────────────────────────────────────────────────
async function onCheckoutSessionCompleted(env, session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  const order = await queryOne(env, 'SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return;

  const now = new Date().toISOString();

  // Update order
  await execute(env,
    `UPDATE orders SET status='paid', stripe_session_id=?, stripe_payment_intent=?, updated_at=? WHERE id=?`,
    [session.id, session.payment_intent, now, orderId]
  );

  // Create payment record
  const paymentId = crypto.randomUUID();
  const ref = `PAY-${orderId.slice(0,8).toUpperCase()}`;
  await execute(env,
    `INSERT OR IGNORE INTO payments (id, order_id, client_id, amount, currency, status,
      stripe_payment_intent, description, reference, paid_at)
     VALUES (?,?,?,?,?,   'paid',  ?,        ?,        ?,   ?)`,
    [paymentId, orderId, order.client_id, order.total_amount, order.currency,
     session.payment_intent, `Order ${ref}`, ref, now]
  );

  // Confirm bookings
  const bookings = await query(env,
    `SELECT b.id, b.player_id, b.session_id, b.credits_used,
            s.title, s.session_date, s.start_time,
            u.email, u.first_name
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     JOIN users u ON u.id = b.client_id
     WHERE b.order_id = ?`,
    [orderId]
  );

  for (const b of bookings) {
    await execute(env,
      "UPDATE bookings SET status='confirmed', confirmed_at=?, amount_charged=?, updated_at=? WHERE id=?",
      [now, session.metadata?.perSessionAmount ?? 0, now, b.id]
    );
    await sendTemplatedEmail(env, {
      eventTrigger:  'booking_confirmed',
      to:             b.email,
      userId:         order.client_id,
      bookingId:      b.id,
      idempotencyRef: `booking_confirmed_${b.id}`,
      variables: {
        first_name:    b.first_name,
        session_title: b.title,
        session_date:  b.session_date,
        session_time:  b.start_time,
      },
    });
  }

  // Issue package credits if this was a package purchase
  const packageItems = await query(env,
    'SELECT * FROM order_items WHERE order_id = ? AND item_type = ?',
    [orderId, 'package_purchase']
  );

  for (const item of packageItems) {
    const pkgDef = await queryOne(env,
      'SELECT * FROM package_definitions WHERE id = ?',
      [item.package_definition_id]
    );
    if (!pkgDef) continue;

    const validFrom  = now;
    const expiresAt  = new Date(Date.now() + pkgDef.validity_months * 30 * 24 * 3600 * 1000).toISOString();
    const purchaseId = crypto.randomUUID();

    // Idempotent purchase record
    const existingPurchase = await queryOne(env,
      'SELECT id FROM package_purchases WHERE order_id = ? AND package_definition_id = ?',
      [orderId, pkgDef.id]
    );

    let effectivePurchaseId = existingPurchase?.id;
    if (!existingPurchase) {
      await execute(env,
        `INSERT INTO package_purchases (id, client_id, order_id, package_definition_id, credits_granted, price_paid, valid_from, expires_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [purchaseId, order.client_id, orderId, pkgDef.id, pkgDef.credits, pkgDef.price, validFrom, expiresAt]
      );
      effectivePurchaseId = purchaseId;
    }

    await issuePackageCredits(env, {
      clientId:          order.client_id,
      packagePurchaseId: effectivePurchaseId,
      credits:           pkgDef.credits,
      expiresAt,
      description:       `Package purchase: ${pkgDef.name}`,
    });

    // Package confirmation email
    const user = await queryOne(env, 'SELECT email, first_name FROM users WHERE id = ?', [order.client_id]);
    await sendTemplatedEmail(env, {
      eventTrigger:  'payment_received',
      to:             user?.email,
      userId:         order.client_id,
      idempotencyRef: `payment_received_${orderId}`,
      variables: {
        first_name:    user?.first_name,
        package_name:  pkgDef.name,
        credits:       pkgDef.credits,
        expires_at:    expiresAt.slice(0, 10),
        amount:        pkgDef.price,
      },
    });
  }

  await audit(env, {
    action: 'payment', recordType: 'order', recordId: orderId,
    description: `Stripe checkout.session.completed — order ${orderId} confirmed`,
  });
}

async function onPaymentIntentFailed(env, pi) {
  const order = await queryOne(env,
    'SELECT id FROM orders WHERE stripe_payment_intent = ?',
    [pi.id]
  );
  if (!order) return;
  const now = new Date().toISOString();
  await execute(env, "UPDATE orders SET status='failed', updated_at=? WHERE id=?", [now, order.id]);
  await execute(env,
    "UPDATE bookings SET status='payment_failed', updated_at=? WHERE order_id=?",
    [now, order.id]
  );

  const bookings = await query(env,
    `SELECT b.id, b.session_id, u.email, u.first_name
     FROM bookings b JOIN users u ON u.id = b.client_id
     WHERE b.order_id = ?`,
    [order.id]
  );
  for (const b of bookings) {
    await execute(env,
      'UPDATE sessions SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0',
      [b.session_id]
    );
    await sendTemplatedEmail(env, {
      eventTrigger:  'payment_failed',
      to:             b.email,
      userId:         null,
      idempotencyRef: `payment_failed_${order.id}`,
      variables: { first_name: b.first_name },
    });
  }
}

async function onChargeRefunded(env, charge) {
  await execute(env,
    "UPDATE payments SET status='refunded', updated_at=? WHERE stripe_charge_id=?",
    [new Date().toISOString(), charge.id]
  );
  await execute(env,
    `UPDATE refunds SET status='succeeded', stripe_refund_id=?, updated_at=? WHERE payment_id=(
       SELECT id FROM payments WHERE stripe_charge_id=? LIMIT 1
     )`,
    [charge.refunds?.data?.[0]?.id ?? null, new Date().toISOString(), charge.id]
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function handleStripeWebhook(request, env) {
  // Read raw body BEFORE any parsing
  const rawBody = await request.text();
  const sig     = request.headers.get('Stripe-Signature');

  if (!sig) return Response.json({ error: 'Missing Stripe-Signature' }, { status: 400 });
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  try {
    await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.warn('Stripe signature verification failed:', e.message);
    return Response.json({ error: e.message }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Idempotency
  if (await alreadyProcessed(env, event.id)) {
    return Response.json({ received: true, skipped: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await onCheckoutSessionCompleted(env, event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await onPaymentIntentFailed(env, event.data.object);
        break;
      case 'charge.refunded':
        await onChargeRefunded(env, event.data.object);
        break;
      default:
        console.info(`Unhandled Stripe event: ${event.type}`);
    }

    await markProcessed(env, event.id, event.type);
    return Response.json({ received: true });
  } catch (e) {
    console.error('Stripe webhook handler error:', e);
    return Response.json({ error: 'Handler error' }, { status: 500 });
  }
}