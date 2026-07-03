/** Coach session endpoints */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';

export async function handleCoachSessions(request, env, ctx, params) {
  const payload = await requireRole(request, env, 'coach', 'head_coach', 'admin');
  const url     = new URL(request.url);
  const today   = new Date().toISOString().slice(0, 10);

  const coach = await queryOne(env, 'SELECT id FROM coach_profiles WHERE user_id = ?', [payload.sub]);
  const coachId = coach?.id;

  if (params?.id && url.pathname.endsWith('/attendees')) {
    const attendees = await query(env,
      `SELECT b.id as booking_id, b.status as booking_status, p.first_name, p.last_name, p.medical_info, p.allergies,
              a.id as attendance_id, a.status as attendance_status, a.notes
       FROM bookings b
       JOIN players p ON p.id = b.player_id
       LEFT JOIN attendance a ON a.booking_id = b.id
       WHERE b.session_id = ? AND b.status = 'confirmed'`,
      [params.id]
    );
    return Response.json({ attendees });
  }

  if (params?.id) {
    const session = await queryOne(env,
      `SELECT s.*, l.name as location_name, l.address_line1 FROM sessions s
       LEFT JOIN locations l ON l.id = s.location_id WHERE s.id = ?`,
      [params.id]
    );
    if (!session) return Response.json({ message: 'Session not found' }, { status: 404 });
    return Response.json(session);
  }

  if (!coachId) return Response.json({ sessions: [] });

  const sessions = await query(env,
    `SELECT s.id, s.title, s.session_date, s.start_time, s.end_time, s.capacity, s.booked_count, s.status,
            l.name as location_name
     FROM sessions s LEFT JOIN locations l ON l.id = s.location_id
     WHERE s.coach_id = ? AND s.session_date >= ?
     ORDER BY s.session_date, s.start_time LIMIT 50`,
    [coachId, today]
  );

  return Response.json({ sessions });
}