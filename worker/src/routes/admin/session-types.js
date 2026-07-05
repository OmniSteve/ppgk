/** CRUD /api/admin/session-types */
import { requireRole } from '../../lib/auth.js';
import { query, execute, audit } from '../../lib/db.js';
import { toCamelArray } from '../../lib/serializers.js';

export async function handleAdminSessionTypes(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin');
  const method = request.method;

  if (method === 'GET') {
    const sessionTypes = await query(env, 'SELECT * FROM session_types ORDER BY name', []);
    return Response.json({ sessionTypes: toCamelArray(sessionTypes) });
  }

  if (method === 'POST') {
    const body = await request.json();
    if (!body.name) return Response.json({ message: 'name required' }, { status: 400 });
    const id = crypto.randomUUID();
    await execute(env,
      `INSERT INTO session_types (id, name, description, duration_minutes, default_capacity, credit_cost, price, colour, active)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, body.name, body.description ?? null, body.durationMinutes ?? 60, body.defaultCapacity ?? 10,
       body.creditCost ?? 1, body.price ?? null, body.colour ?? '#2563EB', body.active ? 1 : 0]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'create', recordType: 'session_type', recordId: id, description: `Session type created: ${body.name}` });
    return Response.json({ id }, { status: 201 });
  }

  if (method === 'PUT' && params?.id) {
    const body = await request.json();
    await execute(env,
      `UPDATE session_types SET name=?, description=?, duration_minutes=?, default_capacity=?,
       credit_cost=?, price=?, colour=?, active=?, updated_at=? WHERE id=?`,
      [body.name, body.description ?? null, body.durationMinutes, body.defaultCapacity,
       body.creditCost, body.price ?? null, body.colour ?? '#2563EB', body.active ? 1 : 0,
       new Date().toISOString(), params.id]
    );
    return Response.json({ message: 'Updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}