/** GET /api/coach/dashboard */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';
import { toCamelArray } from '../../lib/serializers.js';

export async function handleCoachDashboard(request, env) {
  const payload = await requireRole(request, env, 'coach', 'head_coach', 'admin');
  const today = new Date().toISOString().slice(0, 10);

  const coach = await queryOne(env, 'SELECT id FROM coach_profiles WHERE user_id = ?', [payload.sub]);

  const upcoming = coach ? await query(env,
    `SELECT s.id, s.title as name, s.session_date, s.start_time, s.end_time, s.capacity, s.booked_count as booking_count,
            l.name as location_name
     FROM sessions s LEFT JOIN locations l ON l.id = s.location_id
     WHERE s.coach_id = ? AND s.session_date >= ? AND s.status IN ('scheduled', 'published', 'draft')
     ORDER BY s.session_date, s.start_time LIMIT 10`,
    [coach.id, today]
  ) : [];

  return Response.json({ upcoming: toCamelArray(upcoming), coachId: coach?.id });
}