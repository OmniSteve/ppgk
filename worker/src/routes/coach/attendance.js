/** Coach attendance recording */
import { requireRole } from '../../lib/auth.js';
import { queryOne, execute, audit } from '../../lib/db.js';

export async function handleCoachAttendance(request, env, ctx, params) {
  const payload = await requireRole(request, env, 'coach', 'head_coach', 'admin');
  const method  = request.method;

  if (method === 'POST') {
    const body = await request.json();
    const { bookingId, sessionId, playerId, status, notes } = body;
    if (!bookingId || !sessionId || !playerId || !status) {
      return Response.json({ message: 'bookingId, sessionId, playerId and status required' }, { status: 400 });
    }

    const existing = await queryOne(env, 'SELECT id FROM attendance WHERE booking_id = ?', [bookingId]);

    if (existing) {
      await execute(env,
        'UPDATE attendance SET status = ?, notes = ?, recorded_by = ?, updated_at = ? WHERE id = ?',
        [status, notes ?? null, payload.sub, new Date().toISOString(), existing.id]
      );
    } else {
      await execute(env,
        `INSERT INTO attendance (id, booking_id, session_id, player_id, status, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), bookingId, sessionId, playerId, status, notes ?? null, payload.sub]
      );
      // attendance_status lives exclusively in the attendance table —
      // bookings.status (pending/confirmed/backup/...) is never overwritten
      // by an attendance mark.
    }

    await audit(env, { actorId: payload.sub, action: 'update', recordType: 'attendance', recordId: bookingId, description: `Attendance marked ${status} for booking ${bookingId}` });
    return Response.json({ message: 'Attendance recorded' });
  }

  if (method === 'PATCH' && params?.id) {
    const { status, notes } = await request.json();
    await execute(env,
      'UPDATE attendance SET status = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?',
      [status, notes ?? null, new Date().toISOString(), params.id]
    );
    return Response.json({ message: 'Updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}