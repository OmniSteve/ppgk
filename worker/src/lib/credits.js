/**
 * Credit business logic.
 * Balance is always derived from ledger SUM — never stored as an editable field.
 */
import { query, queryOne, execute } from './db.js';

/** Current balance from ledger (valid, non-expired entries) */
export async function getBalance(env, clientId) {
  const row = await queryOne(env,
    `SELECT COALESCE(SUM(amount), 0) as balance
     FROM credit_ledger
     WHERE client_id = ?
       AND (expires_at IS NULL OR expires_at > ?)`,
    [clientId, new Date().toISOString()]
  );
  return row?.balance ?? 0;
}

/**
 * Deduct credits for a booking (FIFO by expiry).
 * Returns { success, error, ledgerIds }.
 * Idempotent — if a ledger entry for this bookingId already exists, skips.
 */
export async function deductCredits(env, { clientId, bookingId, amount, description }) {
  // Idempotency: already deducted?
  const already = await queryOne(env,
    "SELECT id FROM credit_ledger WHERE booking_id = ? AND type = 'usage'",
    [bookingId]
  );
  if (already) return { success: true, skipped: true };

  // Get valid purchase packages ordered by earliest expiry (NULL expiry = never expires)
  const purchases = await query(env,
    `SELECT cl.id, cl.amount, cl.expires_at, cl.package_purchase_id
     FROM credit_ledger cl
     WHERE cl.client_id = ?
       AND cl.type = 'purchase'
       AND (cl.expires_at IS NULL OR cl.expires_at > ?)
     ORDER BY CASE WHEN cl.expires_at IS NULL THEN 1 ELSE 0 END, cl.expires_at ASC`,
    [clientId, new Date().toISOString()]
  );

  // Sum used credits per purchase
  const usedByPurchase = await query(env,
    `SELECT package_purchase_id, COALESCE(SUM(amount), 0) as used
     FROM credit_ledger
     WHERE client_id = ? AND type = 'usage' AND package_purchase_id IS NOT NULL
     GROUP BY package_purchase_id`,
    [clientId]
  );
  const usedMap = {};
  for (const u of usedByPurchase) usedMap[u.package_purchase_id] = Math.abs(u.used);

  // Check availability
  let available = 0;
  for (const p of purchases) {
    const used = usedMap[p.package_purchase_id] ?? 0;
    available += p.amount - used;
  }
  if (available < amount) {
    return { success: false, error: `Insufficient credits. Available: ${available}, required: ${amount}` };
  }

  // Deduct FIFO
  const currentBalance = await getBalance(env, clientId);
  let remaining = amount;
  const ledgerIds = [];

  for (const p of purchases) {
    if (remaining <= 0) break;
    const used    = usedMap[p.package_purchase_id] ?? 0;
    const fromThis = Math.min(p.amount - used, remaining);
    if (fromThis <= 0) continue;

    const ledgerId = crypto.randomUUID();
    const balAfter = currentBalance - fromThis;
    await execute(env,
      `INSERT INTO credit_ledger (id, client_id, type, amount, balance_after, booking_id, package_purchase_id, description, expires_at)
       VALUES (?, ?, 'usage', ?, ?, ?, ?, ?, ?)`,
      [ledgerId, clientId, -fromThis, balAfter, bookingId, p.package_purchase_id,
       description || `Credit deduction for booking ${bookingId}`, p.expires_at]
    );
    ledgerIds.push(ledgerId);
    remaining -= fromThis;
  }

  return { success: true, ledgerIds };
}

/**
 * Refund credits for a cancelled booking.
 * Idempotent — checks for existing refund entries for this booking.
 */
export async function refundCredits(env, { clientId, bookingId, description }) {
  // Already refunded?
  const already = await queryOne(env,
    "SELECT id FROM credit_ledger WHERE booking_id = ? AND type = 'refund'",
    [bookingId]
  );
  if (already) return { success: true, skipped: true };

  // Find original deduction entries
  const deductions = await query(env,
    "SELECT id, amount, package_purchase_id, expires_at FROM credit_ledger WHERE booking_id = ? AND type = 'usage'",
    [bookingId]
  );
  if (!deductions.length) return { success: true, skipped: true }; // was a card booking

  const currentBalance = await getBalance(env, clientId);
  let totalRefunded = 0;

  for (const d of deductions) {
    const refundAmount = Math.abs(d.amount);
    const balAfter     = currentBalance + totalRefunded + refundAmount;
    await execute(env,
      `INSERT INTO credit_ledger (id, client_id, type, amount, balance_after, booking_id, package_purchase_id, description, expires_at)
       VALUES (?, ?, 'refund', ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), clientId, refundAmount, balAfter, bookingId,
       d.package_purchase_id, description || `Credit refund for cancelled booking ${bookingId}`, d.expires_at]
    );
    totalRefunded += refundAmount;
  }

  return { success: true, refunded: totalRefunded };
}

/**
 * Issue credits when a package purchase is confirmed.
 * Idempotent — checks if credits already issued for this package_purchase_id.
 */
export async function issuePackageCredits(env, { clientId, packagePurchaseId, credits, expiresAt, description }) {
  const already = await queryOne(env,
    "SELECT id FROM credit_ledger WHERE package_purchase_id = ? AND type = 'purchase'",
    [packagePurchaseId]
  );
  if (already) return { success: true, skipped: true };

  const currentBalance = await getBalance(env, clientId);
  const balAfter = currentBalance + credits;

  await execute(env,
    `INSERT INTO credit_ledger (id, client_id, type, amount, balance_after, package_purchase_id, description, expires_at)
     VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), clientId, credits, balAfter, packagePurchaseId,
     description || `Credits from package purchase ${packagePurchaseId}`, expiresAt]
  );

  return { success: true };
}