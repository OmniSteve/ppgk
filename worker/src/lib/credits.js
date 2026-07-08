/**
 * Credit business logic.
 * Balance is always derived from ledger SUM — never stored as an editable field.
 *
 * Ledger types:
 *   purchase        (+) credits issued from a package purchase
 *   admin_grant     (+) credits granted manually by an admin
 *   usage           (−) credits spent on a booking
 *   refund          (+) credits restored when a booking is cancelled
 *   refund_removal  (−) credits removed because their money was refunded
 *   admin_deduct    (−) credits removed manually by an admin
 *   expiry          (−) unused credits written off at package expiry
 *
 * Invariant: package-scoped rows carry the package's expires_at so the whole
 * group ages out of the balance together (getBalance filters expired rows).
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
 * Net credits consumed per package purchase.
 * usage (−) spends, refund (+) restores, refund_removal (−) removes —
 * summing all three and negating gives credits no longer available.
 * Returns { [package_purchase_id]: consumed }.
 */
export async function packageNetConsumed(env, clientId) {
  const rows = await query(env,
    `SELECT package_purchase_id, -COALESCE(SUM(amount), 0) as consumed
     FROM credit_ledger
     WHERE client_id = ?
       AND type IN ('usage', 'refund', 'refund_removal')
       AND package_purchase_id IS NOT NULL
     GROUP BY package_purchase_id`,
    [clientId]
  );
  const map = {};
  for (const r of rows) map[r.package_purchase_id] = Number(r.consumed);
  return map;
}

/**
 * Net credits consumed from the admin-grant pool (rows with no package).
 * Includes admin_deduct so manual deductions reduce spendable credits.
 */
async function poolNetConsumed(env, clientId) {
  const row = await queryOne(env,
    `SELECT -COALESCE(SUM(amount), 0) as consumed
     FROM credit_ledger
     WHERE client_id = ?
       AND type IN ('usage', 'refund', 'admin_deduct')
       AND package_purchase_id IS NULL`,
    [clientId]
  );
  return Number(row?.consumed ?? 0);
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

  const pkgConsumed = await packageNetConsumed(env, clientId);
  const poolConsumed = await poolNetConsumed(env, clientId);

  // Calculate available credits per source
  let available = 0;
  let poolDebt = poolConsumed;
  for (const src of sources) {
    if (src.package_purchase_id) {
      available += Math.max(0, src.amount - (pkgConsumed[src.package_purchase_id] ?? 0));
    } else {
      // admin grants — pool tracked collectively
      available += Math.max(0, src.amount - poolDebt);
      poolDebt = Math.max(0, poolDebt - src.amount);
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
  let poolDebt2 = poolConsumed;

  for (const src of sources) {
    if (remaining <= 0) break;

    let fromThis;
    if (src.package_purchase_id) {
      const consumed = pkgConsumed[src.package_purchase_id] ?? 0;
      fromThis = Math.min(Math.max(0, src.amount - consumed), remaining);
    } else {
      const avail = Math.max(0, src.amount - poolDebt2);
      poolDebt2 = Math.max(0, poolDebt2 - src.amount);
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

/**
 * Compute the credit impact of refunding `refundAmount` against an order.
 *
 * For each package purchase on the order, the refund amount converts to
 * credits at the package's per-credit price (price_paid / credits_granted).
 * Only unused, unexpired credits can be removed — if the target exceeds
 * what's available the refund is blocked (unless the admin keeps credits).
 *
 * Orders with no package purchases (money-paid session bookings) involve no
 * credits: creditsToRemove = 0 and the refund is never blocked.
 *
 * Returns {
 *   creditsToRemove, totalAvailable, blocked, blockedReason,
 *   packages: [{ packagePurchaseId, packageName, perCreditValue, available,
 *                toRemove, expiresAt, live }],
 * }
 */
export async function computeRefundCreditImpact(env, { clientId, orderId, refundAmount }) {
  const empty = { creditsToRemove: 0, totalAvailable: 0, blocked: false, blockedReason: null, packages: [] };
  if (!orderId) return empty;

  const packages = await query(env,
    `SELECT pp.id, pp.credits_granted, pp.price_paid, pp.expires_at, pp.status,
            pd.name as package_name
     FROM package_purchases pp
     JOIN package_definitions pd ON pd.id = pp.package_definition_id
     WHERE pp.order_id = ? AND pp.client_id = ?
     ORDER BY pp.created_at`,
    [orderId, clientId]
  );
  if (!packages.length) return empty;

  const consumed = await packageNetConsumed(env, clientId);
  const now = new Date().toISOString();

  let remainingRefund = Math.round(refundAmount * 100) / 100;
  let creditsToRemove = 0;
  let totalAvailable = 0;
  const breakdown = [];
  const problems = [];

  for (const pkg of packages) {
    const perCreditValue = pkg.credits_granted > 0 ? pkg.price_paid / pkg.credits_granted : 0;
    const live = pkg.status === 'active' && (!pkg.expires_at || pkg.expires_at > now);
    const available = live ? Math.max(0, pkg.credits_granted - (consumed[pkg.id] ?? 0)) : 0;

    // Portion of the refund attributable to this package, converted to credits
    const portion = Math.min(remainingRefund, pkg.price_paid);
    remainingRefund = Math.round((remainingRefund - portion) * 100) / 100;
    const toRemove = perCreditValue > 0 ? Math.round(portion / perCreditValue) : 0;

    breakdown.push({
      packagePurchaseId: pkg.id,
      packageName:       pkg.package_name,
      perCreditValue:    Math.round(perCreditValue * 100) / 100,
      available,
      toRemove,
      expiresAt:         pkg.expires_at,
      live,
    });
    creditsToRemove += toRemove;
    totalAvailable  += available;

    if (toRemove > available) {
      const why = live
        ? `${toRemove - available} of them already used by bookings`
        : `package is ${pkg.status}`;
      problems.push(`"${pkg.package_name}" needs ${toRemove} unused credit(s) removed but only ${available} remain (${why})`);
    }
  }

  const blocked = problems.length > 0;
  return {
    creditsToRemove,
    totalAvailable,
    blocked,
    blockedReason: blocked
      ? `Not enough unused credits to cover this refund: ${problems.join('; ')}. ` +
        `Reduce the refund amount to the unused value, or tick "Keep credit after refund" to refund without removing credits.`
      : null,
    packages: breakdown,
  };
}

/**
 * Build the D1 statements that remove refunded credits (for db batch()).
 * One refund_removal ledger row per affected package; packages left with no
 * remaining credits are marked status='refunded'.
 *
 * Removal rows carry the package's expires_at so the whole package group
 * still ages out of the balance together at expiry.
 */
export function buildCreditRemovalStatements({ clientId, impact, currentBalance, performedBy, paymentReference, now }) {
  const statements = [];
  let removed = 0;

  for (const pkg of impact.packages) {
    if (pkg.toRemove <= 0) continue;

    const balAfter = currentBalance - removed - pkg.toRemove;
    statements.push({
      sql: `INSERT INTO credit_ledger
              (id, client_id, type, amount, balance_after, package_purchase_id, description, expires_at, performed_by)
            VALUES (?, ?, 'refund_removal', ?, ?, ?, ?, ?, ?)`,
      params: [crypto.randomUUID(), clientId, -pkg.toRemove, balAfter, pkg.packagePurchaseId,
               `Removed ${pkg.toRemove} credit(s) — money refunded (payment ${paymentReference})`,
               pkg.expiresAt ?? null, performedBy],
    });
    removed += pkg.toRemove;

    if (pkg.toRemove >= pkg.available) {
      statements.push({
        sql: `UPDATE package_purchases SET status = 'refunded', updated_at = ? WHERE id = ?`,
        params: [now, pkg.packagePurchaseId],
      });
    }
  }

  return { statements, removed };
}
