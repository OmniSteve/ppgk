/**
 * Admin booking management.
 * GET    /api/admin/bookings
 * PATCH  /api/admin/bookings/:id
 */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, execute, audit } from '../../lib/db.js';
import { toCamelArray } from '../../lib/serializers.js';

export async function handleAdminBookings(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin', 'head_coach');
  const url    = new URL(request.url);
  const method = request.method;

  if (method === 'GET') {
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    const page   = parseInt(url.searchParams.get('page') || '1');
    const limit  = parseInt(url.searchParams.get('limit') || '25');
    const offset = (page - 1) * limit;
    const like   = `%${search}%`;

    const conditions = ['1=1'];
    const bindings   = [];

    if (search) {
      conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR p.first_name LIKE ? OR s.title LIKE ?)');
      bindings.push(like, like, like, like);
    }
    if (status) { conditions.push('b.status = ?'); bindings.push(status); }

    const where = conditions.join(' AND ');

    const [bookings, countRow] = await Promise.all([
      query(env,
        `SELECT b.id, b.status, b.credits_used, b.amount_charged, b.booked_at,
                u.first_name || ' ' || u.last_name as client_name,
                p.first_name || ' ' || p.last_name as player_name,
                s.title as session_name, s.session_date, s.start_time
         FROM bookings b
         JOIN users u ON u.id = b.client_id
         JOIN players p ON p.id = b.player_id
         JOIN sessions s ON s.id = b.session_id
         WHERE ${where}
         ORDER BY s.session_date DESC, s.start_time DESC LIMIT ? OFFSET ?`,
        [...bindings, limit, offset]
      ),
      queryOne(env,
        `SELECT COUNT(*) as count FROM bookings b
         JOIN users u ON u.id = b.client_id
         JOIN players p ON p.id = b.player_id
         JOIN sessions s ON s.id = b.session_id
         WHERE ${where}`,
        bindings
      ),
    ]);

    return Response.json({ bookings: toCamelArray(bookings), total: countRow?.count ?? 0 });
  }

  if (method === 'PATCH' && params?.id) {
    const body = await request.json();
    const { status, notes } = body;
    await execute(env,
      'UPDATE bookings SET status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?',
      [status ?? null, notes ?? null, new Date().toISOString(), params.id]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'update', recordType: 'booking', recordId: params.id, description: `Booking status updated to ${status}` });
    return Response.json({ message: 'Booking updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}