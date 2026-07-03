/**
 * Client package endpoints.
 * GET  /api/packages             — list active packages
 * POST /api/packages/:id/purchase — create a pending order for a package
 */
import { requireAuth }              from '../../lib/auth.js';
import { query, queryOne, execute } from '../../lib/db.js';
import { err, ok }                  from '../../lib/validate.js';

export async function handleClientPackages(request, env, ctx, params) {
  const payload = await requireAuth(request, env);

  if (request.method === 'GET') {
    const packages = await query(env, "SELECT * FROM package_definitions WHERE active = 1 ORDER BY price", []);
    return ok({ packages });
  }

  if (request.method === 'POST' && params?.id) {
    // POST /api/packages/:id/purchase
    let body;
    try { body = await request.json(); } catch { body = {}; }
    const { idempotencyKey } = body;
    if (!idempotencyKey) return err('idempotencyKey is required');

    // Idempotency
    const existing = await queryOne(env,
      'SELECT id, stripe_session_id FROM orders WHERE idempotency_key = ? AND client_id = ?',
      [idempotencyKey, payload.sub]
    );
    if (existing) return ok({ orderId: existing.id, idempotent: true });

    // Load package from DB — never trust frontend price
    const pkg = await queryOne(env,
      'SELECT * FROM package_definitions WHERE id = ? AND active = 1',
      [params.id]
    );
    if (!pkg) return err('Package not found or inactive', 404);

    // Create pending order
    const orderId = crypto.randomUUID();
    await execute(env,
      `INSERT INTO orders (id, client_id, idempotency_key, status, total_amount)
       VALUES (?, ?, ?, 'pending', ?)`,
      [orderId, payload.sub, idempotencyKey, pkg.price]
    );

    // Create order item
    await execute(env,
      `INSERT INTO order_items (id, order_id, item_type, package_definition_id, quantity, unit_price)
       VALUES (?, ?, 'package_purchase', ?, 1, ?)`,
      [crypto.randomUUID(), orderId, pkg.id, pkg.price]
    );

    return ok({ orderId, message: 'Order created. Proceed to checkout.' }, 201);
  }

  return err('Method not allowed', 405);
}