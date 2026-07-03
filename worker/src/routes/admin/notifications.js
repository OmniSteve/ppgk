/** GET /api/admin/notifications */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';

export async function handleAdminNotifications(request, env, ctx, params) {
  await requireRole(request, env, 'admin');
  const url    = new URL(request.url);
  const page   = parseInt(url.searchParams.get('page') || '1');
  const limit  = parseInt(url.searchParams.get('limit') || '25');
  const offset = (page - 1) * limit;

  const [notifications, countRow] = await Promise.all([
    query(env,
      `SELECT n.id, n.status, n.subject, n.recipient_email, n.sent_at, n.error_message, n.created_at,
              u.first_name || ' ' || u.last_name as user_name
       FROM notifications n LEFT JOIN users u ON u.id = n.user_id
       ORDER BY n.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    ),
    queryOne(env, 'SELECT COUNT(*) as count FROM notifications', []),
  ]);

  return Response.json({ notifications, total: countRow?.count ?? 0 });
}