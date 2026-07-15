/**
 * GET /api/store/orders            — authenticated customer's own order history
 * GET /api/store/orders/guest/:token — guest order lookup by non-guessable token
 *
 * Guest orders are never reachable by order ID/number alone — only the
 * unguessable token minted at checkout (see store_orders.guest_token).
 */
import { requireAuth } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';
import { ok, err } from '../../lib/validate.js';

async function withItems(env, order) {
  const items = await query(env, 'SELECT * FROM store_order_items WHERE order_id = ?', [order.id]);
  const camel = toCamel(order);
  camel.items = toCamelArray(items);
  delete camel.guestToken;
  return camel;
}

export async function handleStoreOrders(request, env, ctx, params) {
  if (params?.token) {
    const order = await queryOne(env, 'SELECT * FROM store_orders WHERE guest_token = ?', [params.token]);
    if (!order) return err('Order not found', 404);
    return ok(await withItems(env, order));
  }

  const payload = await requireAuth(request, env);
  const orders = await query(env, 'SELECT * FROM store_orders WHERE user_id = ? ORDER BY created_at DESC', [payload.sub]);
  const withAllItems = await Promise.all(orders.map((o) => withItems(env, o)));
  return ok({ orders: withAllItems });
}
