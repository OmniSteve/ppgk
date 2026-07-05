/**
 * Client booking endpoints.
 *
 * POST   /api/bookings         — create bookings
 * GET    /api/bookings         — list own bookings
 * GET    /api/bookings/:id     — booking detail
 * POST   /api/bookings/:id/cancel
 * POST   /api/bookings/:id/reschedule
 * GET    /api/bookings/:id/calendar
 */
import { requireAuth }    from '../../lib/auth.js';
import { query, queryOne, execute, audit } from '../../lib/db.js';
import { err, ok }        from '../../lib/validate.js';
import { deductCredits, refundCredits, getBalance } from '../../lib/credits.js';
import { sendTemplatedEmail } from '../../lib/email.js';
import { buildIcsEvent, icsResponse } from '../../lib/calendar.js';

async function checkEligibility(env, { player, session, clientId }) {
  if (!player || player.client_id !== clientId) return 'Player not found or not owned by this account';
  if (player.status !== 'active') return 'Player is not active';
  if (session.status !== 'scheduled') return 'Session is not open for booking';
  if (session.booking_open_at  && new Date(session.booking_open_at)  > new Date()) return 'Booking window has not opened yet';
  if (session.booking_close_at && new Date(session.booking_close_at) < new Date()) return 'Booking window has closed';
  return null;
}

async function liveConfirmedCount(env, sessionId) {
  const row = await queryOne(env,
    `SELECT COUNT(*) as cnt FROM bookings
     WHERE session_id = ? AND status NOT IN ('cancelled_by_client','cancelled_by_admin','payment_failed','rescheduled')`,
    [sessionId]
  );
  return row?.cnt ?? 0;
}

async function amendmentAllowed(env, bookingId) {
  const booking = await queryOne(env, 'SELECT created_at FROM bookings WHERE id = ?', [bookingId]);
  if (!booking) return false;
  const windowStart = new Date(booking.created_at);
  const windowEnd   = new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now         = new Date();
  if (now > windowEnd) return true;
  const amendCount = await queryOne(env,
    `SELECT COUNT(*) as cnt FROM booking_amendments
     WHERE booking_id = ? AND amendment_type = 'reschedule'
       AND created_at >= ? AND created_at <= ?`,
    [bookingId, windowStart.toISOString(), windowEnd.toISOString()]
  );
  return (amendCount?.cnt ?? 0) < 1;
}

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
      bookingId: b.id, sessionTitle: b.title, playerName: b.player_name,
      sessionDate: b.session_date, startTime: b.start_time, endTime: b.end_time,
      locationName: b.location_name, locationAddress: b.location_address,
      coachName: b.coach_name, instructions: b.instructions,
      status: b.status.startsWith('cancelled') ? 'cancelled' : 'confirmed',
      sequence: b.amend_count,
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

  // ── Create bookings ────────────────────────────────────────────────────────
  if (method === 'POST' && !params?.id) {
    let body;
    try { body = await request.json(); } catch { return err('Invalid JSON'); }

    let step = 'start';
    try {
      step = 'parse body fields';
      const { sessionIds, playerId, paymentMethod, idempotencyKey } = body;
      if (!sessionIds?.length || !playerId || !paymentMethod || !idempotencyKey) {
        return err('sessionIds, playerId, paymentMethod and idempotencyKey are required');
      }
      if (!['credits', 'card'].includes(paymentMethod)) {
        return err('paymentMethod must be credits or card');
      }

      step = 'check idempotency';
      const existingOrder = await queryOne(env,
        'SELECT id FROM orders WHERE idempotency_key = ? AND client_id = ?',
        [idempotencyKey, payload.sub]
      );
      if (existingOrder) {
        const existingBookings = await query(env, 'SELECT id FROM bookings WHERE order_id = ?', [existingOrder.id]);
        return ok({ orderId: existingOrder.id, bookingIds: existingBookings.map(b => b.id), idempotent: true });
      }

      step = 'validate player';
      const player = await queryOne(env,
        'SELECT id, client_id, status FROM players WHERE id = ? AND client_id = ?',
        [playerId, payload.sub]
      );
      if (!player) return err('Player not found', 404);
      if (player.status !== 'active') return err('Player is not active');

      step = 'validate sessions';
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

        step = 'check session capacity';
        const confirmed = await liveConfirmedCount(env, sessionId);
        if (confirmed >= session.capacity) { errors.push({ sessionId, reason: 'Session is full' }); continue; }

        step = 'check duplicate booking';
        const dup = await queryOne(env,
          `SELECT id FROM bookings WHERE player_id = ? AND session_id = ?
           AND status NOT IN ('cancelled_by_client','cancelled_by_admin','payment_failed','rescheduled')`,
          [playerId, sessionId]
        );
        if (dup) { errors.push({ sessionId, reason: 'Player already has an active booking for this session' }); continue; }
        sessions.push(session);
      }
      if (errors.length > 0) return err('One or more sessions cannot be booked', 422, { errors });

      step = 'check credit balance';
      const totalCredits = sessions.reduce((sum, s) => sum + (s.credit_cost ?? 1), 0);
      if (paymentMethod === 'credits') {
        const balance = await getBalance(env, payload.sub);
        if (balance < totalCredits) {
          return err(`Insufficient credits. Required: ${totalCredits}, available: ${balance}`, 402);
        }
      }

      step = 'insert order';
      const orderId  = crypto.randomUUID();
      const totalAmt = paymentMethod === 'card' ? sessions.reduce((sum, s) => sum + (s.price ?? 0), 0) : 0;
      await execute(env,
        `INSERT INTO orders (id, client_id, idempotency_key, status, total_amount) VALUES (?, ?, ?, 'pending', ?)`,
        [orderId, payload.sub, idempotencyKey, totalAmt]
      );

      step = 'insert bookings';
      const bookingIds = [];
      for (const session of sessions) {
        // Check for an existing failed/abandoned booking for this player+session.
        // The UNIQUE constraint on (player_id, session_id) means we must reuse it
        // rather than inserting a duplicate row.
        const existingFailed = await queryOne(env,
          `SELECT id FROM bookings WHERE player_id = ? AND session_id = ?
           AND status IN ('payment_failed', 'pending_payment')`,
          [playerId, session.id]
        );

        let bookingId;
        if (existingFailed) {
          // Reuse the existing row — update it to a fresh pending_payment state
          bookingId = existingFailed.id;
          await execute(env,
            `UPDATE bookings SET order_id=?, status='pending_payment', payment_method=?,
             credits_used=?, confirmed_at=NULL, updated_at=?
             WHERE id=?`,
            [orderId, paymentMethod,
             paymentMethod === 'credits' ? (session.credit_cost ?? 1) : 0,
             new Date().toISOString(), bookingId]
          );
          // Don't increment booked_count — this slot was already counted when the original booking was created
        } else {
          bookingId = crypto.randomUUID();
          await execute(env,
            `INSERT INTO bookings (id, order_id, client_id, player_id, session_id, status, payment_method, credits_used)
             VALUES (?, ?, ?, ?, ?, 'pending_payment', ?, ?)`,
            [bookingId, orderId, payload.sub, playerId, session.id, paymentMethod,
             paymentMethod === 'credits' ? (session.credit_cost ?? 1) : 0]
          );
          await execute(env, 'UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?', [session.id]);
        }
        bookingIds.push({ bookingId, sessionId: session.id, isNew: !existingFailed });
      }

      if (paymentMethod === 'credits') {
        for (const { bookingId, sessionId } of bookingIds) {
          const session = sessions.find(s => s.id === sessionId);

          step = 'deduct credits';
          const deduction = await deductCredits(env, {
            clientId: payload.sub,
            bookingId,
            amount:   session.credit_cost ?? 1,
            description: `Credit booking: ${session.title} on ${session.session_date}`,
          });

          if (!deduction.success) {
            for (const { bookingId: bid, sessionId: sid, isNew } of bookingIds) {
              await execute(env, "UPDATE bookings SET status='payment_failed' WHERE id=?", [bid]);
              // Only decrement booked_count for newly inserted bookings, not reused ones
              if (isNew) {
                await execute(env, 'UPDATE sessions SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0', [sid]);
              }
            }
            await execute(env, "UPDATE orders SET status='failed' WHERE id=?", [orderId]);
            return err(deduction.error, 402);
          }

          step = 'confirm booking';
          await execute(env,
            "UPDATE bookings SET status='confirmed', confirmed_at=? WHERE id=?",
            [new Date().toISOString(), bookingId]
          );

          step = 'send notification email';
          try {
            await sendTemplatedEmail(env, {
              eventTrigger:  'booking_confirmed',
              to:             payload.email,
              userId:         payload.sub,
              bookingId,
              sessionId,
              idempotencyRef: `booking_confirmed_${bookingId}`,
              variables: {
                first_name:    payload.firstName ?? '',
                session_title: session.title ?? '',
                session_date:  session.session_date ?? '',
                session_time:  session.start_time ?? '',
              },
            });
          } catch (emailErr) {
            console.error('CHECKOUT email send failed (non-fatal):', emailErr.message);
          }
        }

        step = 'mark order paid';
        await execute(env, "UPDATE orders SET status='paid' WHERE id=?", [orderId]);

        step = 'return success';
        return ok({ orderId, bookingIds: bookingIds.map(b => b.bookingId), status: 'confirmed' }, 201);
      }

      // Card payment
      step = 'return pending payment';
      return ok({ orderId, bookingIds: bookingIds.map(b => b.bookingId), status: 'pending_payment' }, 201);

    } catch (e) {
      console.error('CHECKOUT_CONFIRM_FAILED', { step, message: e?.message, name: e?.name, stack: e?.stack });
      return new Response(JSON.stringify({
        error: 'Checkout failed',
        step,
        message: e?.message,
        name: e?.name,
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
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

    const deadlineHours = await queryOne(env, "SELECT value FROM app_settings WHERE key = 'cancellation_deadline_hours'");
    const hoursLimit = parseInt(deadlineHours?.value ?? '24');
    const sessionDt  = new Date(`${booking.session_date}T${booking.start_time}`);
    const hoursUntil = (sessionDt - new Date()) / 3600000;
    const eligibleForRefund = hoursUntil >= hoursLimit;

    const now = new Date().toISOString();
    await execute(env,
      `UPDATE bookings SET status='cancelled_by_client', cancelled_at=?, cancellation_reason=?, updated_at=? WHERE id=?`,
      [now, body.reason ?? null, now, params.id]
    );
    await execute(env, 'UPDATE sessions SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0', [booking.session_id]);

    let refundResult = { skipped: true };
    if (eligibleForRefund && booking.payment_method === 'credits') {
      const refundSetting = await queryOne(env, "SELECT value FROM app_settings WHERE key='credit_refund_on_cancellation'");
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
      actorId: payload.sub, action: 'cancel', recordType: 'booking', recordId: params.id,
      description: `Booking cancelled: ${booking.session_name}. Refund eligible: ${eligibleForRefund}`,
    });

    try {
      await sendTemplatedEmail(env, {
        eventTrigger: 'booking_cancelled', to: payload.email, userId: payload.sub,
        bookingId: params.id, idempotencyRef: `booking_cancelled_${params.id}`,
        variables: {
          first_name: payload.firstName ?? '', session_title: booking.session_name,
          session_date: booking.session_date,
          refund_note: eligibleForRefund ? 'Your credits have been refunded.' : 'No credit refund applies (cancellation past deadline).',
        },
      });
    } catch (e) { console.error('Cancel email failed (non-fatal):', e.message); }

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

    if (!adminOverride) {
      const allowed = await amendmentAllowed(env, params.id);
      if (!allowed) return err('You have already rescheduled this booking once in the past 7 days. Please contact us for further changes.', 422);
    } else {
      if (payload.role !== 'admin' && payload.role !== 'head_coach') return err('Administrator override requires admin role', 403);
      if (!overrideReason) return err('Override reason is required for admin override');
    }

    const deadlineHours = await queryOne(env, "SELECT value FROM app_settings WHERE key='reschedule_deadline_hours'");
    const hoursLimit = parseInt(deadlineHours?.value ?? '24');
    const sessionDt  = new Date(`${booking.prev_date}T${booking.prev_start_time}`);
    const hoursUntil = (sessionDt - new Date()) / 3600000;
    if (hoursUntil < hoursLimit && !adminOverride) return err(`Rescheduling must be done at least ${hoursLimit} hours before the session`);

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

    const confirmedCount = await liveConfirmedCount(env, newSessionId);
    if (confirmedCount >= newSession.capacity) return err('Target session is full', 409);

    const dup = await queryOne(env,
      `SELECT id FROM bookings WHERE player_id = ? AND session_id = ?
       AND status NOT IN ('cancelled_by_client','cancelled_by_admin','payment_failed','rescheduled')`,
      [booking.player_id, newSessionId]
    );
    if (dup) return err('Player already has an active booking for that session', 409);

    const now = new Date().toISOString();
    const prevSessionId = booking.session_id;

    await execute(env, `UPDATE bookings SET session_id=?, status='confirmed', updated_at=? WHERE id=?`, [newSessionId, now, params.id]);
    await execute(env, 'UPDATE sessions SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0', [prevSessionId]);
    await execute(env, 'UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?', [newSessionId]);

    await execute(env,
      `INSERT INTO booking_amendments (id, booking_id, amended_by, amendment_type, previous_value, new_value, reason)
       VALUES (?, ?, ?, 'reschedule', ?, ?, ?)`,
      [crypto.randomUUID(), params.id, payload.sub,
       JSON.stringify({ session_id: prevSessionId, session_name: booking.prev_session_name, session_date: booking.prev_date }),
       JSON.stringify({ session_id: newSessionId, session_name: newSession.title, session_date: newSession.session_date }),
       adminOverride ? `Admin override: ${overrideReason}` : (body.reason ?? null)]
    );

    await audit(env, {
      actorId: payload.sub, action: adminOverride ? 'override' : 'update',
      recordType: 'booking', recordId: params.id,
      description: `Booking rescheduled: ${booking.prev_session_name} → ${newSession.title}`,
      reason: adminOverride ? overrideReason : undefined,
    });

    try {
      await sendTemplatedEmail(env, {
        eventTrigger: 'reschedule_confirmed', to: payload.email, userId: payload.sub,
        bookingId: params.id, idempotencyRef: `reschedule_${params.id}_${newSessionId}`,
        variables: {
          first_name: payload.firstName ?? '', new_session_title: newSession.title,
          new_session_date: newSession.session_date, new_session_time: newSession.start_time,
        },
      });
    } catch (e) { console.error('Reschedule email failed (non-fatal):', e.message); }

    return ok({ message: 'Booking rescheduled', newSessionId });
  }

  return err('Method not allowed', 405);
}