/**
 * Admin store order management.
 * GET    /api/admin/store/orders
 * GET    /api/admin/store/orders/:id
 * PATCH  /api/admin/store/orders/:id             — fulfilment status transitions
 * POST   /api/admin/store/orders/:id/refund       — issue a REAL Stripe refund
 * POST   /api/admin/store/orders/:id/notes        — internal admin note
 * POST   /api/admin/store/orders/:id/archive      — hide from default list, preserve everything
 * POST   /api/admin/store/orders/:id/restore      — un-archive
 * DELETE /api/admin/store/orders/:id              — hard delete (test orders only, strictly gated)
 */
import { requireRole } from '../../../lib/auth.js';
import { query, queryOne, execute, batch, audit } from '../../../lib/db.js';
import { toCamel, toCamelArray } from '../../../lib/serializers.js';
import { sendStoreCustomerEmail } from '../../../lib/storeEmail.js';
import { computeRefundSummary, restoreStockForItems } from '../../../lib/store.js';

const FULFILMENT_STATUSES = ['pending', 'processing', 'ready_for_collection', 'dispatched', 'completed', 'cancelled'];
const NON_FULFILLED_STATUSES = ['pending', 'processing', 'ready_for_collection', 'cancelled'];
const EMAIL_BY_STATUS = {
  ready_for_collection: 'store_ready_for_collection',
  dispatched: 'store_dispatched',
  cancelled: 'store_order_cancelled',
};

async function recordStatusChange(env, { orderId, fromStatus, toStatus, actorId, note }) {
  await execute(env,
    `INSERT INTO store_order_status_history (id, order_id, from_status, to_status, actor_id, note) VALUES (?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), orderId, fromStatus ?? null, toStatus, actorId ?? null, note ?? null]
  );
}

/** Resolve a usable PaymentIntent ID for an order, fetching it from the Checkout Session if not already stored. */
async function resolvePaymentIntent(env, order) {
  if (order.stripe_payment_intent) return { paymentIntentId: order.stripe_payment_intent };
  if (!order.stripe_session_id) return { error: 'This order has no Stripe Checkout Session or PaymentIntent on record — it cannot be refunded through Stripe' };

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${order.stripe_session_id}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` },
  });
  if (!res.ok) return { error: 'Could not look up this order\'s Stripe Checkout Session' };
  const session = await res.json();
  if (!session.payment_intent) return { error: 'The Stripe Checkout Session for this order has no PaymentIntent (payment may not have completed)' };

  await execute(env, 'UPDATE store_orders SET stripe_payment_intent = ?, updated_at = ? WHERE id = ?',
    [session.payment_intent, new Date().toISOString(), order.id]);
  return { paymentIntentId: session.payment_intent };
}

/** Hard-delete eligibility — deliberately conservative. See plan for rationale. */
function getOrderDeleteEligibility(order, refundSummary) {
  const reasons = [];
  if (!order.is_test_order) reasons.push('Order is not flagged as a test order');
  if (!NON_FULFILLED_STATUSES.includes(order.fulfilment_status)) reasons.push(`Order has fulfilment history (status: ${order.fulfilment_status})`);
  if (order.payment_status === 'paid' && refundSummary.status !== 'full') {
    reasons.push('Order has a captured payment that has not been fully refunded');
  }
  return { eligible: reasons.length === 0, blockingReasons: reasons };
}

export async function handleAdminStoreOrders(request, env, ctx, params) {
  const actor = await requireRole(request, env, 'admin');
  const url = new URL(request.url);
  const method = request.method;

  // ── POST /:id/refund — real Stripe refund ────────────────────────────────
  if (params?.id && url.pathname.endsWith('/refund') && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { amount, reason, adminNote, restoreInventory, restoreItems } = body;

    const order = await queryOne(env, 'SELECT * FROM store_orders WHERE id = ?', [params.id]);
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });
    if (order.payment_status !== 'paid') return Response.json({ message: 'This order has not been paid — nothing to refund' }, { status: 400 });
    if (!env.STRIPE_SECRET) return Response.json({ message: 'Payment processing is not configured' }, { status: 503 });

    const { paymentIntentId, error: piError } = await resolvePaymentIntent(env, order);
    if (piError) return Response.json({ message: piError }, { status: 400 });

    const summary = await computeRefundSummary(env, order);
    const remainingCents = summary.remainingCents;
    if (remainingCents <= 0) return Response.json({ message: 'This order has already been fully refunded' }, { status: 409 });

    const amountCents = amount != null && amount !== '' ? Math.round(Number(amount) * 100) : remainingCents;
    if (!Number.isFinite(amountCents) || amountCents <= 0 || amountCents > remainingCents) {
      return Response.json({ message: `Refund amount must be between 0.01 and ${(remainingCents / 100).toFixed(2)}` }, { status: 400 });
    }

    const formData = new URLSearchParams();
    formData.set('payment_intent', paymentIntentId);
    formData.set('amount', String(amountCents));
    if (reason) formData.set('reason', reason);
    const stripeRes = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `ppgk-store-refund-${order.id}-${summary.refunds.length}`,
      },
      body: formData.toString(),
    });

    if (!stripeRes.ok) {
      const stripeErr = await stripeRes.json().catch(() => ({}));
      console.error('Stripe store refund failed:', stripeErr);
      const detail = stripeErr?.error?.message ? ` (${stripeErr.error.message})` : '';
      return Response.json({ message: `Stripe refund failed${detail}` }, { status: 502 });
    }

    const stripeRefund = await stripeRes.json();
    const now = new Date().toISOString();
    const refundId = crypto.randomUUID();
    const refundStatus = stripeRefund.status === 'succeeded' ? 'succeeded' : (stripeRefund.status === 'failed' ? 'failed' : 'pending');
    const wantsRestore = restoreInventory === true;

    const statements = [
      {
        sql: `INSERT INTO store_refunds (id, order_id, stripe_refund_id, stripe_payment_intent_id, amount_cents, currency, status, reason, admin_note, restore_inventory, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [refundId, order.id, stripeRefund.id ?? null, paymentIntentId, amountCents, (order.currency || 'EUR'),
          refundStatus, reason ?? null, adminNote ?? null, wantsRestore ? 1 : 0, actor.sub],
      },
    ];
    if (refundStatus === 'succeeded') {
      statements.push({
        sql: 'UPDATE store_orders SET amount_refunded_cents = amount_refunded_cents + ?, updated_at = ? WHERE id = ?',
        params: [amountCents, now, order.id],
      });
    }

    try {
      await batch(env, statements);
    } catch (err) {
      console.error(`CRITICAL: Stripe refund ${stripeRefund.id} succeeded but DB batch failed for store order ${order.id}:`, err);
      return Response.json({
        message: 'Refund was issued with Stripe but recording it locally failed — check the audit log and Stripe dashboard before retrying',
      }, { status: 500 });
    }

    await recordStatusChange(env, {
      orderId: order.id, fromStatus: order.fulfilment_status, toStatus: order.fulfilment_status, actorId: actor.sub,
      note: `Refund of ${(amountCents / 100).toFixed(2)} ${order.currency || 'EUR'} issued via Stripe (${stripeRefund.id}, status: ${refundStatus}).${adminNote ? ` ${adminNote}` : ''}`,
    });

    // Inventory restoration — never automatic; only what the admin explicitly selected.
    let itemsRestored = 0;
    if (wantsRestore && refundStatus === 'succeeded') {
      let lines = [];
      if (Array.isArray(restoreItems) && restoreItems.length > 0) {
        lines = restoreItems.filter((l) => l.quantity > 0).map((l) => ({ productId: l.productId, variantId: l.variantId ?? null, quantity: l.quantity }));
      } else {
        const items = await query(env, 'SELECT * FROM store_order_items WHERE order_id = ?', [order.id]);
        lines = items.map((i) => ({ productId: i.product_id, variantId: i.variant_id, quantity: i.quantity }));
      }
      const result = await restoreStockForItems(env, { orderId: order.id, lines, performedBy: actor.sub, refundId });
      itemsRestored = result.itemsAdjusted;
    }

    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'refund', recordType: 'store_order', recordId: order.id,
      description: `Refund of ${(amountCents / 100).toFixed(2)} ${order.currency || 'EUR'} issued via Stripe (${stripeRefund.id}) for order ${order.order_number}.` +
        (wantsRestore ? ` ${itemsRestored} item line(s) restored to stock.` : ''),
      newValue: { refundId, stripeRefundId: stripeRefund.id, amountCents, refundStatus, restoreInventory: wantsRestore, itemsRestored },
      reason: adminNote ?? reason ?? null,
    });

    if (refundStatus === 'succeeded') {
      await sendStoreCustomerEmail(env, {
        eventTrigger: 'store_refund_confirmed', order,
        extraVariables: { refund_amount: `€${(amountCents / 100).toFixed(2)}` },
      });
    }

    const newSummary = await computeRefundSummary(env, { ...order, total: order.total });
    return Response.json({
      success: true,
      refund_id: stripeRefund.id,
      status: refundStatus,
      refunded_amount: amountCents / 100,
      remaining_refundable_amount: newSummary.remainingCents / 100,
    });
  }

  if (params?.id && url.pathname.endsWith('/notes') && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (!body.note) return Response.json({ message: 'note is required' }, { status: 400 });
    const order = await queryOne(env, 'SELECT fulfilment_status FROM store_orders WHERE id = ?', [params.id]);
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });
    await recordStatusChange(env, { orderId: params.id, fromStatus: order.fulfilment_status, toStatus: order.fulfilment_status, actorId: actor.sub, note: body.note });
    return Response.json({ message: 'Note added' });
  }

  // ── POST /:id/archive ─────────────────────────────────────────────────────
  if (params?.id && url.pathname.endsWith('/archive') && method === 'POST') {
    const order = await queryOne(env, 'SELECT * FROM store_orders WHERE id = ?', [params.id]);
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });
    if (order.archived_at) return Response.json({ message: 'Order is already archived' }, { status: 409 });

    const now = new Date().toISOString();
    await execute(env, 'UPDATE store_orders SET archived_at = ?, archived_by = ?, updated_at = ? WHERE id = ?', [now, actor.sub, now, params.id]);
    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'archive', recordType: 'store_order', recordId: params.id,
      description: `Order ${order.order_number} archived`,
    });
    return Response.json({ message: 'Order archived' });
  }

  // ── POST /:id/restore ─────────────────────────────────────────────────────
  if (params?.id && url.pathname.endsWith('/restore') && method === 'POST') {
    const order = await queryOne(env, 'SELECT * FROM store_orders WHERE id = ?', [params.id]);
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });
    if (!order.archived_at) return Response.json({ message: 'Order is not archived' }, { status: 409 });

    await execute(env, 'UPDATE store_orders SET archived_at = NULL, archived_by = NULL, updated_at = ? WHERE id = ?', [new Date().toISOString(), params.id]);
    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'restore', recordType: 'store_order', recordId: params.id,
      description: `Order ${order.order_number} restored from archive`,
    });
    return Response.json({ message: 'Order restored' });
  }

  // ── DELETE /:id — hard delete, strictly gated ────────────────────────────
  if (params?.id && !url.pathname.endsWith('/refund') && !url.pathname.endsWith('/notes')
      && !url.pathname.endsWith('/archive') && !url.pathname.endsWith('/restore') && method === 'DELETE') {
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'DELETE') return Response.json({ message: 'Type DELETE to confirm permanent deletion' }, { status: 400 });

    const order = await queryOne(env, 'SELECT * FROM store_orders WHERE id = ?', [params.id]);
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });

    const summary = await computeRefundSummary(env, order);
    const eligibility = getOrderDeleteEligibility(order, summary);
    if (!eligibility.eligible) return Response.json({ message: 'This order cannot be permanently deleted', ...eligibility }, { status: 409 });

    await batch(env, [
      {
        sql: `INSERT INTO audit_log (actor_id, actor_name, action, record_type, record_id, description, previous_value, reason)
              VALUES (?, ?, 'delete', 'store_order', ?, ?, ?, ?)`,
        params: [actor.sub, `${actor.firstName} ${actor.lastName}`, params.id,
          `Test order permanently deleted: ${order.order_number}`, JSON.stringify({ id: order.id, orderNumber: order.order_number }), body.reason ?? null],
      },
      { sql: 'DELETE FROM store_orders WHERE id = ?', params: [params.id] },
    ]);
    return Response.json({ message: 'Order permanently deleted' });
  }

  if (params?.id && method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    const { fulfilmentStatus, note, isTestOrder } = body;

    const order = await queryOne(env, 'SELECT * FROM store_orders WHERE id = ?', [params.id]);
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });

    if (isTestOrder !== undefined) {
      await execute(env, 'UPDATE store_orders SET is_test_order = ?, updated_at = ? WHERE id = ?', [isTestOrder ? 1 : 0, new Date().toISOString(), params.id]);
      await audit(env, {
        actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
        action: 'update', recordType: 'store_order', recordId: params.id,
        description: `Order ${order.order_number} marked as ${isTestOrder ? '' : 'not '}a test order`,
      });
    }

    if (fulfilmentStatus !== undefined) {
      if (!FULFILMENT_STATUSES.includes(fulfilmentStatus)) {
        return Response.json({ message: `fulfilmentStatus must be one of: ${FULFILMENT_STATUSES.join(', ')}` }, { status: 400 });
      }
      await execute(env, 'UPDATE store_orders SET fulfilment_status = ?, updated_at = ? WHERE id = ?', [fulfilmentStatus, new Date().toISOString(), params.id]);
      await recordStatusChange(env, { orderId: params.id, fromStatus: order.fulfilment_status, toStatus: fulfilmentStatus, actorId: actor.sub, note });
      await audit(env, {
        actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
        action: 'update', recordType: 'store_order', recordId: params.id,
        description: `Order ${order.order_number} fulfilment status: ${order.fulfilment_status} → ${fulfilmentStatus}`,
        previousValue: { fulfilmentStatus: order.fulfilment_status }, newValue: { fulfilmentStatus }, reason: note ?? null,
      });

      const eventTrigger = EMAIL_BY_STATUS[fulfilmentStatus];
      if (eventTrigger) {
        await sendStoreCustomerEmail(env, {
          eventTrigger, order,
          extraVariables: fulfilmentStatus === 'cancelled' ? { cancellation_note: note || '' } : {},
        });
      }
    }
    return Response.json({ message: 'Order updated' });
  }

  if (params?.id && method === 'GET') {
    const order = await queryOne(env, 'SELECT * FROM store_orders WHERE id = ?', [params.id]);
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });
    const [items, history, refundSummary] = await Promise.all([
      query(env, 'SELECT * FROM store_order_items WHERE order_id = ?', [params.id]),
      query(env, `SELECT h.*, u.first_name || ' ' || u.last_name as actor_name FROM store_order_status_history h LEFT JOIN users u ON u.id = h.actor_id WHERE h.order_id = ? ORDER BY h.created_at`, [params.id]),
      computeRefundSummary(env, order),
    ]);
    const camel = toCamel(order);
    camel.items = toCamelArray(items);
    camel.statusHistory = toCamelArray(history);
    camel.refundSummary = toCamel({
      paid_amount: refundSummary.paidCents / 100,
      refunded_amount: refundSummary.refundedCents / 100,
      remaining_refundable_amount: refundSummary.remainingCents / 100,
      status: refundSummary.status,
    });
    camel.refunds = toCamelArray(refundSummary.refunds);
    const deleteEligibility = getOrderDeleteEligibility(order, refundSummary);
    camel.deleteEligibility = deleteEligibility;
    return Response.json(camel);
  }

  // ── List ─────────────────────────────────────────────────────────────────
  const paymentStatus = url.searchParams.get('paymentStatus') || '';
  const fulfilmentStatus = url.searchParams.get('fulfilmentStatus') || '';
  const deliveryMethod = url.searchParams.get('deliveryMethod') || '';
  const customerEmail = url.searchParams.get('customerEmail') || '';
  const orderNumber = url.searchParams.get('orderNumber') || '';
  const archived = url.searchParams.get('archived') || ''; // '' = active only, 'true' = archived only, 'all' = both
  const isTestOrder = url.searchParams.get('isTestOrder') || '';
  const sort = url.searchParams.get('sort') === 'oldest' ? 'created_at ASC' : 'created_at DESC';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  const conditions = ['1=1'];
  const bindings = [];
  if (paymentStatus) { conditions.push('payment_status = ?'); bindings.push(paymentStatus); }
  if (fulfilmentStatus) { conditions.push('fulfilment_status = ?'); bindings.push(fulfilmentStatus); }
  if (deliveryMethod) { conditions.push('delivery_method = ?'); bindings.push(deliveryMethod); }
  if (customerEmail) { conditions.push('customer_email LIKE ?'); bindings.push(`%${customerEmail}%`); }
  if (orderNumber) { conditions.push('order_number LIKE ?'); bindings.push(`%${orderNumber}%`); }
  if (isTestOrder === 'true') conditions.push('is_test_order = 1');
  if (archived === 'true') conditions.push('archived_at IS NOT NULL');
  else if (archived !== 'all') conditions.push('archived_at IS NULL');
  const where = conditions.join(' AND ');

  const [orders, countRow] = await Promise.all([
    query(env, `SELECT * FROM store_orders WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`, [...bindings, limit, offset]),
    queryOne(env, `SELECT COUNT(*) as count FROM store_orders WHERE ${where}`, bindings),
  ]);

  return Response.json({ orders: toCamelArray(orders), total: countRow?.count ?? 0 });
}
