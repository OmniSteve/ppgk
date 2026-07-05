/**
 * Credit business logic.
 * Balance is always derived from ledger SUM — never stored as an editable field.
 */
import { query, queryOne, execute } from './db.js';

/** Current balance from ledger (valid, non-expired entries only) */
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
 * Idempotent — if a usage ledger entry for this bookingId already exists, skips.
 *
 * Supports credits from:
 *   - package purchases (type='purchase', package_purchase_id set)
 *   - admin grants     (type='admin_grant', package_purchase_id NULL)
 */
export async function deductCredits(env, { clientId, bookingId, amount, description }) {
  // Idempotency: already deducted?
  const already = await queryOne(env,
    "SELECT id FROM credit_ledger WHERE booking_id = ? AND type = 'usage'",
    [bookingId]
  );
  if (already) return { success: true, skipped: true };

  const now = new Date().toISOString();

  // Fetch all valid credit sources: purchases + admin grants, non-expired
  // Expire soonest first; NULL expiry (never expires) sorted last
  const sources = await query(env,
    `SELECT id, type, amount, expires_at, package_purchase_id
     FROM credit_ledger
     WHERE client_id = ?
       AND type IN ('purchase', 'admin_grant')
       AND (expires_at IS NULL OR expires_at > ?)
     ORDER BY
       CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END,
       expires_at ASC`,
    [clientId, now]
  );

  // For package-based credits: compute used per package_purchase_id
  const usedByPkg = await query(env,
    `SELECT package_purchase_id, COALESCE(SUM(ABS(amount)), 0) as used
     FROM credit_ledger
     WHERE client_id = ? AND type = 'usage' AND package_purchase_id IS NOT NULL
     GROUP BY package_purchase_id`,
    [clientId]
  );
  const pkgUsedMap = {};
  for (const u of usedByPkg) pkgUsedMap[u.package_purchase_id] = Number(u.used);

  // For admin grants (no package_purchase_id): sum all usage rows that also have NULL package_purchase_id
  const adminUsedRow = await queryOne(env,
    `SELECT COALESCE(SUM(ABS(amount)), 0) as used
     FROM credit_ledger
     WHERE client_id = ? AND type = 'usage' AND package_purchase_id IS NULL`,
    [clientId]
  );
  let adminUsedPool = Number(adminUsedRow?.used ?? 0);

  // Calculate available credits
  let available = 0;
  for (const src of sources) {
    if (src.package_purchase_id) {
      const used = pkgUsedMap[src.package_purchase_id] ?? 0;
      available += Math.max(0, src.amount - used);
    } else {
      // admin_grant — pool tracked collectively
      const avail = Math.max(0, src.amount - adminUsedPool);
      adminUsedPool = Math.max(0, adminUsedPool - src.amount); // reduce remaining debt
      available += avail;
    }
  }

  if (available < amount) {
    return { success: false, error: `Insufficient credits. Available: ${available}, required: ${amount}` };
  }

  // Deduct FIFO across sources
  const currentBalance = await getBalance(env, clientId);
  let remaining = amount;
  let deducted = 0;
  const ledgerIds = [];

  // Reset admin pool tracker for deduction pass
  const adminUsedRow2 = await queryOne(env,
    `SELECT COALESCE(SUM(ABS(amount)), 0) as used
     FROM credit_ledger
     WHERE client_id = ? AND type = 'usage' AND package_purchase_id IS NULL`,
    [clientId]
  );
  let adminUsedPool2 = Number(adminUsedRow2?.used ?? 0);

  for (const src of sources) {
    if (remaining <= 0) break;

    let fromThis;
    if (src.package_purchase_id) {
      const used = pkgUsedMap[src.package_purchase_id] ?? 0;
      fromThis = Math.min(Math.max(0, src.amount - used), remaining);
    } else {
      const avail = Math.max(0, src.amount - adminUsedPool2);
      adminUsedPool2 = Math.max(0, adminUsedPool2 - src.amount);
      fromThis = Math.min(avail, remaining);
    }

    if (fromThis <= 0) continue;

    const ledgerId = crypto.randomUUID();
    const balAfter = currentBalance - deducted - fromThis;
    await execute(env,
      `INSERT INTO credit_ledger
         (id, client_id, type, amount, balance_after, booking_id, package_purchase_id, description, expires_at)
       VALUES (?, ?, 'usage', ?, ?, ?, ?, ?, ?)`,
      [ledgerId, clientId, -fromThis, balAfter, bookingId,
       src.package_purchase_id ?? null,
       description || `Credit deduction for booking ${bookingId}`,
       src.expires_at ?? null]
    );
    ledgerIds.push(ledgerId);
    deducted  += fromThis;
    remaining -= fromThis;
  }

  return { success: true, ledgerIds };
}

/**
 * Refund credits for a cancelled booking.
 * Idempotent.
 */
export async function refundCredits(env, { clientId, bookingId, description }) {
  const already = await queryOne(env,
    "SELECT id FROM credit_ledger WHERE booking_id = ? AND type = 'refund'",
    [bookingId]
  );
  if (already) return { success: true, skipped: true };

  const deductions = await query(env,
    "SELECT id, amount, package_purchase_id, expires_at FROM credit_ledger WHERE booking_id = ? AND type = 'usage'",
    [bookingId]
  );
  if (!deductions.length) return { success: true, skipped: true };

  const currentBalance = await getBalance(env, clientId);
  let totalRefunded = 0;

  for (const d of deductions) {
    const refundAmount = Math.abs(d.amount);
    const balAfter = currentBalance + totalRefunded + refundAmount;
    await execute(env,
      `INSERT INTO credit_ledger
         (id, client_id, type, amount, balance_after, booking_id, package_purchase_id, description, expires_at)
       VALUES (?, ?, 'refund', ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), clientId, refundAmount, balAfter, bookingId,
       d.package_purchase_id ?? null,
       description || `Credit refund for cancelled booking ${bookingId}`,
       d.expires_at ?? null]
    );
    totalRefunded += refundAmount;
  }

  return { success: true, refunded: totalRefunded };
}

/**
 * Issue credits when a package purchase is confirmed.
 * Idempotent.
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
    `INSERT INTO credit_ledger
       (id, client_id, type, amount, balance_after, package_purchase_id, description, expires_at)
     VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), clientId, credits, balAfter, packagePurchaseId,
     description || `Credits from package purchase ${packagePurchaseId}`,
     expiresAt ?? null]
  );

  return { success: true };
}