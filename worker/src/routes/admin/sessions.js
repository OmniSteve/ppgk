/**
 * Admin session management.
 * GET    /api/admin/sessions
 * POST   /api/admin/sessions
 * GET    /api/admin/sessions/:id
 * PUT    /api/admin/sessions/:id
 * PATCH  /api/admin/sessions/:id   (cancel, status change)
 */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, execute, audit } from '../../lib/db.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';

export async function handleAdminSessions(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin', 'head_coach');
  const url    = new URL(request.url);
  const method = request.method;

  if (method === 'GET' && !params?.id) {
    const search   = url.searchParams.get('search') || '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo   = url.searchParams.get('dateTo')   || '';
    const status   = url.searchParams.get('status')   || '';
    const page     = parseInt(url.searchParams.get('page') || '1');
    const limit    = parseInt(url.searchParams.get('limit') || '25');
    const offset   = (page - 1) * limit;

    const conditions = ['1=1'];
    const bindings   = [];

    if (search)   { conditions.push('s.title LIKE ?');       bindings.push(`%${search}%`); }
    if (dateFrom) { conditions.push('s.session_date >= ?');   bindings.push(dateFrom); }
    if (dateTo)   { conditions.push('s.session_date <= ?');   bindings.push(dateTo); }
    if (status)   { conditions.push('s.status = ?');          bindings.push(status); }

    const where = conditions.join(' AND ');

    const [sessions, countRow] = await Promise.all([
      query(env,
        `SELECT s.*, l.name as location_name, st.name as session_type_name,
                c.first_name || ' ' || c.last_name as coach_name
         FROM sessions s
         LEFT JOIN locations l ON l.id = s.location_id
         LEFT JOIN session_types st ON st.id = s.session_type_id
         LEFT JOIN coach_profiles c ON c.id = s.coach_id
         WHERE ${where}
         ORDER BY s.session_date DESC, s.start_time DESC LIMIT ? OFFSET ?`,
        [...bindings, limit, offset]
      ),
      queryOne(env, `SELECT COUNT(*) as count FROM sessions s WHERE ${where}`, bindings),
    ]);

    return Response.json({ sessions: toCamelArray(sessions), total: countRow?.count ?? 0 });
  }

  if (method === 'GET' && params?.id) {
    const session = await queryOne(env,
      `SELECT s.*, l.name as location_name, l.address_line1, l.city, l.map_url,
              st.name as session_type_name, st.duration_minutes,
              c.first_name || ' ' || c.last_name as coach_name
       FROM sessions s
       LEFT JOIN locations l ON l.id = s.location_id
       LEFT JOIN session_types st ON st.id = s.session_type_id
       LEFT JOIN coach_profiles c ON c.id = s.coach_id
       WHERE s.id = ?`,
      [params.id]
    );
    if (!session) return Response.json({ message: 'Session not found' }, { status: 404 });
    return Response.json(toCamel(session));
  }

  if (method === 'POST') {
    const body = await request.json();
    const { title, sessionTypeId, locationId, coachId, sessionDate, startTime, endTime, capacity, creditCost, price, description, notes } = body;
    if (!title || !sessionDate || !startTime || !endTime) {
      return Response.json({ message: 'title, sessionDate, startTime and endTime are required' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await execute(env,
      `INSERT INTO sessions (id, title, session_type_id, location_id, coach_id, session_date, start_time, end_time, capacity, credit_cost, price, description, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, sessionTypeId ?? null, locationId ?? null, coachId ?? null, sessionDate, startTime, endTime,
       capacity ?? 10, creditCost ?? 1, price ?? null, description ?? null, notes ?? null]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'create', recordType: 'session', recordId: id, description: `Session created: ${title} on ${sessionDate}` });
    return Response.json({ id, message: 'Session created' }, { status: 201 });
  }

  if (method === 'PUT' && params?.id) {
    const body = await request.json();
    const { title, locationId, coachId, sessionDate, startTime, endTime, capacity, creditCost, price, description, notes, status } = body;
    await execute(env,
      `UPDATE sessions SET title = COALESCE(?, title), location_id = COALESCE(?, location_id),
       coach_id = COALESCE(?, coach_id), session_date = COALESCE(?, session_date),
       start_time = COALESCE(?, start_time), end_time = COALESCE(?, end_time),
       capacity = COALESCE(?, capacity), credit_cost = COALESCE(?, credit_cost),
       price = COALESCE(?, price), description = COALESCE(?, description),
       notes = COALESCE(?, notes), status = COALESCE(?, status), updated_at = ?
       WHERE id = ?`,
      [title ?? null, locationId ?? null, coachId ?? null, sessionDate ?? null, startTime ?? null, endTime ?? null,
       capacity ?? null, creditCost ?? null, price ?? null, description ?? null, notes ?? null,
       status ?? null, new Date().toISOString(), params.id]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'update', recordType: 'session', recordId: params.id, description: `Session updated: ${params.id}` });
    return Response.json({ message: 'Session updated' });
  }

  if (method === 'PATCH' && params?.id) {
    const body = await request.json();
    const { status } = body;
    await execute(env, 'UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?', [status, new Date().toISOString(), params.id]);
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'update', recordType: 'session', recordId: params.id, description: `Session status changed to ${status}` });
    return Response.json({ message: 'Session updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}