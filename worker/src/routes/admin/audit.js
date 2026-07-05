/** GET /api/admin/audit */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';
import { toCamelArray } from '../../lib/serializers.js';

export async function handleAdminAuditLog(request, env) {
  await requireRole(request, env, 'admin');
  const url        = new URL(request.url);
  const search     = url.searchParams.get('search')     || '';
  const recordType = url.searchParams.get('recordType') || '';
  const page       = parseInt(url.searchParams.get('page') || '1');
  const limit      = parseInt(url.searchParams.get('limit') || '25');
  const offset     = (page - 1) * limit;
  const like       = `%${search}%`;

  const conditions = ['1=1'];
  const bindings   = [];
  if (search)     { conditions.push('(a.description LIKE ? OR a.actor_name LIKE ?)'); bindings.push(like, like); }
  if (recordType) { conditions.push('a.record_type = ?'); bindings.push(recordType); }
  const where = conditions.join(' AND ');

  const [logs, countRow] = await Promise.all([
    query(env,
      `SELECT a.id, a.action, a.record_type as record_type, a.record_id, a.description,
              a.actor_name, a.previous_value, a.new_value, a.reason, a.created_at
       FROM audit_log a WHERE ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
      [...bindings, limit, offset]
    ),
    queryOne(env, `SELECT COUNT(*) as count FROM audit_log a WHERE ${where}`, bindings),
  ]);

  return Response.json({ logs: toCamelArray(logs), total: countRow?.count ?? 0 });
}