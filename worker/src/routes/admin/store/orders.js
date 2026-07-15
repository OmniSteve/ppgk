/**
 * Admin store order management.
 * GET  /api/admin/store/orders
 * GET  /api/admin/store/orders/:id
 * PATCH /api/admin/store/orders/:id             — fulfilment status transitions
 * POST /api/admin/store/orders/:id/refund        — RECORD a refund already done in Stripe
 * POST /api/admin/store/orders/:id/notes         — internal admin note
 */
import { requireRole } from '../../../lib/auth.js';
import { query, queryOne, execute, audit } from '../../../lib/db.js';
import { toCamel, toCamelArray } from '../../../lib/serializers.js';
import { sendStoreCustomerEmail } from '../../../lib/storeEmail.js';

const FULFILMENT_STATUSES = ['pending', 'processing', 'ready_for_collection', 'dispatched', 'completed', 'cancelled'];
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

export async function handleAdminStoreOrders(request, env, ctx, params) {
  const actor = await requireRole(request, env, 'admin');
  const url = new URL(request.url);
  const method = request.method;

  if (params?.id && url.pathname.endsWith('/refund') && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { amount, note } = body;
    if (amount == null || amount <= 0) return Response.json({ message: 'A positive refund amount is required' }, { status: 400 });

    const order = await queryOne(env, 'SELECT * FROM store_orders WHERE id = ?', [params.id]);
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });

    const refundStatus = amount >= order.total ? 'full' : 'partial';
    const now = new Date().toISOString();
    await execute(env,
      `UPDATE store_orders SET refund_status = ?, refund_amount = ?, refunded_at = ?, updated_at = ? WHERE id = ?`,
      [refundStatus, amount, now, now, params.id]
    );
    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'refund', recordType: 'store_order', recordId: params.id,
      description: `Refund of €${amount.toFixed(2)} recorded for order ${order.order_number} (processed manually in Stripe)`,
      newValue: { refundStatus, amount }, reason: note ?? null,
    });
    await sendStoreCustomerEmail(env, { eventTrigger: 'store_refund_confirmed', order, extraVariables: { refund_amount: `€${amount.toFixed(2)}` } });
    return Response.json({ message: 'Refund recorded' });
  }

  if (params?.id && url.pathname.endsWith('/notes') && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (!body.note) return Response.json({ message: 'note is required' }, { status: 400 });
    const order = await queryOne(env, 'SELECT fulfilment_status FROM store_orders WHERE id = ?', [params.id]);
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });
    await recordStatusChange(env, { orderId: params.id, fromStatus: order.fulfilment_status, toStatus: order.fulfilment_status, actorId: actor.sub, note: body.note });
    return Response.json({ message: 'Note added' });
  }

  if (params?.id && method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    const { fulfilmentStatus, note } = body;
    if (!fulfilmentStatus || !FULFILMENT_STATUSES.includes(fulfilmentStatus)) {
      return Response.json({ message: `fulfilmentStatus must be one of: ${FULFILMENT_STATUSES.join(', ')}` }, { status: 400 });
    }
    const order = await queryOne(env, 'SELECT * FROM store_orders WHERE id = ?', [params.id]);
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });

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
    return Response.json({ message: 'Order updated' });
  }

  if (params?.id && method === 'GET') {
    const order = await queryOne(env, 'SELECT * FROM store_orders WHERE id = ?', [params.id]);
    if (!order) return Response.json({ message: 'Order not found' }, { status: 404 });
    const [items, history] = await Promise.all([
      query(env, 'SELECT * FROM store_order_items WHERE order_id = ?', [params.id]),
      query(env, `SELECT h.*, u.first_name || ' ' || u.last_name as actor_name FROM store_order_status_history h LEFT JOIN users u ON u.id = h.actor_id WHERE h.order_id = ? ORDER BY h.created_at`, [params.id]),
    ]);
    const camel = toCamel(order);
    camel.items = toCamelArray(items);
    camel.statusHistory = toCamelArray(history);
    return Response.json(camel);
  }

  // ── List ─────────────────────────────────────────────────────────────────
  const paymentStatus = url.searchParams.get('paymentStatus') || '';
  const fulfilmentStatus = url.searchParams.get('fulfilmentStatus') || '';
  const deliveryMethod = url.searchParams.get('deliveryMethod') || '';
  const customerEmail = url.searchParams.get('customerEmail') || '';
  const orderNumber = url.searchParams.get('orderNumber') || '';
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
  const where = conditions.join(' AND ');

  const [orders, countRow] = await Promise.all([
    query(env, `SELECT * FROM store_orders WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`, [...bindings, limit, offset]),
    queryOne(env, `SELECT COUNT(*) as count FROM store_orders WHERE ${where}`, bindings),
  ]);

  return Response.json({ orders: toCamelArray(orders), total: countRow?.count ?? 0 });
}
