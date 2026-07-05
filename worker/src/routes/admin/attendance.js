/** Admin attendance management */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, execute, audit } from '../../lib/db.js';
import { toCamelArray } from '../../lib/serializers.js';

export async function handleAdminAttendance(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin', 'head_coach');
  const url    = new URL(request.url);
  const method = request.method;

  if (method === 'GET') {
    const search   = url.searchParams.get('search')   || '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo   = url.searchParams.get('dateTo')   || '';
    const status   = url.searchParams.get('status')   || '';
    const page     = parseInt(url.searchParams.get('page') || '1');
    const limit    = parseInt(url.searchParams.get('limit') || '25');
    const offset   = (page - 1) * limit;
    const like     = `%${search}%`;

    const conditions = ['1=1'];
    const bindings   = [];
    if (search)   { conditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR s.title LIKE ?)'); bindings.push(like, like, like); }
    if (dateFrom) { conditions.push('s.session_date >= ?'); bindings.push(dateFrom); }
    if (dateTo)   { conditions.push('s.session_date <= ?'); bindings.push(dateTo); }
    if (status)   { conditions.push('a.status = ?');        bindings.push(status); }

    const where = conditions.join(' AND ');
    const [records, countRow] = await Promise.all([
      query(env,
        `SELECT a.id, a.status, a.notes, a.recorded_at,
                p.first_name || ' ' || p.last_name as player_name,
                s.title as session_name, s.session_date, s.start_time,
                c.first_name || ' ' || c.last_name as coach_name
         FROM attendance a
         JOIN players p ON p.id = a.player_id
         JOIN sessions s ON s.id = a.session_id
         LEFT JOIN coach_profiles c ON c.id = s.coach_id
         WHERE ${where}
         ORDER BY s.session_date DESC LIMIT ? OFFSET ?`,
        [...bindings, limit, offset]
      ),
      queryOne(env,
        `SELECT COUNT(*) as count FROM attendance a
         JOIN players p ON p.id = a.player_id
         JOIN sessions s ON s.id = a.session_id
         WHERE ${where}`,
        bindings
      ),
    ]);

    return Response.json({ records: toCamelArray(records), total: countRow?.count ?? 0 });
  }

  if (method === 'PATCH' && params?.id) {
    const { status, notes } = await request.json();
    await execute(env,
      'UPDATE attendance SET status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?',
      [status ?? null, notes ?? null, new Date().toISOString(), params.id]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'override', recordType: 'attendance', recordId: params.id, description: `Attendance overridden to ${status}` });
    return Response.json({ message: 'Attendance updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}