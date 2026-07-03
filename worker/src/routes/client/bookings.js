/** Client booking endpoints */
import { requireAuth } from '../../lib/auth.js';
import { query, queryOne, execute, batch, audit } from '../../lib/db.js';

export async function handleClientBookings(request, env, ctx, params) {
  const payload = await requireAuth(request, env);
  const method  = request.method;
  const url     = new URL(request.url);

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
    return Response.json({ bookings });
  }

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
    if (!booking) return Response.json({ message: 'Booking not found' }, { status: 404 });

    const amendments = await query(env,
      'SELECT * FROM booking_amendments WHERE booking_id = ? ORDER BY created_at DESC',
      [params.id]
    );
    return Response.json({ ...booking, amendments });
  }

  if (method === 'POST' && !params?.id) {
    // Create booking(s) — body: { sessionIds: [], playerId, paymentMethod, idempotencyKey }
    const body = await request.json();
    const { sessionIds, playerId, paymentMethod, idempotencyKey } = body;

    if (!sessionIds?.length || !playerId || !paymentMethod || !idempotencyKey) {
      return Response.json({ message: 'sessionIds, playerId, paymentMethod and idempotencyKey required' }, { status: 400 });
    }

    // Verify player belongs to client
    const player = await queryOne(env, 'SELECT id FROM players WHERE id = ? AND client_id = ?', [playerId, payload.sub]);
    if (!player) return Response.json({ message: 'Player not found' }, { status: 404 });

    const bookingIds = [];
    for (const sessionId of sessionIds) {
      const session = await queryOne(env,
        'SELECT id, capacity, booked_count, credit_cost, price, status FROM sessions WHERE id = ?',
        [sessionId]
      );
      if (!session) return Response.json({ message: `Session ${sessionId} not found` }, { status: 404 });
      if (session.status !== 'scheduled') return Response.json({ message: `Session ${sessionId} is not available` }, { status: 400 });
      if (session.booked_count >= session.capacity) return Response.json({ message: `Session ${sessionId} is full` }, { status: 409 });

      // Duplicate check
      const existing = await queryOne(env, 'SELECT id FROM bookings WHERE player_id = ? AND session_id = ?', [playerId, sessionId]);
      if (existing) return Response.json({ message: `Player is already booked for session ${sessionId}` }, { status: 409 });

      const bookingId = crypto.randomUUID();
      await execute(env,
        `INSERT INTO bookings (id, client_id, player_id, session_id, status, payment_method)
         VALUES (?, ?, ?, ?, 'pending_payment', ?)`,
        [bookingId, payload.sub, playerId, sessionId, paymentMethod]
      );
      await execute(env, 'UPDATE sessions SET booked_count = booked_count + 1 WHERE id = ?', [sessionId]);
      bookingIds.push(bookingId);
    }

    // TODO: If paymentMethod === 'card' initiate Stripe checkout session and return URL
    // If paymentMethod === 'credits' deduct and confirm immediately

    return Response.json({ bookingIds, message: 'Bookings created' }, { status: 201 });
  }

  if (method === 'POST' && params?.id && url.pathname.endsWith('/cancel')) {
    const body   = await request.json();
    const booking = await queryOne(env, 'SELECT * FROM bookings WHERE id = ? AND client_id = ?', [params.id, payload.sub]);
    if (!booking) return Response.json({ message: 'Booking not found' }, { status: 404 });
    if (!['confirmed', 'pending_payment'].includes(booking.status)) {
      return Response.json({ message: 'Booking cannot be cancelled' }, { status: 400 });
    }
    await execute(env,
      `UPDATE bookings SET status = 'cancelled_by_client', cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), body.reason ?? null, new Date().toISOString(), params.id]
    );
    await execute(env, 'UPDATE sessions SET booked_count = booked_count - 1 WHERE id = ? AND booked_count > 0', [booking.session_id]);
    return Response.json({ message: 'Booking cancelled' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}