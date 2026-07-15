/**
 * Account & profile lifecycle business logic — deactivation impact previews,
 * permanent-deletion eligibility checks, and the future-booking/future-session
 * resolution actions used by the admin deactivate flows for users, players,
 * and coaches.
 *
 * Kept separate from the route handlers (same split as lib/credits.js and
 * lib/roster.js) so worker/src/routes/admin/{clients,players,coaches}.js stay
 * focused on request parsing/response shaping.
 */
import { query, queryOne, execute, audit } from './db.js';
import { refundCredits } from './credits.js';

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function countRows(env, sql, params) {
  const row = await queryOne(env, sql, params);
  return row?.c ?? 0;
}

const LABELS = {
  bookings: 'booking(s)',
  payments: 'payment(s)',
  orders: 'order(s)',
  packagePurchases: 'package purchase(s)',
  creditLedgerEntries: 'credit ledger entry/entries',
  consentRecords: 'consent record(s)',
  players: 'linked player profile(s)',
  bookingAmendmentsAuthored: 'booking amendment(s) authored',
  creditActionsPerformed: 'credit ledger action(s) performed',
  refundsPerformed: 'refund(s) performed',
  attendanceRecorded: 'attendance record(s) recorded',
  playerPerformanceCreated: 'performance evaluation(s) created',
  attendance: 'attendance record(s)',
  playerPerformance: 'performance evaluation(s)',
  sessions: 'assigned session(s)',
};

function reasonLabel(key, count) {
  return `${count} ${LABELS[key] || key}`;
}

async function runEligibilityChecks(env, checks, id) {
  const dependencyCounts = {};
  const blockingReasons = [];
  for (const [key, sql] of checks) {
    const count = await countRows(env, sql, [id]);
    dependencyCounts[key] = count;
    if (count > 0) blockingReasons.push(reasonLabel(key, count));
  }
  return { eligible: blockingReasons.length === 0, blockingReasons, dependencyCounts };
}

// ─── USERS ──────────────────────────────────────────────────────────────────

export async function getUserDeactivationImpact(env, userId) {
  const [
    futureBookings, completedBookings, activeCredits, creditTransactions,
    payments, attendanceRecords, performanceEvaluations, linkedPlayers, linkedCoach,
  ] = await Promise.all([
    countRows(env, `SELECT COUNT(*) c FROM bookings b JOIN sessions s ON s.id = b.session_id
                     WHERE b.client_id = ? AND s.session_date >= ?
                       AND b.status IN ('confirmed','pending_payment','pending','backup')`, [userId, today()]),
    countRows(env, `SELECT COUNT(*) c FROM bookings WHERE client_id = ?
                     AND status IN ('attended','absent','cancelled_by_client','cancelled_by_admin')`, [userId]),
    countRows(env, `SELECT COALESCE(SUM(amount), 0) c FROM credit_ledger
                     WHERE client_id = ? AND (expires_at IS NULL OR expires_at > ?)`, [userId, new Date().toISOString()]),
    countRows(env, 'SELECT COUNT(*) c FROM credit_ledger WHERE client_id = ?', [userId]),
    countRows(env, 'SELECT COUNT(*) c FROM payments WHERE client_id = ?', [userId]),
    countRows(env, `SELECT COUNT(*) c FROM attendance a JOIN bookings b ON b.id = a.booking_id
                     WHERE b.client_id = ?`, [userId]),
    countRows(env, 'SELECT COUNT(*) c FROM player_performance WHERE client_id = ?', [userId]),
    countRows(env, 'SELECT COUNT(*) c FROM players WHERE client_id = ?', [userId]),
    countRows(env, 'SELECT COUNT(*) c FROM coach_profiles WHERE user_id = ?', [userId]),
  ]);
  return {
    futureBookings, completedBookings, activeCredits, creditTransactions, payments,
    attendanceRecords, performanceEvaluations, futureSessions: 0,
    linkedPlayers, linkedCoachProfile: linkedCoach > 0,
  };
}

export async function getUserDeletionEligibility(env, userId) {
  const user = await queryOne(env, 'SELECT id FROM users WHERE id = ?', [userId]);
  if (!user) return { eligible: false, blockingReasons: ['User not found'], dependencyCounts: {} };

  return runEligibilityChecks(env, [
    ['bookings', 'SELECT COUNT(*) c FROM bookings WHERE client_id = ?'],
    ['payments', 'SELECT COUNT(*) c FROM payments WHERE client_id = ?'],
    ['orders', 'SELECT COUNT(*) c FROM orders WHERE client_id = ?'],
    ['packagePurchases', 'SELECT COUNT(*) c FROM package_purchases WHERE client_id = ?'],
    ['creditLedgerEntries', 'SELECT COUNT(*) c FROM credit_ledger WHERE client_id = ?'],
    ['consentRecords', 'SELECT COUNT(*) c FROM consent_records WHERE user_id = ?'],
    ['players', 'SELECT COUNT(*) c FROM players WHERE client_id = ?'],
    ['bookingAmendmentsAuthored', 'SELECT COUNT(*) c FROM booking_amendments WHERE amended_by = ?'],
    ['creditActionsPerformed', "SELECT COUNT(*) c FROM credit_ledger WHERE performed_by = ?"],
    ['refundsPerformed', 'SELECT COUNT(*) c FROM refunds WHERE performed_by = ?'],
    ['attendanceRecorded', 'SELECT COUNT(*) c FROM attendance WHERE recorded_by = ?'],
    ['playerPerformanceCreated', 'SELECT COUNT(*) c FROM player_performance WHERE created_by = ?'],
  ], userId);
}

// ─── PLAYERS ────────────────────────────────────────────────────────────────

export async function getPlayerDeactivationImpact(env, playerId) {
  const player = await queryOne(env, 'SELECT client_id FROM players WHERE id = ?', [playerId]);
  const [futureBookings, completedBookings, attendanceRecords, performanceEvaluations] = await Promise.all([
    countRows(env, `SELECT COUNT(*) c FROM bookings b JOIN sessions s ON s.id = b.session_id
                     WHERE b.player_id = ? AND s.session_date >= ?
                       AND b.status IN ('confirmed','pending_payment','pending','backup')`, [playerId, today()]),
    countRows(env, `SELECT COUNT(*) c FROM bookings WHERE player_id = ?
                     AND status IN ('attended','absent','cancelled_by_client','cancelled_by_admin')`, [playerId]),
    countRows(env, 'SELECT COUNT(*) c FROM attendance WHERE player_id = ?', [playerId]),
    countRows(env, 'SELECT COUNT(*) c FROM player_performance WHERE player_id = ?', [playerId]),
  ]);
  const activeCredits = player
    ? await countRows(env, `SELECT COALESCE(SUM(amount), 0) c FROM credit_ledger
                             WHERE client_id = ? AND (expires_at IS NULL OR expires_at > ?)`,
        [player.client_id, new Date().toISOString()])
    : 0;
  return {
    futureBookings, completedBookings, activeCredits, creditTransactions: 0, payments: 0,
    attendanceRecords, performanceEvaluations, futureSessions: 0,
    linkedPlayers: 0, linkedCoachProfile: false,
  };
}

export async function getPlayerDeletionEligibility(env, playerId) {
  const player = await queryOne(env, 'SELECT id FROM players WHERE id = ?', [playerId]);
  if (!player) return { eligible: false, blockingReasons: ['Player not found'], dependencyCounts: {} };

  return runEligibilityChecks(env, [
    ['bookings', 'SELECT COUNT(*) c FROM bookings WHERE player_id = ?'],
    ['attendance', 'SELECT COUNT(*) c FROM attendance WHERE player_id = ?'],
    ['playerPerformance', 'SELECT COUNT(*) c FROM player_performance WHERE player_id = ?'],
  ], playerId);
}

/** Future bookings for a player that must be resolved before deactivation. */
export async function getPlayerFutureBookings(env, playerId) {
  return query(env,
    `SELECT b.id, b.status, b.payment_method, s.id as session_id, s.title as session_title,
            s.session_date, s.start_time
     FROM bookings b JOIN sessions s ON s.id = b.session_id
     WHERE b.player_id = ? AND s.session_date >= ?
       AND b.status IN ('confirmed','pending_payment','pending','backup')
     ORDER BY s.session_date, s.start_time`,
    [playerId, today()]
  );
}

/**
 * Cancel every future booking for a deactivated player and refund any credits
 * spent on them. Mirrors the cancel logic in routes/client/bookings.js
 * (status -> cancelled_by_admin, decrement booked_count only for previously
 * -counted statuses, reuse the real refundCredits, log a booking_amendments
 * row) rather than inventing new cancellation/refund rules.
 */
export async function cancelFutureBookingsForPlayer(env, { playerId, actorId, reason }) {
  const bookings = await query(env,
    `SELECT b.*, s.title as session_name FROM bookings b JOIN sessions s ON s.id = b.session_id
     WHERE b.player_id = ? AND s.session_date >= ?
       AND b.status IN ('confirmed','pending_payment','pending','backup')`,
    [playerId, today()]
  );

  let cancelledCount = 0;
  let refundedCount = 0;
  for (const booking of bookings) {
    const wasAwaitingDecision = ['pending', 'backup'].includes(booking.status);
    const now = new Date().toISOString();

    await execute(env,
      `UPDATE bookings SET status = 'cancelled_by_admin', cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE id = ?`,
      [now, reason || 'Player deactivated', now, booking.id]
    );
    if (!wasAwaitingDecision) {
      await execute(env, 'UPDATE sessions SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0', [booking.session_id]);
    }

    if (booking.payment_method === 'credits') {
      const refundResult = await refundCredits(env, {
        clientId: booking.client_id,
        bookingId: booking.id,
        description: `Refund for cancelled booking: ${booking.session_name} (player deactivated)`,
      });
      if (!refundResult.skipped) refundedCount++;
    }

    await execute(env,
      `INSERT INTO booking_amendments (id, booking_id, amended_by, amendment_type, previous_value, new_value, reason)
       VALUES (?, ?, ?, 'cancel', ?, ?, ?)`,
      [crypto.randomUUID(), booking.id, actorId,
       JSON.stringify({ status: booking.status }),
       JSON.stringify({ status: 'cancelled_by_admin' }),
       reason || 'Player deactivated']
    );
    cancelledCount++;
  }

  return { cancelledCount, refundedCount };
}

/**
 * Reassign a deactivated player's future bookings to another active player
 * belonging to the same client account. Skips (reports as a conflict) any
 * session the target player is already booked into (UNIQUE(player_id, session_id)).
 */
export async function reassignFutureBookingsForPlayer(env, { fromPlayerId, toPlayerId, actorId, reason }) {
  const fromPlayer = await queryOne(env, 'SELECT client_id FROM players WHERE id = ?', [fromPlayerId]);
  const toPlayer = await queryOne(env, 'SELECT id, client_id, status FROM players WHERE id = ?', [toPlayerId]);
  if (!toPlayer) return { error: 'Target player not found' };
  if (!fromPlayer || toPlayer.client_id !== fromPlayer.client_id) {
    return { error: "Target player must belong to the same client account" };
  }
  if (toPlayer.status !== 'active') return { error: 'Target player is not active' };

  const bookings = await query(env,
    `SELECT b.* FROM bookings b JOIN sessions s ON s.id = b.session_id
     WHERE b.player_id = ? AND s.session_date >= ?
       AND b.status IN ('confirmed','pending_payment','pending','backup')`,
    [fromPlayerId, today()]
  );

  let reassignedCount = 0;
  const conflicts = [];
  for (const booking of bookings) {
    const conflict = await queryOne(env, 'SELECT id FROM bookings WHERE player_id = ? AND session_id = ?', [toPlayerId, booking.session_id]);
    if (conflict) { conflicts.push(booking.session_id); continue; }

    const now = new Date().toISOString();
    await execute(env, 'UPDATE bookings SET player_id = ?, updated_at = ? WHERE id = ?', [toPlayerId, now, booking.id]);
    await execute(env,
      `INSERT INTO booking_amendments (id, booking_id, amended_by, amendment_type, previous_value, new_value, reason)
       VALUES (?, ?, ?, 'status_change', ?, ?, ?)`,
      [crypto.randomUUID(), booking.id, actorId,
       JSON.stringify({ playerId: fromPlayerId }),
       JSON.stringify({ playerId: toPlayerId }),
       reason || 'Player deactivated — booking reassigned to another player on the account']
    );
    reassignedCount++;
  }

  return { reassignedCount, conflicts };
}

// ─── COACHES ────────────────────────────────────────────────────────────────

export async function getCoachDeactivationImpact(env, coachId) {
  const [futureSessions, attendanceRecords, performanceEvaluations] = await Promise.all([
    countRows(env, `SELECT COUNT(*) c FROM sessions WHERE coach_id = ? AND status = 'scheduled' AND session_date >= ?`, [coachId, today()]),
    countRows(env, `SELECT COUNT(*) c FROM attendance a JOIN sessions s ON s.id = a.session_id WHERE s.coach_id = ?`, [coachId]),
    countRows(env, `SELECT COUNT(*) c FROM player_performance pp
                     LEFT JOIN sessions s ON s.id = COALESCE(pp.session_id, (SELECT b.session_id FROM bookings b WHERE b.id = pp.booking_id))
                     WHERE s.coach_id = ?`, [coachId]),
  ]);
  return {
    futureBookings: 0, completedBookings: 0, activeCredits: 0, creditTransactions: 0, payments: 0,
    attendanceRecords, performanceEvaluations, futureSessions,
    linkedPlayers: 0, linkedCoachProfile: false,
  };
}

export async function getCoachDeletionEligibility(env, coachId) {
  const coach = await queryOne(env, 'SELECT id FROM coach_profiles WHERE id = ?', [coachId]);
  if (!coach) return { eligible: false, blockingReasons: ['Coach not found'], dependencyCounts: {} };

  return runEligibilityChecks(env, [
    ['sessions', 'SELECT COUNT(*) c FROM sessions WHERE coach_id = ?'],
  ], coachId);
}

/** Future (still-scheduled) sessions assigned to a coach. */
export async function getCoachFutureSessions(env, coachId) {
  return query(env,
    `SELECT id, title, session_date, start_time, end_time FROM sessions
     WHERE coach_id = ? AND status = 'scheduled' AND session_date >= ?
     ORDER BY session_date, start_time`,
    [coachId, today()]
  );
}

/** Bulk-reassign a deactivated coach's future sessions to another active coach. */
export async function reassignFutureSessionsForCoach(env, { fromCoachId, toCoachId, actorId, actorName }) {
  const toCoach = await queryOne(env, 'SELECT id, active FROM coach_profiles WHERE id = ?', [toCoachId]);
  if (!toCoach) return { error: 'Target coach not found' };
  if (!toCoach.active) return { error: 'Target coach is not active' };
  if (toCoachId === fromCoachId) return { error: 'Target coach must be different from the coach being deactivated' };

  const sessions = await query(env,
    `SELECT id FROM sessions WHERE coach_id = ? AND status = 'scheduled' AND session_date >= ?`,
    [fromCoachId, today()]
  );
  const now = new Date().toISOString();
  for (const s of sessions) {
    await execute(env, 'UPDATE sessions SET coach_id = ?, updated_at = ? WHERE id = ?', [toCoachId, now, s.id]);
    await audit(env, {
      actorId, actorName, action: 'update', recordType: 'session', recordId: s.id,
      description: `Session reassigned to another coach (coach deactivation)`,
    });
  }
  return { reassignedCount: sessions.length };
}

/**
 * Cancel a deactivated coach's future sessions using the same non-destructive
 * status update already used by PATCH /api/admin/sessions/:id (status ->
 * 'cancelled'). Does not itself cancel/refund attached bookings — that gap
 * already exists in the session-cancel endpoint today and isn't invented here.
 */
export async function cancelFutureSessionsForCoach(env, { coachId, actorId, actorName }) {
  const sessions = await query(env,
    `SELECT id, title FROM sessions WHERE coach_id = ? AND status = 'scheduled' AND session_date >= ?`,
    [coachId, today()]
  );
  const now = new Date().toISOString();
  for (const s of sessions) {
    await execute(env, `UPDATE sessions SET status = 'cancelled', updated_at = ? WHERE id = ?`, [now, s.id]);
    await audit(env, {
      actorId, actorName, action: 'update', recordType: 'session', recordId: s.id,
      description: `Session cancelled: ${s.title} (coach deactivation)`,
    });
  }
  return { cancelledCount: sessions.length };
}
