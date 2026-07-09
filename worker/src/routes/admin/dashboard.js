/**
 * GET /api/admin/dashboard
 * Returns summary stats: total bookings, revenue, upcoming sessions, capacity alerts.
 */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';
import { ok } from '../../lib/validate.js';

export async function handleAdminDashboard(request, env) {
  await requireRole(request, env, 'admin', 'head_coach');

  const today = new Date().toISOString().slice(0, 10);

  const [totalClients, upcomingSessions, todayBookings, totalRevenue] = await Promise.all([
    queryOne(env, "SELECT COUNT(*) as count FROM users WHERE role = 'client' AND active = 1"),
    queryOne(env, "SELECT COUNT(*) as count FROM sessions WHERE session_date >= ? AND status = 'scheduled'", [today]),
    queryOne(env, "SELECT COUNT(*) as count FROM bookings WHERE DATE(booked_at) = ? AND status = 'confirmed'", [today]),
    queryOne(env, "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'paid'"),
  ]);

  const upcomingList = await query(env,
    `SELECT s.id, s.title, s.session_date, s.start_time, s.capacity, s.booked_count,
            l.name as location_name, c.first_name || ' ' || c.last_name as coach_name
     FROM sessions s
     LEFT JOIN locations l ON l.id = s.location_id
     LEFT JOIN coach_profiles c ON c.id = s.coach_id
     WHERE s.session_date >= ? AND s.status = 'scheduled'
     ORDER BY s.session_date, s.start_time LIMIT 10`,
    [today]
  );

  return ok({
    stats: {
      totalClients:    totalClients?.count ?? 0,
      upcomingSessions: upcomingSessions?.count ?? 0,
      todayBookings:   todayBookings?.count ?? 0,
      totalRevenue:    Number(totalRevenue?.total ?? 0).toFixed(2),
    },
    upcomingSessions: upcomingList,
  });
}