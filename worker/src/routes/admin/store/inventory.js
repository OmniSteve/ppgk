/**
 * Admin inventory management.
 * GET  /api/admin/store/inventory/low-stock
 * POST /api/admin/store/inventory/adjust
 */
import { requireRole } from '../../../lib/auth.js';
import { queryOne, execute, audit } from '../../../lib/db.js';
import { getStoreSettings, getLowStockItems } from '../../../lib/store.js';

export async function handleAdminStoreInventory(request, env, ctx, params) {
  const actor = await requireRole(request, env, 'admin');
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname.endsWith('/low-stock')) {
    const settings = await getStoreSettings(env);
    const items = await getLowStockItems(env, settings.store_low_stock_threshold ?? 5);
    return Response.json({ items });
  }

  if (request.method === 'POST' && url.pathname.endsWith('/adjust')) {
    const body = await request.json().catch(() => ({}));
    const { productId, variantId, delta, note } = body;
    if (!productId || !Number.isInteger(delta) || delta === 0) {
      return Response.json({ message: 'productId and a non-zero integer delta are required' }, { status: 400 });
    }

    const table = variantId ? 'store_product_variants' : 'store_products';
    const rowId = variantId || productId;
    const row = await queryOne(env, `SELECT stock_qty, reserved_qty FROM ${table} WHERE id = ?`, [rowId]);
    if (!row) return Response.json({ message: 'Product or variant not found' }, { status: 404 });

    const newStock = row.stock_qty + delta;
    if (newStock < row.reserved_qty) {
      return Response.json({ message: `Cannot reduce stock below the ${row.reserved_qty} unit(s) currently reserved by pending orders` }, { status: 409 });
    }

    await execute(env, `UPDATE ${table} SET stock_qty = ? WHERE id = ?`, [newStock, rowId]);
    await execute(env,
      `INSERT INTO store_inventory_adjustments (id, product_id, variant_id, delta, reason, performed_by, note)
       VALUES (?, ?, ?, ?, 'manual_adjustment', ?, ?)`,
      [crypto.randomUUID(), variantId ? null : productId, variantId ?? null, delta, actor.sub, note ?? null]
    );
    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'update', recordType: 'store_inventory', recordId: rowId,
      description: `Manual stock adjustment: ${delta > 0 ? '+' : ''}${delta}`, reason: note ?? null,
    });
    return Response.json({ message: 'Stock adjusted', newStock });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}
