/** CRUD /api/admin/locations */
import { requireRole } from '../../lib/auth.js';
import { query, execute, audit } from '../../lib/db.js';

export async function handleAdminLocations(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin');
  const method = request.method;

  if (method === 'GET') {
    const locations = await query(env, 'SELECT * FROM locations ORDER BY name', []);
    return Response.json({ locations });
  }

  if (method === 'POST') {
    const body = await request.json();
    if (!body.name) return Response.json({ message: 'name required' }, { status: 400 });
    const id = crypto.randomUUID();
    await execute(env,
      `INSERT INTO locations (id, name, address_line1, address_line2, city, post_code, map_url, notes, active)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, body.name, body.addressLine1 ?? null, body.addressLine2 ?? null, body.city ?? null,
       body.postCode ?? null, body.mapUrl ?? null, body.notes ?? null, body.active ? 1 : 0]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'create', recordType: 'location', recordId: id, description: `Location created: ${body.name}` });
    return Response.json({ id }, { status: 201 });
  }

  if (method === 'PUT' && params?.id) {
    const body = await request.json();
    await execute(env,
      `UPDATE locations SET name=?, address_line1=?, address_line2=?, city=?, post_code=?, map_url=?, notes=?, active=?, updated_at=? WHERE id=?`,
      [body.name, body.addressLine1 ?? null, body.addressLine2 ?? null, body.city ?? null,
       body.postCode ?? null, body.mapUrl ?? null, body.notes ?? null, body.active ? 1 : 0,
       new Date().toISOString(), params.id]
    );
    return Response.json({ message: 'Updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}