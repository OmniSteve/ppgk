/**
 * E-commerce store business logic — order numbering, pricing/delivery/tax
 * computation (always server-authoritative, never trusts client-submitted
 * values), and stock reservation.
 *
 * Stock reservation strategy: a single conditional UPDATE per line item
 * (`WHERE (stock_qty - reserved_qty) >= ?`) — the same atomic-conditional-
 * UPDATE technique already used for session-capacity checks in
 * coach/roster.js. Each individual row update is race-safe (two simultaneous
 * buyers of the last unit cannot both succeed), so no oversell can occur on
 * any single product/variant. Residual risk: reserving a multi-item cart is
 * not one atomic transaction across items — if item 3 of 4 fails, items 1-2
 * are explicitly rolled back below, but there is a brief window where their
 * stock is reserved-then-released rather than never-reserved. That window
 * cannot cause an oversell (the conditional UPDATE still protects each row);
 * it can only, in a rare multi-item-failure race, cause a different shopper
 * to be momentarily blocked from a unit that becomes available a few
 * milliseconds later. Reservations expire after 30 minutes via the scheduled
 * worker (see releaseExpiredReservations, wired into worker/src/scheduled.js).
 */
import { query, queryOne, execute } from './db.js';

const RESERVATION_MINUTES = 30;

/** Read a handful of typed app_settings values in one query. */
export async function getStoreSettings(env) {
  const rows = await query(env,
    `SELECT key, value, data_type FROM app_settings WHERE key IN (
      'store_enabled','store_currency','delivery_enabled','collection_enabled',
      'store_delivery_fee','store_free_delivery_threshold','collection_location_name',
      'collection_address','collection_map_link','collection_instructions','collection_hours',
      'store_contact_email','store_contact_phone','store_low_stock_threshold',
      'store_tax_mode','store_tax_rate'
    )`
  );
  const settings = {};
  for (const row of rows) {
    if (row.data_type === 'boolean') settings[row.key] = row.value === 'true' || row.value === '1';
    else if (row.data_type === 'number') settings[row.key] = Number(row.value) || 0;
    else settings[row.key] = row.value ?? '';
  }
  return settings;
}

/** Atomically mint the next human-readable order number, e.g. "SO-1000". */
export async function nextOrderNumber(env) {
  await execute(env, 'UPDATE store_order_sequence SET next_number = next_number + 1 WHERE id = 1');
  const row = await queryOne(env, 'SELECT next_number FROM store_order_sequence WHERE id = 1');
  return `SO-${row.next_number - 1}`;
}

/** Delivery fee is always computed server-side from settings + the authoritative subtotal. */
export function computeDeliveryFee(settings, deliveryMethod, subtotal) {
  if (deliveryMethod === 'collection') return 0;
  if (!settings.delivery_enabled) return 0;
  const threshold = settings.store_free_delivery_threshold;
  if (threshold > 0 && subtotal >= threshold) return 0;
  return settings.store_delivery_fee ?? 0;
}

/** Tax is always computed server-side; the business explicitly configures the treatment. */
export function computeTax(settings, subtotal) {
  const mode = settings.store_tax_mode || 'not_applicable';
  const rate = (settings.store_tax_rate ?? 0) / 100;
  if (mode === 'added') return { taxAmount: Math.round(subtotal * rate * 100) / 100, taxMode: mode };
  // 'inclusive' — tax is already part of the displayed price, shown for transparency only.
  if (mode === 'inclusive') return { taxAmount: Math.round((subtotal - subtotal / (1 + rate)) * 100) / 100, taxMode: mode };
  return { taxAmount: 0, taxMode: 'not_applicable' };
}

/** The price a customer actually pays: variant override > product sale price > product base price. */
export function effectiveUnitPrice(product, variant) {
  if (variant?.price_override != null) return variant.price_override;
  if (product.sale_price != null) return product.sale_price;
  return product.base_price;
}

/**
 * Reserve stock for every line item of an order. Returns { success: true } or
 * { success: false, failedItem } — on partial failure, everything reserved so
 * far in this call is rolled back before returning.
 * items: [{ productId, variantId|null, quantity }]
 */
export async function reserveStockForItems(env, orderId, items) {
  const reserved = [];
  for (const item of items) {
    const table = item.variantId ? 'store_product_variants' : 'store_products';
    const rowId = item.variantId ?? item.productId;
    const result = await execute(env,
      `UPDATE ${table} SET reserved_qty = reserved_qty + ? WHERE id = ? AND (stock_qty - reserved_qty) >= ?`,
      [item.quantity, rowId, item.quantity]
    );
    if (!result.changes) {
      for (const r of reserved) {
        const t = r.variantId ? 'store_product_variants' : 'store_products';
        await execute(env, `UPDATE ${t} SET reserved_qty = reserved_qty - ? WHERE id = ?`, [r.quantity, r.variantId ?? r.productId]);
      }
      return { success: false, failedItem: item };
    }
    reserved.push(item);
    const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60_000).toISOString();
    await execute(env,
      `INSERT INTO store_inventory_reservations (id, product_id, variant_id, order_id, quantity, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), item.variantId ? null : item.productId, item.variantId ?? null, orderId, item.quantity, expiresAt]
    );
  }
  return { success: true };
}

/**
 * Release (without permanently deducting) every active reservation for an
 * order — used for expired reservations and for failed/cancelled payments.
 * Idempotent: already-released reservations are skipped.
 */
export async function releaseReservationsForOrder(env, orderId) {
  const rows = await query(env,
    'SELECT * FROM store_inventory_reservations WHERE order_id = ? AND released = 0', [orderId]);
  for (const r of rows) {
    const table = r.variant_id ? 'store_product_variants' : 'store_products';
    await execute(env, `UPDATE ${table} SET reserved_qty = reserved_qty - ? WHERE id = ?`, [r.quantity, r.variant_id ?? r.product_id]);
    await execute(env, 'UPDATE store_inventory_reservations SET released = 1 WHERE id = ?', [r.id]);
  }
  return rows.length;
}

/** Cron entry point — release every reservation past its expiry that hasn't been released yet. */
export async function releaseExpiredReservations(env) {
  const now = new Date().toISOString();
  const expired = await query(env,
    'SELECT DISTINCT order_id FROM store_inventory_reservations WHERE released = 0 AND expires_at < ?', [now]);
  let released = 0;
  for (const row of expired) released += await releaseReservationsForOrder(env, row.order_id);
  return released;
}

/**
 * Convert an order's reservations into a permanent stock decrement after
 * payment succeeds. Idempotent via store_inventory_adjustments (one row per
 * order+reason is the dedupe key), safe against duplicate Stripe webhook
 * deliveries.
 */
export async function confirmStockForOrder(env, orderId, performedBy = null) {
  const already = await queryOne(env,
    "SELECT id FROM store_inventory_adjustments WHERE order_id = ? AND reason = 'order_fulfilled' LIMIT 1", [orderId]);
  if (already) return { skipped: true };

  const rows = await query(env,
    'SELECT * FROM store_inventory_reservations WHERE order_id = ? AND released = 0', [orderId]);
  for (const r of rows) {
    const table = r.variant_id ? 'store_product_variants' : 'store_products';
    const rowId = r.variant_id ?? r.product_id;
    await execute(env, `UPDATE ${table} SET stock_qty = stock_qty - ?, reserved_qty = reserved_qty - ? WHERE id = ?`,
      [r.quantity, r.quantity, rowId]);
    await execute(env, 'UPDATE store_inventory_reservations SET released = 1 WHERE id = ?', [r.id]);
    await execute(env,
      `INSERT INTO store_inventory_adjustments (id, product_id, variant_id, delta, reason, order_id, performed_by)
       VALUES (?, ?, ?, ?, 'order_fulfilled', ?, ?)`,
      [crypto.randomUUID(), r.product_id, r.variant_id, -r.quantity, orderId, performedBy]
    );
  }
  return { skipped: false, itemsAdjusted: rows.length };
}

/**
 * Restore stock for specific order line items after a refund — the inverse of
 * confirmStockForOrder. Never automatic; callers decide which lines/quantities
 * to restore (full refund defaults to "all", partial refund defaults to "none"
 * unless the admin explicitly selects items, since a partial refund is often a
 * price adjustment rather than a physical return).
 * lines: [{ productId, variantId|null, quantity }]
 */
export async function restoreStockForItems(env, { orderId, lines, performedBy = null, refundId = null }) {
  let itemsAdjusted = 0;
  for (const line of lines) {
    if (!line.quantity || line.quantity <= 0) continue;
    const table = line.variantId ? 'store_product_variants' : 'store_products';
    const rowId = line.variantId ?? line.productId;
    await execute(env, `UPDATE ${table} SET stock_qty = stock_qty + ? WHERE id = ?`, [line.quantity, rowId]);
    await execute(env,
      `INSERT INTO store_inventory_adjustments (id, product_id, variant_id, delta, reason, order_id, performed_by, note)
       VALUES (?, ?, ?, ?, 'refund_restock', ?, ?, ?)`,
      [crypto.randomUUID(), line.variantId ? null : line.productId, line.variantId ?? null, line.quantity, orderId, performedBy, refundId ? `Restored from refund ${refundId}` : null]
    );
    itemsAdjusted++;
  }
  return { itemsAdjusted };
}

/**
 * Live refund status for an order, computed from store_refunds (the
 * authoritative source — never from the legacy store_orders.refund_status
 * column, and never inferred from a manual note).
 */
export async function computeRefundSummary(env, order) {
  const refunds = await query(env, 'SELECT * FROM store_refunds WHERE order_id = ? ORDER BY created_at', [order.id]);
  const paidCents = Math.round(Number(order.total) * 100);
  const succeededCents = refunds.filter((r) => r.status === 'succeeded').reduce((s, r) => s + r.amount_cents, 0);
  const hasPending = refunds.some((r) => r.status === 'pending');
  const hasFailed = refunds.some((r) => r.status === 'failed');
  const remainingCents = Math.max(0, paidCents - succeededCents);

  let status = 'none';
  if (succeededCents > 0 && remainingCents === 0) status = 'full';
  else if (succeededCents > 0) status = 'partial';
  else if (hasPending) status = 'pending';
  else if (hasFailed) status = 'failed';

  return { paidCents, refundedCents: succeededCents, remainingCents, status, refunds };
}

/** Products (or variants) at or below the configured low-stock threshold, for the admin alert cron. */
export async function getLowStockItems(env, threshold) {
  const products = await query(env,
    `SELECT id, name, NULL as variant_name, (stock_qty - reserved_qty) as available
     FROM store_products
     WHERE status = 'active' AND track_stock = 1
       AND id NOT IN (SELECT DISTINCT product_id FROM store_product_variants WHERE active = 1)
       AND (stock_qty - reserved_qty) <= ?`,
    [threshold]
  );
  const variants = await query(env,
    `SELECT p.id, p.name, v.name as variant_name, (v.stock_qty - v.reserved_qty) as available
     FROM store_product_variants v JOIN store_products p ON p.id = v.product_id
     WHERE v.active = 1 AND p.status = 'active' AND (v.stock_qty - v.reserved_qty) <= ?`,
    [threshold]
  );
  return [...products, ...variants];
}
