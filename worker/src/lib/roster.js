/**
 * Shared logic for the session booking → coach roster workflow.
 * Used by client/bookings.js (request creation/cancellation) and
 * coach/roster.js (coach/admin roster decisions).
 */
import { query, execute, audit } from './db.js';
import { sendTemplatedEmail } from './email.js';

/** Valid booking_status transitions for request-mode sessions. */
export const TRANSITIONS = {
  pending:   ['confirmed', 'backup', 'declined', 'cancelled_by_client', 'cancelled_by_admin'],
  backup:    ['confirmed', 'pending', 'declined', 'cancelled_by_client', 'cancelled_by_admin'],
  confirmed: ['backup', 'cancelled_by_client', 'cancelled_by_admin', 'declined'],
};

export function isValidTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

/**
 * Statuses that block a new booking/request for the same player+session.
 * Deliberately excludes 'pending_payment' — an abandoned card checkout is
 * meant to be *reused* by a fresh attempt (see the existingFailed lookup in
 * client/bookings.js), not treated as a duplicate that blocks retrying.
 */
export const ACTIVE_BLOCKING_STATUSES = ['pending', 'backup', 'confirmed'];

export async function countByStatus(env, sessionId, statuses) {
  const placeholders = statuses.map(() => '?').join(',');
  const rows = await query(env,
    `SELECT COUNT(*) as cnt FROM bookings WHERE session_id = ? AND status IN (${placeholders})`,
    [sessionId, ...statuses]
  );
  return rows[0]?.cnt ?? 0;
}

/**
 * Send the templated email for a booking-status event. Non-fatal on
 * failure (matches every other call site in this codebase) and idempotent
 * via a stable idempotencyRef of `${eventTrigger}_${bookingId}`.
 */
export async function notifyBookingStatus(env, { eventTrigger, bookingId, playerId, sessionId, to, firstName, variables = {} }) {
  try {
    return await sendTemplatedEmail(env, {
      eventTrigger,
      to,
      bookingId,
      sessionId,
      idempotencyRef: `${eventTrigger}_${bookingId}`,
      variables: { first_name: firstName ?? '', ...variables },
    });
  } catch (e) {
    console.error(`[roster] ${eventTrigger} email failed (non-fatal):`, e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Record a roster status change: booking_amendments (existing amendment
 * history table) + audit_log. No extra personal information beyond what
 * the existing audit helper already carries.
 */
export async function recordRosterChange(env, { bookingId, sessionId, playerId, previousStatus, newStatus, actorId, actorName, reason }) {
  await execute(env,
    `INSERT INTO booking_amendments (id, booking_id, amended_by, amendment_type, previous_value, new_value, reason)
     VALUES (?, ?, ?, 'status_change', ?, ?, ?)`,
    [crypto.randomUUID(), bookingId, actorId,
     JSON.stringify({ status: previousStatus }),
     JSON.stringify({ status: newStatus }),
     reason ?? null]
  );

  await audit(env, {
    actorId, actorName, action: 'update', recordType: 'booking', recordId: bookingId,
    description: `Roster status changed: ${previousStatus} -> ${newStatus} (session ${sessionId}, player ${playerId})`,
    previousValue: { status: previousStatus },
    newValue: { status: newStatus },
  });
}
