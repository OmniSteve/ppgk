/** CRUD /api/admin/packages */
import { requireRole } from '../../lib/auth.js';
import { query, execute, audit } from '../../lib/db.js';

export async function handleAdminPackages(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin');
  const method = request.method;

  if (method === 'GET') {
    const packages = await query(env, 'SELECT * FROM package_definitions ORDER BY name', []);
    return Response.json(packages);
  }

  if (method === 'POST') {
    const body = await request.json();
    const id = crypto.randomUUID();
    await execute(env,
      `INSERT INTO package_definitions (id, name, description, credits, price, validity_months, active)
       VALUES (?,?,?,?,?,?,?)`,
      [id, body.name, body.description ?? null, body.credits, body.price, body.validityMonths ?? 3, body.active ? 1 : 0]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'create', recordType: 'package', recordId: id, description: `Package created: ${body.name}` });
    return Response.json({ id }, { status: 201 });
  }

  if (method === 'PUT' && params?.id) {
    const body = await request.json();
    await execute(env,
      `UPDATE package_definitions SET name=?, description=?, credits=?, price=?, validity_months=?, active=?, updated_at=? WHERE id=?`,
      [body.name, body.description ?? null, body.credits, body.price, body.validityMonths, body.active ? 1 : 0, new Date().toISOString(), params.id]
    );
    return Response.json({ message: 'Updated' });
  }

  if (method === 'PATCH' && params?.id) {
    const { active } = await request.json();
    await execute(env, 'UPDATE package_definitions SET active=?, updated_at=? WHERE id=?', [active ? 1 : 0, new Date().toISOString(), params.id]);
    return Response.json({ message: 'Updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}