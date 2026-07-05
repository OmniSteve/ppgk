/** GET /api/dashboard/client */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';
import { getBalance } from '../../lib/credits.js';

export async function handleClientDashboard(request, env) {
  const payload = await requireRole(request, env, 'client', 'coach', 'head_coach', 'admin');
  const clientId = payload.sub;
  const today = new Date().toISOString().slice(0, 10);

  // Credit balance — reuse the same getBalance logic as checkout so numbers always match
  const creditBalance = await getBalance(env, clientId);

  // Credits expiring in next 14 days (only positive/purchase entries with upcoming expiry)
  const expiringRow = await queryOne(env,
    `SELECT COALESCE(SUM(amount), 0) AS expiring
     FROM credit_ledger
     WHERE client_id = ?
       AND amount > 0
       AND expires_at IS NOT NULL
       AND expires_at > datetime('now')
       AND expires_at <= datetime('now', '+14 days')`,
    [clientId]
  );

  // Upcoming bookings — bookings are stored with client_id directly
  const upcomingBookings = await query(env,
    `SELECT b.id, s.title AS sessionName, s.session_date AS sessionDate,
            s.start_time AS startTime, s.end_time AS endTime,
            l.name AS locationName, b.status,
            p.first_name || ' ' || p.last_name AS playerName
     FROM bookings b
     JOIN sessions s ON s.id = b.session_id
     JOIN players p ON p.id = b.player_id
     LEFT JOIN locations l ON l.id = s.location_id
     WHERE b.client_id = ?
       AND s.session_date >= ?
       AND b.status IN ('confirmed', 'pending_payment')
     ORDER BY s.session_date, s.start_time
     LIMIT 5`,
    [clientId, today]
  );

  // Player count — players use client_id
  const playerRow = await queryOne(env,
    `SELECT COUNT(*) AS cnt FROM players WHERE client_id = ? AND status = 'active'`,
    [clientId]
  );

  // Unread notifications — notifications table has no read_at; count queued (undelivered) ones
  // for this user as a proxy for "new"
  const notifRow = await queryOne(env,
    `SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND status = 'queued'`,
    [clientId]
  );

  console.log('DASHBOARD', {
    clientId,
    creditBalance,
    upcomingBookingsCount: upcomingBookings?.length ?? 0,
    players: playerRow?.cnt ?? 0,
    notifications: notifRow?.cnt ?? 0,
  });

  return Response.json({
    creditBalance,
    expiringCredits: expiringRow?.expiring ?? 0,
    upcomingBookings: upcomingBookings ?? [],
    players: playerRow?.cnt ?? 0,
    unreadNotifications: notifRow?.cnt ?? 0,
  });
}