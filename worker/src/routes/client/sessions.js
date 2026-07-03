/** GET /api/sessions, GET /api/sessions/:id */
import { requireAuth } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';

export async function handleClientSessions(request, env, ctx, params) {
  await requireAuth(request, env);
  const url = new URL(request.url);

  if (params?.id) {
    const session = await queryOne(env,
      `SELECT s.*, l.name as location_name, l.address_line1, l.city, l.map_url,
              st.name as session_type_name, st.duration_minutes, st.colour,
              c.first_name || ' ' || c.last_name as coach_name, c.bio as coach_bio
       FROM sessions s
       LEFT JOIN locations l ON l.id = s.location_id
       LEFT JOIN session_types st ON st.id = s.session_type_id
       LEFT JOIN coach_profiles c ON c.id = s.coach_id
       WHERE s.id = ? AND s.status = 'scheduled'`,
      [params.id]
    );
    if (!session) return Response.json({ message: 'Session not found' }, { status: 404 });
    return Response.json(session);
  }

  const today   = new Date().toISOString().slice(0, 10);
  const search  = url.searchParams.get('search') || '';
  const typeId  = url.searchParams.get('typeId') || '';
  const locId   = url.searchParams.get('locationId') || '';
  const dateFrom = url.searchParams.get('dateFrom') || today;
  const dateTo   = url.searchParams.get('dateTo') || '';

  const conditions = ["s.status = 'scheduled'", 's.session_date >= ?'];
  const bindings   = [dateFrom];

  if (search) { conditions.push('s.title LIKE ?'); bindings.push(`%${search}%`); }
  if (typeId) { conditions.push('s.session_type_id = ?'); bindings.push(typeId); }
  if (locId)  { conditions.push('s.location_id = ?'); bindings.push(locId); }
  if (dateTo) { conditions.push('s.session_date <= ?'); bindings.push(dateTo); }

  const sessions = await query(env,
    `SELECT s.id, s.title, s.session_date, s.start_time, s.end_time, s.capacity, s.booked_count,
            s.credit_cost, s.price, s.description,
            l.name as location_name, l.city,
            st.name as session_type_name, st.colour,
            c.first_name || ' ' || c.last_name as coach_name
     FROM sessions s
     LEFT JOIN locations l ON l.id = s.location_id
     LEFT JOIN session_types st ON st.id = s.session_type_id
     LEFT JOIN coach_profiles c ON c.id = s.coach_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.session_date, s.start_time LIMIT 100`,
    bindings
  );

  return Response.json({ sessions });
}