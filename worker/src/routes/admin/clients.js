/**
 * Admin client management endpoints.
 * GET    /api/admin/clients
 * GET    /api/admin/clients/:id
 * PUT    /api/admin/clients/:id
 * PATCH  /api/admin/clients/:id
 */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, execute, audit } from '../../lib/db.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';

export async function handleAdminClients(request, env, ctx, params) {
  const actor = await requireRole(request, env, 'admin', 'head_coach');
  const url   = new URL(request.url);
  const method = request.method;

  if (method === 'GET' && !params?.id) {
    const search = url.searchParams.get('search') || '';
    const page   = parseInt(url.searchParams.get('page') || '1');
    const limit  = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const like   = `%${search}%`;

    const [clients, countRow] = await Promise.all([
      query(env,
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.active,
                u.email_verified, u.last_login_at, u.created_at
         FROM users u
         WHERE (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)
         ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
        [like, like, like, limit, offset]
      ),
      queryOne(env,
        `SELECT COUNT(*) as count FROM users
         WHERE (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)`,
        [like, like, like]
      ),
    ]);

    return Response.json({ clients: toCamelArray(clients), total: countRow?.count ?? 0 });
  }

  if (method === 'GET' && params?.id) {
    const user = await queryOne(env,
      `SELECT u.*, cp.* FROM users u LEFT JOIN client_profiles cp ON cp.user_id = u.id WHERE u.id = ?`,
      [params.id]
    );
    if (!user) return Response.json({ message: 'Client not found' }, { status: 404 });
    return Response.json(toCamel(user));
  }

  if ((method === 'PUT' || method === 'PATCH') && params?.id) {
    const body = await request.json();
    const { firstName, lastName, phone, role, active } = body;
    await execute(env,
      `UPDATE users SET
         first_name = COALESCE(?, first_name),
         last_name  = COALESCE(?, last_name),
         phone      = COALESCE(?, phone),
         role       = COALESCE(?, role),
         active     = COALESCE(?, active),
         updated_at = ?
       WHERE id = ?`,
      [firstName ?? null, lastName ?? null, phone ?? null, role ?? null,
       active != null ? (active ? 1 : 0) : null,
       new Date().toISOString(), params.id]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'update', recordType: 'user', recordId: params.id, description: `Admin updated user ${params.id}: role=${role}, active=${active}` });
    return Response.json({ message: 'User updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}