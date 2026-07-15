/**
 * CRUD /api/admin/coaches
 * GET    /api/admin/coaches/:id/deactivation-impact
 * GET    /api/admin/coaches/:id/deletion-eligibility
 * POST   /api/admin/coaches/:id/deactivate
 * POST   /api/admin/coaches/:id/reactivate
 * DELETE /api/admin/coaches/:id
 */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, execute, audit, batch } from '../../lib/db.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';
import {
  getCoachDeactivationImpact, getCoachDeletionEligibility, getCoachFutureSessions,
  reassignFutureSessionsForCoach, cancelFutureSessionsForCoach,
} from '../../lib/lifecycle.js';

export async function handleAdminCoaches(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin');
  const url    = new URL(request.url);
  const method = request.method;

  // ── Lifecycle sub-routes ────────────────────────────────────────────────
  if (params?.id && url.pathname.endsWith('/deactivation-impact') && method === 'GET') {
    const impact = await getCoachDeactivationImpact(env, params.id);
    return Response.json(impact);
  }

  if (params?.id && url.pathname.endsWith('/deletion-eligibility') && method === 'GET') {
    const eligibility = await getCoachDeletionEligibility(env, params.id);
    return Response.json(eligibility);
  }

  if (params?.id && url.pathname.endsWith('/deactivate') && method === 'POST') {
    const target = await queryOne(env, 'SELECT id, first_name, last_name, active FROM coach_profiles WHERE id = ?', [params.id]);
    if (!target) return Response.json({ message: 'Coach not found' }, { status: 404 });
    if (!target.active) return Response.json({ message: 'Coach is already inactive' });

    const body = await request.json().catch(() => ({}));
    const { reason, futureSessionAction, reassignToCoachId } = body;

    const futureSessions = await getCoachFutureSessions(env, params.id);
    let resolution = null;

    if (futureSessions.length > 0) {
      if (!futureSessionAction) {
        return Response.json({
          message: `Coach has ${futureSessions.length} future session(s) that must be resolved before deactivation`,
          futureSessions: futureSessions.length,
          sessions: toCamelArray(futureSessions),
        }, { status: 409 });
      }

      if (futureSessionAction === 'reassign') {
        if (!reassignToCoachId) return Response.json({ message: 'reassignToCoachId is required for the reassign resolution' }, { status: 400 });
        resolution = await reassignFutureSessionsForCoach(env, {
          fromCoachId: params.id, toCoachId: reassignToCoachId,
          actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
        });
        if (resolution.error) return Response.json({ message: resolution.error }, { status: 400 });
      } else if (futureSessionAction === 'cancel') {
        resolution = await cancelFutureSessionsForCoach(env, {
          coachId: params.id, actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
        });
      } else {
        return Response.json({ message: 'futureSessionAction must be reassign or cancel' }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    await execute(env,
      `UPDATE coach_profiles SET active = 0, inactive_at = ?, inactive_by = ?, inactive_reason = ?, updated_at = ? WHERE id = ?`,
      [now, actor.sub, reason ?? null, now, params.id]
    );
    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'deactivate', recordType: 'coach', recordId: params.id,
      description: `Coach deactivated: ${target.first_name} ${target.last_name}`,
      previousValue: { active: true }, newValue: { active: false }, reason: reason ?? null,
    });
    return Response.json({ message: 'Coach deactivated', resolution });
  }

  if (params?.id && url.pathname.endsWith('/reactivate') && method === 'POST') {
    const target = await queryOne(env, 'SELECT id, first_name, last_name, active FROM coach_profiles WHERE id = ?', [params.id]);
    if (!target) return Response.json({ message: 'Coach not found' }, { status: 404 });
    if (target.active) return Response.json({ message: 'Coach is already active' });

    const now = new Date().toISOString();
    await execute(env,
      `UPDATE coach_profiles SET active = 1, reactivated_at = ?, reactivated_by = ?, updated_at = ? WHERE id = ?`,
      [now, actor.sub, now, params.id]
    );
    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'reactivate', recordType: 'coach', recordId: params.id,
      description: `Coach reactivated: ${target.first_name} ${target.last_name}`,
      previousValue: { active: false }, newValue: { active: true },
    });
    return Response.json({ message: 'Coach reactivated' });
  }

  if (params?.id && method === 'DELETE') {
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'DELETE') {
      return Response.json({ message: 'Type DELETE to confirm permanent deletion' }, { status: 400 });
    }

    const target = await queryOne(env, 'SELECT id, first_name, last_name FROM coach_profiles WHERE id = ?', [params.id]);
    if (!target) return Response.json({ message: 'Coach not found' }, { status: 404 });

    const eligibility = await getCoachDeletionEligibility(env, params.id);
    if (!eligibility.eligible) {
      return Response.json({ message: 'This coach cannot be permanently deleted', ...eligibility }, { status: 409 });
    }

    await batch(env, [
      {
        sql: `INSERT INTO audit_log (id, actor_id, actor_name, action, record_type, record_id, description, previous_value, reason)
              VALUES (?, ?, ?, 'delete', 'coach', ?, ?, ?, ?)`,
        params: [
          crypto.randomUUID(), actor.sub, `${actor.firstName} ${actor.lastName}`, params.id,
          `Coach permanently deleted: ${target.first_name} ${target.last_name}`,
          JSON.stringify({ id: target.id, name: `${target.first_name} ${target.last_name}` }),
          body.reason ?? null,
        ],
      },
      { sql: 'DELETE FROM coach_profiles WHERE id = ?', params: [params.id] },
    ]);

    return Response.json({ message: 'Coach permanently deleted' });
  }

  if (method === 'GET' && !params?.id) {
    const search = url.searchParams.get('search') || '';
    const includeInactive = url.searchParams.get('includeInactive') === 'true';
    const conditions = ['(first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)'];
    const bindings   = [`%${search}%`, `%${search}%`, `%${search}%`];
    if (!includeInactive) conditions.push('active = 1');
    const rows = await query(env,
      `SELECT * FROM coach_profiles WHERE ${conditions.join(' AND ')} ORDER BY first_name`,
      bindings
    );
    return Response.json({ coaches: toCamelArray(rows) });
  }

  if (method === 'POST' && url.pathname.endsWith('/sync')) {
    // Auto-create coach_profiles for any users with role coach/head_coach who don't have one
    const unlinked = await query(env,
      `SELECT u.id, u.first_name, u.last_name, u.email FROM users u
       WHERE u.role IN ('coach', 'head_coach')
       AND NOT EXISTS (SELECT 1 FROM coach_profiles cp WHERE cp.user_id = u.id)`
    , []);
    for (const u of unlinked) {
      const coachId = crypto.randomUUID();
      await execute(env,
        `INSERT INTO coach_profiles (id, user_id, first_name, last_name, email, active) VALUES (?,?,?,?,?,1)`,
        [coachId, u.id, u.first_name, u.last_name, u.email ?? null]
      );
    }
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'sync', recordType: 'coach', recordId: 'bulk', description: `Synced ${unlinked.length} coach profile(s) from user roles` });
    return Response.json({ synced: unlinked.length });
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