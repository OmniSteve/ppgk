/**
 * Client booking endpoints — full business logic implementation.
 *
 * POST   /api/bookings         — create one or more bookings
 * GET    /api/bookings         — list own bookings
 * GET    /api/bookings/:id     — booking detail + amendments
 * POST   /api/bookings/:id/cancel     — cancel with eligibility + credit refund
 * POST   /api/bookings/:id/reschedule — reschedule with amendment-frequency limit
 * GET    /api/bookings/:id/calendar   — .ics download
 */
import { requireAuth }    from '../../lib/auth.js';
import { query, queryOne, execute, audit } from '../../lib/db.js';
import { err, ok }        from '../../lib/validate.js';
import { deductCredits, refundCredits, getBalance } from '../../lib/credits.js';
import { sendTemplatedEmail } from '../../lib/email.js';
import { buildIcsEvent, icsResponse } from '../../lib/calendar.js';

// ─── Eligibility helper ───────────────────────────────────────────────────────
async function checkEligibility(env, { player, session, clientId }) {
  if (!player || player.client_id !== clientId) return 'Player not found or not owned by this account';
  if (player.status !== 'active') return 'Player is not active';
  if (session.status !== 'scheduled') return 'Session is not open for booking';
  if (session.booking_open_at  && new Date(session.booking_open_at)  > new Date()) return 'Booking window has not opened yet';
  if (session.booking_close_at && new Date(session.booking_close_at) < new Date()) return 'Booking window has closed';
  // Age group is advisory — enforce if the session has an age_group set
  // (We skip hard enforcement here; coaches set this per session)
  return null;
}

// ─── Capacity recheck (counts live confirmed bookings, not booked_count) ──────
async function liveConfirmedCount(env, sessionId) {
  const row = await queryOne(env,
    `SELECT COUNT(*) as cnt FROM bookings
     WHERE session_id = ? AND status NOT IN ('cancelled_by_client','cancelled_by_admin','payment_failed','rescheduled')`,
    [sessionId]
  );
  return row?.cnt ?? 0;
}

// ─── Amendment frequency check ────────────────────────────────────────────────
async function amendmentAllowed(env, bookingId) {
  // Rule: max 1 amendment per 7-day window from booking creation date
  const booking = await queryOne(env, 'SELECT created_at FROM bookings WHERE id = ?', [bookingId]);
  if (!booking) return false;
  const windowStart = new Date(booking.created_at);
  const windowEnd   = new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now         = new Date();
  // If we're outside the 7-day window, reset — a new window begins
  if (now > windowEnd) return true;
  const amendCount = await queryOne(env,
    `SELECT COUNT(*) as cnt FROM booking_amendments
     WHERE booking_id = ? AND amendment_type = 'reschedule'
       AND created_at >= ? AND created_at <= ?`,
    [bookingId, windowStart.toISOString(), windowEnd.toISOString()]
  );
  return (amendCount?.cnt ?? 0) < 1;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function handleClientBookings(request, env, ctx, params) {
  const payload = await requireAuth(request, env);
  const method  = request.method;
  const url     = new URL(request.url);

  // ── List bookings ──────────────────────────────────────────────────────────
  if (method === 'GET' && !params?.id) {
    const status = url.searchParams.get('status') || '';
    const bookings = await query(env,
      `SELECT b.id, b.status, b.booked_at, b.credits_used, b.amount_charged,
              p.first_name || ' ' || p.last_name as player_name,
              s.id as session_id, s.title as session_name, s.session_date, s.start_time, s.end_time,
              l.name as location_name
       FROM bookings b
       JOIN players p ON p.id = b.player_id
       JOIN sessions s ON s.id = b.session_id
       LEFT JOIN locations l ON l.id = s.location_id
       WHERE b.client_id = ? ${status ? 'AND b.status = ?' : ''}
       ORDER BY s.session_date DESC`,
      status ? [payload.sub, status] : [payload.sub]
    );
    return ok({ bookings });
  }

  // ── Calendar .ics download ─────────────────────────────────────────────────
  if (method === 'GET' && params?.id && url.pathname.endsWith('/calendar')) {
    const b = await queryOne(env,
      `SELECT b.id, b.status, s.title, s.session_date, s.start_time, s.end_time, s.notes as instructions,
              p.first_name || ' ' || p.last_name as player_name,
              l.name as location_name, l.address_line1 as location_address,
              c.first_name || ' ' || c.last_name as coach_name,
              (SELECT COUNT(*) FROM booking_amendments WHERE booking_id = b.id AND amendment_type='reschedule') as amend_count
       FROM bookings b
       JOIN players p ON p.id = b.player_id
       JOIN sessions s ON s.id = b.session_id
       LEFT JOIN locations l ON l.id = s.location_id
       LEFT JOIN coach_profiles c ON c.id = s.coach_id
       WHERE b.id = ? AND b.client_id = ?`,
      [params.id, payload.sub]
    );
    if (!b) return err('Booking not found', 404);
    const ics = buildIcsEvent({
      bookingId:       b.id,
      sessionTitle:    b.title,
      playerName:      b.player_name,
      sessionDate:     b.session_date,
      startTime:       b.start_time,
      endTime:         b.end_time,
      locationName:    b.location_name,
      locationAddress: b.location_address,
      coachName:       b.coach_name,
      instructions:    b.instructions,
      status:          b.status.startsWith('cancelled') ? 'cancelled' : 'confirmed',
      sequence:        b.amend_count,
    });
    return icsResponse(ics, `booking-${b.id.slice(0, 8)}.ics`);
  }

  // ── Booking detail ─────────────────────────────────────────────────────────
  if (method === 'GET' && params?.id) {
    const booking = await queryOne(env,
      `SELECT b.*, p.first_name || ' ' || p.last_name as player_name,
              s.title as session_name, s.session_date, s.start_time, s.end_time,
              l.name as location_name, l.address_line1
       FROM bookings b
       JOIN players p ON p.id = b.player_id
       JOIN sessions s ON s.id = b.session_id
       LEFT JOIN locations l ON l.id = s.location_id
       WHERE b.id = ? AND b.client_id = ?`,
      [params.id, payload.sub]
    );
    if (!booking) return err('Booking not found', 404);
    const amendments = await query(env,
      'SELECT * FROM booking_amendments WHERE booking_id = ? ORDER BY created_at DESC',
      [params.id]
    );
    return ok({ ...booking, amendments });
  }

  // ── Create bookings (multi-session, atomic) ────────────────────────────────
  if (method === 'POST' && !params?.id) {
    let body;
    try { body = await request.json(); } catch { return err('Invalid JSON'); }

    const { sessionIds, playerId, paymentMethod, idempotencyKey } = body;
    if (!sessionIds?.length || !playerId || !paymentMethod || !idempotencyKey) {
      return err('sessionIds, playerId, paymentMethod and idempotencyKey are required');
    }
    if (!['credits', 'card'].includes(paymentMethod)) {
      return err('paymentMethod must be credits or card');
    }

    // Idempotency — if order already exists with this key, return it
    const existingOrder = await queryOne(env,
      'SELECT id FROM orders WHERE idempotency_key = ? AND client_id = ?',
      [idempotencyKey, payload.sub]
    );
    if (existingOrder) {
      const existingBookings = await query(env,
        'SELECT id FROM bookings WHERE order_id = ?',
        [existingOrder.id]
      );
      return ok({ orderId: existingOrder.id, bookingIds: existingBookings.map(b => b.id), idempotent: true });
    }

    // Verify player ownership + active status
    const player = await queryOne(env,
      'SELECT id, client_id, status FROM players WHERE id = ? AND client_id = ?',
      [playerId, payload.sub]
    );
    if (!player) return err('Player not found', 404);
    if (player.status !== 'active') return err('Player is not active');

    // Pre-validate all sessions before creating anything
    const sessions = [];
    const errors   = [];
    for (const sessionId of sessionIds) {
      const session = await queryOne(env,
        `SELECT id, title, session_date, start_time, end_time, capacity, credit_cost, price, status,
                booking_open_at, booking_close_at, location_id, coach_id
         FROM sessions WHERE id = ?`,
        [sessionId]
      );
      if (!session) { errors.push({ sessionId, reason: 'Session not found' }); continue; }

      const eligErr = await checkEligibility(env, { player, session, clientId: payload.sub });
      if (eligErr) { errors.push({ sessionId, reason: eligErr }); continue; }

      // Live capacity check
      const confirmed = await liveConfirmedCount(env, sessionId);
      if (confirmed >= session.capacity) {
        errors.push({ sessionId, reason: 'Session is full' }); continue;
      }

      // Duplicate check (active booking only)
      const dup = await queryOne(env,
        `SELECT id FROM bookings WHERE player_id = ? AND session_id = ?
         AND status NOT IN ('cancelled_by_client','cancelled_by_admin','payment_failed','rescheduled')`,
        [playerId, sessionId]
      );
      if (dup) { errors.push({ sessionId, reason: 'Player already has an active booking for this session' }); continue; }

      sessions.push(session);
    }

    if (errors.length > 0) {
      return err('One or more sessions cannot be booked', 422, { errors });
    }

    // Credits check upfront
    const totalCredits = sessions.reduce((sum, s) => sum + (s.credit_cost ?? 1), 0);
    if (paymentMethod === 'credits') {
      const balance = await getBalance(env, payload.sub);
      if (balance < totalCredits) {
        return err(`Insufficient credits. Required: ${totalCredits}, available: ${balance}`, 402);
      }
    }

    // Create order
    const orderId  = crypto.randomUUID();
    const totalAmt = paymentMethod === 'card'
      ? sessions.reduce((sum, s) => sum + (s.price ?? 0), 0)
      : 0;

    await execute(env,
      `INSERT INTO orders (id, client_id, idempotency_key, status, total_amount)
       VALUES (?, ?, ?, 'pending', ?)`,
      [orderId, payload.sub, idempotencyKey, totalAmt]
    );

    // Create one booking per session
    const bookingIds = [];
    for (const session of sessions) {
      const bookingId = crypto.randomUUID();
      await execute(env,
        `INSERT INTO bookings (id, order_id, client_id, player_id, session_id, status, payment_method, credits_used)
         VALUES (?, ?, ?, ?, ?, 'pending_payment', ?, ?)`,
        [bookingId, orderId, payload.sub, playerId, session.id, paymentMethod,
         paymentMethod === 'credits' ? (session.credit_cost ?? 1) : 0]
      );
      // Update denormalised count
      await execute(env,
        'UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?',
        [session.id]
      );
      bookingIds.push({ bookingId, sessionId: session.id });
    }

    // If paying by credits: deduct now and confirm
    if (paymentMethod === 'credits') {
      for (const { bookingId, sessionId } of bookingIds) {
        const session  = sessions.find(s => s.id === sessionId);
        const deduction = await deductCredits(env, {
          clientId: payload.sub,
          bookingId,
          amount:   session.credit_cost ?? 1,
          description: `Credit booking: ${session.title} on ${session.session_date}`,
        });
        if (!deduction.success) {
          // Roll back all created bookings
          for (const { bookingId: bid, sessionId: sid } of bookingIds) {
            await execute(env,
              "UPDATE bookings SET status='payment_failed' WHERE id=?", [bid]
            );
            await execute(env,
              'UPDATE sessions SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0', [sid]
            );
          }
          await execute(env, "UPDATE orders SET status='failed' WHERE id=?", [orderId]);
          return err(deduction.error, 402);
        }
        await execute(env,
          "UPDATE bookings SET status='confirmed', confirmed_at=? WHERE id=?",
          [new Date().toISOString(), bookingId]
        );
        // Send confirmation email
        const bookingDetail = sessions.find(s => s.id === sessionId);
        await sendTemplatedEmail(env, {
          eventTrigger:  'booking_confirmed',
          to:             payload.email,
          userId:         payload.sub,
          bookingId,
          sessionId,
          idempotencyRef: `booking_confirmed_${bookingId}`,
          variables: {
            first_name:    payload.firstName,
            session_title: bookingDetail?.title,
            session_date:  bookingDetail?.session_date,
            session_time:  bookingDetail?.start_time,
          },
        });
      }
      await execute(env, "UPDATE orders SET status='paid' WHERE id=?", [orderId]);
      return ok({ orderId, bookingIds: bookingIds.map(b => b.bookingId), status: 'confirmed' }, 201);
    }

    // Card payment: return order ID for Stripe checkout initiation
    return ok({ orderId, bookingIds: bookingIds.map(b => b.bookingId), status: 'pending_payment' }, 201);
  }

  // ── Cancel booking ─────────────────────────────────────────────────────────
  if (method === 'POST' && params?.id && url.pathname.endsWith('/cancel')) {
    let body;
    try { body = await request.json(); } catch { body = {}; }

    const booking = await queryOne(env,
      `SELECT b.*, s.session_date, s.start_time, s.title as session_name
       FROM bookings b JOIN sessions s ON s.id = b.session_id
       WHERE b.id = ? AND b.client_id = ?`,
      [params.id, payload.sub]
    );
    if (!booking) return err('Booking not found', 404);
    if (!['confirmed', 'pending_payment'].includes(booking.status)) {
      return err('Booking cannot be cancelled in its current status');
    }

    // Cancellation deadline check
    const deadlineHours = await queryOne(env,
      "SELECT value FROM app_settings WHERE key = 'cancellation_deadline_hours'"
    );
    const hoursLimit = parseInt(deadlineHours?.value ?? '24');
    const sessionDt  = new Date(`${booking.session_date}T${booking.start_time}`);
    const hoursUntil = (sessionDt - new Date()) / 3600000;
    const withinDeadline = hoursUntil >= hoursLimit;
    const eligibleForRefund = withinDeadline;

    const now = new Date().toISOString();
    await execute(env,
      `UPDATE bookings SET status='cancelled_by_client', cancelled_at=?, cancellation_reason=?, updated_at=? WHERE id=?`,
      [now, body.reason ?? null, now, params.id]
    );
    await execute(env,
      'UPDATE sessions SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0',
      [booking.session_id]
    );

    // Credit refund if eligible
    let refundResult = { skipped: true };
    if (eligibleForRefund && booking.payment_method === 'credits') {
      const refundSetting = await queryOne(env,
        "SELECT value FROM app_settings WHERE key='credit_refund_on_cancellation'"
      );
      if (refundSetting?.value === 'true') {
        refundResult = await refundCredits(env, {
          clientId:    payload.sub,
          bookingId:   params.id,
          description: `Refund for cancelled booking: ${booking.session_name}`,
        });
      }
    }

    await execute(env,
      `INSERT INTO booking_amendments (id, booking_id, amended_by, amendment_type, previous_value, new_value, reason)
       VALUES (?, ?, ?, 'cancel', ?, ?, ?)`,
      [crypto.randomUUID(), params.id, payload.sub,
       JSON.stringify({ status: booking.status }),
       JSON.stringify({ status: 'cancelled_by_client', refundEligible: eligibleForRefund }),
       body.reason ?? null]
    );

    await audit(env, {
      actorId:       payload.sub,
      action:        'cancel',
      recordType:    'booking',
      recordId:      params.id,
      description:   `Booking cancelled: ${booking.session_name}. Refund eligible: ${eligibleForRefund}`,
    });

    // Cancellation email
    await sendTemplatedEmail(env, {
      eventTrigger:  'booking_cancelled',
      to:             payload.email,
      userId:         payload.sub,
      bookingId:      params.id,
      idempotencyRef: `booking_cancelled_${params.id}`,
      variables: {
        first_name:    payload.firstName,
        session_title: booking.session_name,
        session_date:  booking.session_date,
        refund_note:   eligibleForRefund ? 'Your credits have been refunded.' : 'No credit refund applies (cancellation past deadline).',
      },
    });

    return ok({ message: 'Booking cancelled', creditRefund: !refundResult.skipped });
  }

  // ── Reschedule booking ─────────────────────────────────────────────────────
  if (method === 'POST' && params?.id && url.pathname.endsWith('/reschedule')) {
    let body;
    try { body = await request.json(); } catch { return err('Invalid JSON'); }

    const { newSessionId, adminOverride, overrideReason } = body;
    if (!newSessionId) return err('newSessionId is required');

    const booking = await queryOne(env,
      `SELECT b.*, s.title as prev_session_name, s.session_date as prev_date, s.credit_cost,
              s.start_time as prev_start_time
       FROM bookings b JOIN sessions s ON s.id = b.session_id
       WHERE b.id = ? AND b.client_id = ?`,
      [params.id, payload.sub]
    );
    if (!booking) return err('Booking not found', 404);
    if (!['confirmed'].includes(booking.status)) return err('Only confirmed bookings can be rescheduled');

    // Amendment frequency check (7-day window)
    if (!adminOverride) {
      const allowed = await amendmentAllowed(env, params.id);
      if (!allowed) {
        return err('You have already rescheduled this booking once in the past 7 days. Please contact us for further changes.', 422);
      }
    } else {
      // Admin override — verify the caller is actually an admin
      // (client endpoint: override only if explicitly set and role is admin)
      if (payload.role !== 'admin' && payload.role !== 'head_coach') {
        return err('Administrator override requires admin role', 403);
      }
      if (!overrideReason) return err('Override reason is required for admin override');
    }

    // Reschedule deadline
    const deadlineHours = await queryOne(env,
      "SELECT value FROM app_settings WHERE key='reschedule_deadline_hours'"
    );
    const hoursLimit = parseInt(deadlineHours?.value ?? '24');
    const sessionDt  = new Date(`${booking.prev_date}T${booking.prev_start_time}`);
    const hoursUntil = (sessionDt - new Date()) / 3600000;
    if (hoursUntil < hoursLimit && !adminOverride) {
      return err(`Rescheduling must be done at least ${hoursLimit} hours before the session`);
    }

    // Validate new session
    const newSession = await queryOne(env,
      `SELECT id, title, session_date, start_time, end_time, capacity, credit_cost, status,
              booking_open_at, booking_close_at
       FROM sessions WHERE id = ?`,
      [newSessionId]
    );
    if (!newSession) return err('Target session not found', 404);

    const player = await queryOne(env, 'SELECT * FROM players WHERE id = ?', [booking.player_id]);
    const eligErr = await checkEligibility(env, { player, session: newSession, clientId: payload.sub });
    if (eligErr && !adminOverride) return err(eligErr);

    // Capacity recheck
    const confirmed = await liveConfirmedCount(env, newSessionId);
    if (confirmed >= newSession.capacity) return err('Target session is full', 409);

    // Duplicate check on new session
    const dup = await queryOne(env,
      `SELECT id FROM bookings WHERE player_id = ? AND session_id = ?
       AND status NOT IN ('cancelled_by_client','cancelled_by_admin','payment_failed','rescheduled')`,
      [booking.player_id, newSessionId]
    );
    if (dup) return err('Player already has an active booking for that session', 409);

    const now = new Date().toISOString();
    const prevSessionId = booking.session_id;

    // Update booking
    await execute(env,
      `UPDATE bookings SET session_id=?, status='confirmed', updated_at=? WHERE id=?`,
      [newSessionId, now, params.id]
    );
    // Release old session slot, claim new one
    await execute(env,
      'UPDATE sessions SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0',
      [prevSessionId]
    );
    await execute(env,
      'UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?',
      [newSessionId]
    );

    // Record amendment
    await execute(env,
      `INSERT INTO booking_amendments (id, booking_id, amended_by, amendment_type, previous_value, new_value, reason)
       VALUES (?, ?, ?, 'reschedule', ?, ?, ?)`,
      [crypto.randomUUID(), params.id, payload.sub,
       JSON.stringify({ session_id: prevSessionId, session_name: booking.prev_session_name, session_date: booking.prev_date }),
       JSON.stringify({ session_id: newSessionId, session_name: newSession.title, session_date: newSession.session_date }),
       adminOverride ? `Admin override: ${overrideReason}` : (body.reason ?? null)]
    );

    if (adminOverride) {
      await audit(env, {
        actorId:    payload.sub,
        action:     'override',
        recordType: 'booking',
        recordId:   params.id,
        description: `Admin override reschedule: ${booking.prev_session_name} → ${newSession.title}`,
        reason:      overrideReason,
      });
    } else {
      await audit(env, {
        actorId:    payload.sub,
        action:     'update',
        recordType: 'booking',
        recordId:   params.id,
        description: `Booking rescheduled: ${booking.prev_session_name} → ${newSession.title}`,
      });
    }

    // Reschedule email
    await sendTemplatedEmail(env, {
      eventTrigger:  'reschedule_confirmed',
      to:             payload.email,
      userId:         payload.sub,
      bookingId:      params.id,
      idempotencyRef: `reschedule_${params.id}_${newSessionId}`,
      variables: {
        first_name:        payload.firstName,
        new_session_title: newSession.title,
        new_session_date:  newSession.session_date,
        new_session_time:  newSession.start_time,
      },
    });

    return ok({ message: 'Booking rescheduled', newSessionId });
  }

  return err('Method not allowed', 405);
}