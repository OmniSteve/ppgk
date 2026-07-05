/** Client notification endpoints */
import { requireAuth } from '../../lib/auth.js';
import { query, execute } from '../../lib/db.js';
import { toCamelArray } from '../../lib/serializers.js';

export async function handleClientNotifications(request, env, ctx, params) {
  const payload = await requireAuth(request, env);

  if (request.method === 'GET') {
    const notifications = await query(env,
      'SELECT id, subject, status, sent_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [payload.sub]
    );
    return Response.json({ notifications: toCamelArray(notifications) });
  }

  if (request.method === 'PATCH' && params?.id) {
    await execute(env, "UPDATE notifications SET status = 'read' WHERE id = ? AND user_id = ?", [params.id, payload.sub]);
    return Response.json({ message: 'Marked as read' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}