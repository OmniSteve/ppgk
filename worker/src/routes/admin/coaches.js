/** CRUD /api/admin/coaches */
import { requireRole } from '../../lib/auth.js';
import { query, execute, audit } from '../../lib/db.js';

export async function handleAdminCoaches(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin');
  const url    = new URL(request.url);
  const method = request.method;

  if (method === 'GET') {
    const search = url.searchParams.get('search') || '';
    const rows = await query(env,
      `SELECT * FROM coach_profiles WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? ORDER BY first_name`,
      [`%${search}%`, `%${search}%`, `%${search}%`]
    );
    const coaches = rows.map((r) => ({
      ...r,
      firstName: r.first_name,
      lastName: r.last_name,
      active: r.active === 1 || r.active === true,
    }));
    return Response.json({ coaches });
  }

  if (method === 'POST') {
    const body = await request.json();
    const { firstName, lastName, email, phone, bio, specialisations, active } = body;
    if (!firstName || !lastName) return Response.json({ message: 'firstName and lastName required' }, { status: 400 });
    const id = crypto.randomUUID();
    await execute(env,
      `INSERT INTO coach_profiles (id, first_name, last_name, email, phone, bio, specialisations, active) VALUES (?,?,?,?,?,?,?,?)`,
      [id, firstName, lastName, email ?? null, phone ?? null, bio ?? null, specialisations ?? null, active ? 1 : 0]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'create', recordType: 'coach', recordId: id, description: `Coach created: ${firstName} ${lastName}` });
    return Response.json({ id }, { status: 201 });
  }

  if (method === 'PUT' && params?.id) {
    const body = await request.json();
    await execute(env,
      `UPDATE coach_profiles SET first_name=?, last_name=?, email=?, phone=?, bio=?, specialisations=?, active=?, updated_at=? WHERE id=?`,
      [body.firstName, body.lastName, body.email ?? null, body.phone ?? null, body.bio ?? null,
       body.specialisations ?? null, body.active ? 1 : 0, new Date().toISOString(), params.id]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'update', recordType: 'coach', recordId: params.id, description: `Coach updated: ${params.id}` });
    return Response.json({ message: 'Updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}