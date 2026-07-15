/**
 * Session roster management for request-mode sessions.
 *
 * GET   /api/coach/sessions/:id/roster
 * PATCH /api/coach/sessions/:id/roster/:bookingId   body: { action }
 *   action ∈ 'confirm' | 'backup' | 'decline' | 'pending' | 'remove'
 *
 * Coaches may only manage sessions they are assigned to (session.coach_id);
 * admins/head_coach follow the exact same ownership pattern already used
 * in coach/sessions.js (`isAdmin` bypass).
 */
import { requireRole } from '../../lib/auth.js';
import { queryOne, query, execute } from '../../lib/db.js';
import { ok, err } from '../../lib/validate.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';
import { refundCredits } from '../../lib/credits.js';
import { isValidTransition, notifyBookingStatus, recordRosterChange } from '../../lib/roster.js';

const POOL_FIELDS = `
  b.id as booking_id, b.status as booking_status, b.booked_at, b.credits_used,
  p.id as player_id, p.first_name, p.last_name, p.date_of_birth, p.medical_info, p.allergies,
  u.id as client_id, u.first_name || ' ' || u.last_name as client_name, u.email as client_email
`;

async function loadSessionForRoster(env, sessionId, payload) {
  const session = await queryOne(env,
    `SELECT s.*, l.name as location_name FROM sessions s
     LEFT JOIN locations l ON l.id = s.location_id WHERE s.id = ?`,
    [sessionId]
  );
  if (!session) return { error: err('Session not found', 404) };

  if (payload.role !== 'admin') {
    const coach = await queryOne(env, 'SELECT id FROM coach_profiles WHERE user_id = ? AND active = 1', [payload.sub]);
    if (!coach || session.coach_id !== coach.id) {
      return { error: err('You are not authorised to manage this session', 403) };
    }
  }
  return { session };
}

async function loadPool(env, sessionId, status) {
  const rows = await query(env,
    `SELECT ${POOL_FIELDS}
     FROM bookings b
     JOIN players p ON p.id = b.player_id
     JOIN users u ON u.id = b.client_id
     WHERE b.session_id = ? AND b.status = ?
     ORDER BY b.booked_at ASC, p.first_name ASC`,
    [sessionId, status]
  );
  return toCamelArray(rows);
}

export async function handleCoachRoster(request, env, ctx, params) {
  const payload = await requireRole(request, env, 'coach', 'head_coach', 'admin');
  const method  = request.method;

  const { session, error } = await loadSessionForRoster(env, params.id, payload);
  if (error) return error;

  // ── GET roster ──────────────────────────────────────────────────────────
  if (method === 'GET') {
    const [confirmed, pending, backup] = await Promise.all([
      loadPool(env, session.id, 'confirmed'),
      loadPool(env, session.id, 'pending'),
      loadPool(env, session.id, 'backup'),
    ]);

    return ok({
      session: {
        id: session.id, title: session.title, sessionDate: session.session_date,
        startTime: session.start_time, endTime: session.end_time,
        locationName: session.location_name, capacity: session.capacity,
        bookingMode: session.booking_mode,
        confirmedCount: confirmed.length, pendingCount: pending.length, backupCount: backup.length,
      },
      confirmed, pending, backup,
    });
  }

  // ── PATCH a booking's roster status ────────────────────────────────────
  if (method === 'PATCH' && params?.bookingId) {
    const body = await request.json().catch(() => ({}));
    const { action } = body;
    if (!['confirm', 'backup', 'decline', 'pending', 'remove'].includes(action)) {
      return err('action must be one of confirm, backup, decline, pending, remove');
    }

    const booking = await queryOne(env,
      `SELECT b.*, p.first_name, p.last_name, u.email as client_email, u.first_name as client_first_name
       FROM bookings b
       JOIN players p ON p.id = b.player_id
       JOIN users u ON u.id = b.client_id
       WHERE b.id = ? AND b.session_id = ?`,
      [params.bookingId, session.id]
    );
    if (!booking) return err('Booking not found for this session', 404);

    const targetStatus = {
      confirm: 'confirmed',
      backup:  'backup',
      decline: 'declined',
      pending: 'pending',
      remove:  'cancelled_by_admin',
    }[action];

    if (!isValidTransition(booking.status, targetStatus)) {
      return err(`Cannot move a booking from "${booking.status}" to "${targetStatus}"`, 409);
    }

    const now = new Date().toISOString();
    let result;

    if (targetStatus === 'confirmed') {
      // Single conditional UPDATE — the capacity check is embedded in the
      // WHERE clause and evaluated atomically by SQLite, so two coaches
      // confirming at the same moment cannot both succeed past capacity.
      result = await execute(env,
        `UPDATE bookings SET status = 'confirmed', confirmed_at = ?, updated_at = ?
         WHERE id = ? AND session_id = ? AND status IN ('pending', 'backup')
           AND (SELECT COUNT(*) FROM bookings b2 WHERE b2.session_id = ? AND b2.status = 'confirmed')
               < (SELECT capacity FROM sessions WHERE id = ?)`,
        [now, now, booking.id, session.id, session.id, session.id]
      );
      if (!result.changes) {
        return err('Session is full — no capacity available to confirm this player', 409);
      }
      await execute(env, 'UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?', [session.id]);
    } else {
      result = await execute(env,
        `UPDATE bookings SET status = ?, updated_at = ? WHERE id = ? AND session_id = ? AND status = ?`,
        [targetStatus, now, booking.id, session.id, booking.status]
      );
      if (!result.changes) {
        return err('This booking has already changed status — please refresh', 409);
      }
      if (booking.status === 'confirmed') {
        await execute(env, 'UPDATE sessions SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0', [session.id]);
      }
    }

    await recordRosterChange(env, {
      bookingId: booking.id, sessionId: session.id, playerId: booking.player_id,
      previousStatus: booking.status, newStatus: targetStatus,
      actorId: payload.sub, actorName: `${payload.firstName} ${payload.lastName}`,
      reason: body.reason,
    });

    let creditRefund = { skipped: true };
    if (['declined', 'cancelled_by_admin'].includes(targetStatus)) {
      creditRefund = await refundCredits(env, {
        clientId: booking.client_id, bookingId: booking.id,
        description: `Credit refund: booking ${action === 'remove' ? 'removed from roster' : 'declined'}`,
      });
    }

    const playerFirstName = booking.client_first_name;
    const notifyMap = {
      confirmed: 'booking_confirmed',
      backup:    'booking_backup',
      declined:  'booking_declined',
    };
    const eventTrigger = targetStatus === 'cancelled_by_admin' ? 'booking_cancelled' : notifyMap[targetStatus];
    if (eventTrigger) {
      await notifyBookingStatus(env, {
        eventTrigger, bookingId: booking.id, playerId: booking.player_id, sessionId: session.id,
        to: booking.client_email, firstName: playerFirstName,
        variables: {
          session_title: session.title, session_date: session.session_date, session_time: session.start_time,
          refund_note: creditRefund.skipped ? '' : 'Your credit has been refunded to your balance.',
        },
      });
    }

    return ok({ message: 'Roster updated', bookingId: booking.id, status: targetStatus });
  }

  return err('Method not allowed', 405);
}
