/** GET /api/dashboard/client */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';

export async function handleClientDashboard(request, env) {
  const payload = await requireRole(request, env, 'client', 'coach', 'head_coach', 'admin');
  const userId = payload.sub;
  const today = new Date().toISOString().slice(0, 10);

  // Credit balance from ledger
  const creditRow = await queryOne(env,
    `SELECT COALESCE(SUM(amount), 0) AS balance
     FROM credit_ledger
     WHERE user_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    [userId]
  );

  // Credits expiring in next 14 days
  const expiringRow = await queryOne(env,
    `SELECT COALESCE(SUM(amount), 0) AS expiring
     FROM credit_ledger
     WHERE user_id = ?
       AND expires_at IS NOT NULL
       AND expires_at > datetime('now')
       AND expires_at <= datetime('now', '+14 days')`,
    [userId]
  );

  // Upcoming bookings
  const upcomingBookings = await query(env,
    `SELECT b.id, s.title AS sessionName, s.session_date AS sessionDate,
            s.start_time AS startTime, s.end_time AS endTime,
            l.name AS locationName, b.status
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     LEFT JOIN locations l ON l.id = s.location_id
     WHERE b.user_id = ?
       AND s.session_date >= ?
       AND b.status IN ('confirmed', 'pending_payment')
     ORDER BY s.session_date, s.start_time
     LIMIT 5`,
    [userId, today]
  );

  // Player count
  const playerRow = await queryOne(env,
    `SELECT COUNT(*) AS cnt FROM players WHERE user_id = ? AND status = 'active'`,
    [userId]
  );

  // Unread notifications
  const notifRow = await queryOne(env,
    `SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND read_at IS NULL`,
    [userId]
  );

  return Response.json({
    creditBalance: creditRow?.balance ?? 0,
    expiringCredits: expiringRow?.expiring ?? 0,
    upcomingBookings: upcomingBookings ?? [],
    players: playerRow?.cnt ?? 0,
    unreadNotifications: notifRow?.cnt ?? 0,
  });
}