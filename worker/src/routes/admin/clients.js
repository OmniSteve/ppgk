/**
 * Admin client management endpoints.
 * GET    /api/admin/clients
 * GET    /api/admin/clients/:id
 * PUT    /api/admin/clients/:id
 * PATCH  /api/admin/clients/:id
 * GET    /api/admin/clients/:id/deactivation-impact
 * GET    /api/admin/clients/:id/deletion-eligibility
 * POST   /api/admin/clients/:id/deactivate
 * POST   /api/admin/clients/:id/reactivate
 * DELETE /api/admin/clients/:id
 */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, execute, audit, batch } from '../../lib/db.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';
import { getUserDeactivationImpact, getUserDeletionEligibility } from '../../lib/lifecycle.js';

export async function handleAdminClients(request, env, ctx, params) {
  const actor = await requireRole(request, env, 'admin', 'head_coach');
  const url   = new URL(request.url);
  const method = request.method;

  // ── Lifecycle sub-routes ────────────────────────────────────────────────
  if (params?.id && url.pathname.endsWith('/deactivation-impact') && method === 'GET') {
    const impact = await getUserDeactivationImpact(env, params.id);
    return Response.json(impact);
  }

  if (params?.id && url.pathname.endsWith('/deletion-eligibility') && method === 'GET') {
    const eligibility = await getUserDeletionEligibility(env, params.id);
    return Response.json(eligibility);
  }

  if (params?.id && url.pathname.endsWith('/deactivate') && method === 'POST') {
    if (actor.role !== 'admin') return Response.json({ message: 'Admin access required' }, { status: 403 });
    if (actor.sub === params.id) return Response.json({ message: 'You cannot deactivate your own account' }, { status: 400 });

    const target = await queryOne(env, 'SELECT id, email, role, active FROM users WHERE id = ?', [params.id]);
    if (!target) return Response.json({ message: 'Client not found' }, { status: 404 });
    if (!target.active) return Response.json({ message: 'User is already inactive' });

    if (target.role === 'admin') {
      const activeAdmins = await queryOne(env, "SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1");
      if ((activeAdmins?.c ?? 0) <= 1) {
        return Response.json({ message: 'Cannot deactivate the last active admin account' }, { status: 409 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();
    await execute(env,
      `UPDATE users SET active = 0, disabled_at = ?, disabled_by = ?, disabled_reason = ?, updated_at = ? WHERE id = ?`,
      [now, actor.sub, body.reason ?? null, now, params.id]
    );
    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'deactivate', recordType: 'user', recordId: params.id,
      description: `User deactivated: ${target.email}`,
      previousValue: { active: true }, newValue: { active: false }, reason: body.reason ?? null,
    });
    return Response.json({ message: 'User deactivated' });
  }

  if (params?.id && url.pathname.endsWith('/reactivate') && method === 'POST') {
    if (actor.role !== 'admin') return Response.json({ message: 'Admin access required' }, { status: 403 });

    const target = await queryOne(env, 'SELECT id, email, active FROM users WHERE id = ?', [params.id]);
    if (!target) return Response.json({ message: 'Client not found' }, { status: 404 });
    if (target.active) return Response.json({ message: 'User is already active' });

    const now = new Date().toISOString();
    await execute(env,
      `UPDATE users SET active = 1, reactivated_at = ?, reactivated_by = ?, updated_at = ? WHERE id = ?`,
      [now, actor.sub, now, params.id]
    );
    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'reactivate', recordType: 'user', recordId: params.id,
      description: `User reactivated: ${target.email}`,
      previousValue: { active: false }, newValue: { active: true },
    });
    return Response.json({ message: 'User reactivated' });
  }

  if (params?.id && method === 'DELETE') {
    if (actor.role !== 'admin') return Response.json({ message: 'Admin access required' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'DELETE') {
      return Response.json({ message: 'Type DELETE to confirm permanent deletion' }, { status: 400 });
    }

    const target = await queryOne(env, 'SELECT id, email, first_name, last_name, role FROM users WHERE id = ?', [params.id]);
    if (!target) return Response.json({ message: 'Client not found' }, { status: 404 });

    const eligibility = await getUserDeletionEligibility(env, params.id);
    if (!eligibility.eligible) {
      return Response.json({ message: 'This user cannot be permanently deleted', ...eligibility }, { status: 409 });
    }

    const now = new Date().toISOString();
    await batch(env, [
      { sql: 'UPDATE coach_profiles SET user_id = NULL WHERE user_id = ?', params: [params.id] },
      { sql: 'UPDATE notifications SET user_id = NULL WHERE user_id = ?', params: [params.id] },
      { sql: 'DELETE FROM client_profiles WHERE user_id = ?', params: [params.id] },
      {
        sql: `INSERT INTO audit_log (id, actor_id, actor_name, action, record_type, record_id, description, previous_value, reason)
              VALUES (?, ?, ?, 'delete', 'user', ?, ?, ?, ?)`,
        params: [
          crypto.randomUUID(), actor.sub, `${actor.firstName} ${actor.lastName}`, params.id,
          `User permanently deleted: ${target.email}`,
          JSON.stringify({ id: target.id, email: target.email, name: `${target.first_name} ${target.last_name}`, role: target.role }),
          body.reason ?? null,
        ],
      },
      { sql: 'DELETE FROM users WHERE id = ?', params: [params.id] },
    ]);

    return Response.json({ message: 'User permanently deleted' });
  }

  if (method === 'GET' && !params?.id) {
    const search = url.searchParams.get('search') || '';
    const includeInactive = url.searchParams.get('includeInactive') === 'true';
    const page   = parseInt(url.searchParams.get('page') || '1');
    const limit  = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const like   = `%${search}%`;
    const activeClause = includeInactive ? '' : 'AND u.active = 1';
    const activeClauseCount = includeInactive ? '' : 'AND active = 1';

    const [clients, countRow] = await Promise.all([
      query(env,
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.active,
                u.email_verified, u.last_login_at, u.created_at, u.disabled_at, u.disabled_reason
         FROM users u
         WHERE (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?) ${activeClause}
         ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
        [like, like, like, limit, offset]
      ),
      queryOne(env,
        `SELECT COUNT(*) as count FROM users
         WHERE (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?) ${activeClauseCount}`,
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

    // Auto-create a coach_profile when role is promoted to coach/head_coach
    if (role === 'coach' || role === 'head_coach') {
      const existing = await queryOne(env, 'SELECT id FROM coach_profiles WHERE user_id = ?', [params.id]);
      if (!existing) {
        const user = await queryOne(env, 'SELECT first_name, last_name, email FROM users WHERE id = ?', [params.id]);
        const coachId = crypto.randomUUID();
        await execute(env,
          `INSERT INTO coach_profiles (id, user_id, first_name, last_name, email, active) VALUES (?,?,?,?,?,1)`,
          [coachId, params.id, user.first_name, user.last_name, user.email ?? null]
        );
      }
    }

    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'update', recordType: 'user', recordId: params.id, description: `Admin updated user ${params.id}: role=${role}, active=${active}` });
    return Response.json({ message: 'User updated' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}