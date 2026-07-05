/** GET /api/coach/dashboard */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';
import { toCamelArray } from '../../lib/serializers.js';

export async function handleCoachDashboard(request, env) {
  const payload = await requireRole(request, env, 'coach', 'head_coach', 'admin');
  const today = new Date().toISOString().slice(0, 10);
  const isAdmin = payload.role === 'admin';

  const coach = await queryOne(env, 'SELECT id FROM coach_profiles WHERE user_id = ?', [payload.sub]);

  const whereClause = isAdmin ? 's.session_date >= ?' : 's.coach_id = ? AND s.session_date >= ?';
  const bindings = isAdmin ? [today] : [coach?.id, today];

  const sessions = (coach || isAdmin) ? await query(env,
    `SELECT s.id, s.title, s.session_date, s.start_time, s.end_time, s.capacity, s.booked_count,
            l.name as location_name
     FROM sessions s LEFT JOIN locations l ON l.id = s.location_id
     WHERE ${whereClause} AND s.status IN ('scheduled', 'published')
     ORDER BY s.session_date, s.start_time LIMIT 20`,
    bindings
  ) : [];

  const camel = toCamelArray(sessions);
  const todaySessions = camel.filter((s) => s.sessionDate === today);
  const upcomingSessions = camel.filter((s) => s.sessionDate > today);

  const attendancePending = todaySessions.length;

  return Response.json({ todaySessions, upcomingSessions, attendancePending, coachId: coach?.id });
}