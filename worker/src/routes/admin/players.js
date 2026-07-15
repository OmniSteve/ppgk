/**
 * GET    /api/admin/players
 * GET    /api/admin/players/:id
 * PATCH  /api/admin/players/:id
 * GET    /api/admin/players/:id/deactivation-impact
 * GET    /api/admin/players/:id/deletion-eligibility
 * POST   /api/admin/players/:id/deactivate
 * POST   /api/admin/players/:id/reactivate
 * DELETE /api/admin/players/:id
 */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, execute, audit, batch } from '../../lib/db.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';
import {
  getPlayerDeactivationImpact, getPlayerDeletionEligibility, getPlayerFutureBookings,
  cancelFutureBookingsForPlayer, reassignFutureBookingsForPlayer,
} from '../../lib/lifecycle.js';

export async function handleAdminPlayers(request, env, ctx, params) {
  const actor = await requireRole(request, env, 'admin', 'head_coach', 'coach');
  const url   = new URL(request.url);

  // ── Lifecycle sub-routes ────────────────────────────────────────────────
  if (params?.id && url.pathname.endsWith('/deactivation-impact') && request.method === 'GET') {
    const impact = await getPlayerDeactivationImpact(env, params.id);
    return Response.json(impact);
  }

  if (params?.id && url.pathname.endsWith('/deletion-eligibility') && request.method === 'GET') {
    const eligibility = await getPlayerDeletionEligibility(env, params.id);
    return Response.json(eligibility);
  }

  // ── GET /api/admin/players/:id ──────────────────────────────────────────────
  if (request.method === 'GET' && params?.id) {
    const player = await queryOne(env,
      `SELECT p.*, u.first_name || ' ' || u.last_name as parent_name
       FROM players p JOIN users u ON u.id = p.client_id WHERE p.id = ?`,
      [params.id]
    );
    if (!player) return Response.json({ message: 'Player not found' }, { status: 404 });
    return Response.json(toCamel(player));
  }

  if (params?.id && url.pathname.endsWith('/deactivate') && request.method === 'POST') {
    if (actor.role !== 'admin') return Response.json({ message: 'Admin access required' }, { status: 403 });

    const target = await queryOne(env, 'SELECT id, first_name, last_name, client_id, status FROM players WHERE id = ?', [params.id]);
    if (!target) return Response.json({ message: 'Player not found' }, { status: 404 });
    if (target.status === 'inactive') return Response.json({ message: 'Player is already inactive' });

    const body = await request.json().catch(() => ({}));
    const { reason, futureBookingAction, reassignToPlayerId } = body;

    const futureBookings = await getPlayerFutureBookings(env, params.id);
    let resolution = null;

    if (futureBookings.length > 0) {
      if (!futureBookingAction) {
        return Response.json({
          message: `Player has ${futureBookings.length} future booking(s) that must be resolved before deactivation`,
          futureBookings: futureBookings.length,
          bookings: toCamelArray(futureBookings),
        }, { status: 409 });
      }

      if (futureBookingAction === 'cancel_and_return_credit') {
        resolution = await cancelFutureBookingsForPlayer(env, { playerId: params.id, actorId: actor.sub, reason });
      } else if (futureBookingAction === 'reassign') {
        if (!reassignToPlayerId) return Response.json({ message: 'reassignToPlayerId is required for the reassign resolution' }, { status: 400 });
        resolution = await reassignFutureBookingsForPlayer(env, {
          fromPlayerId: params.id, toPlayerId: reassignToPlayerId, actorId: actor.sub, reason,
        });
        if (resolution.error) return Response.json({ message: resolution.error }, { status: 400 });
      } else {
        return Response.json({ message: 'futureBookingAction must be cancel_and_return_credit or reassign' }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    await execute(env,
      `UPDATE players SET status = 'inactive', inactive_at = ?, inactive_by = ?, inactive_reason = ?, updated_at = ? WHERE id = ?`,
      [now, actor.sub, reason ?? null, now, params.id]
    );
    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'deactivate', recordType: 'player', recordId: params.id,
      description: `Player deactivated: ${target.first_name} ${target.last_name}`,
      previousValue: { status: target.status }, newValue: { status: 'inactive' }, reason: reason ?? null,
    });
    return Response.json({ message: 'Player deactivated', resolution });
  }

  if (params?.id && url.pathname.endsWith('/reactivate') && request.method === 'POST') {
    if (actor.role !== 'admin') return Response.json({ message: 'Admin access required' }, { status: 403 });

    const target = await queryOne(env, 'SELECT id, first_name, last_name, status FROM players WHERE id = ?', [params.id]);
    if (!target) return Response.json({ message: 'Player not found' }, { status: 404 });
    if (target.status === 'active') return Response.json({ message: 'Player is already active' });

    const now = new Date().toISOString();
    await execute(env,
      `UPDATE players SET status = 'active', reactivated_at = ?, reactivated_by = ?, updated_at = ? WHERE id = ?`,
      [now, actor.sub, now, params.id]
    );
    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'reactivate', recordType: 'player', recordId: params.id,
      description: `Player reactivated: ${target.first_name} ${target.last_name}`,
      previousValue: { status: target.status }, newValue: { status: 'active' },
    });
    return Response.json({ message: 'Player reactivated' });
  }

  if (params?.id && request.method === 'DELETE') {
    if (actor.role !== 'admin') return Response.json({ message: 'Admin access required' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'DELETE') {
      return Response.json({ message: 'Type DELETE to confirm permanent deletion' }, { status: 400 });
    }

    const target = await queryOne(env, 'SELECT id, first_name, last_name, client_id FROM players WHERE id = ?', [params.id]);
    if (!target) return Response.json({ message: 'Player not found' }, { status: 404 });

    const eligibility = await getPlayerDeletionEligibility(env, params.id);
    if (!eligibility.eligible) {
      return Response.json({ message: 'This player cannot be permanently deleted', ...eligibility }, { status: 409 });
    }

    await batch(env, [
      { sql: 'UPDATE order_items SET player_id = NULL WHERE player_id = ?', params: [params.id] },
      { sql: 'UPDATE consent_records SET player_id = NULL WHERE player_id = ?', params: [params.id] },
      {
        sql: `INSERT INTO audit_log (id, actor_id, actor_name, action, record_type, record_id, description, previous_value, reason)
              VALUES (?, ?, ?, 'delete', 'player', ?, ?, ?, ?)`,
        params: [
          crypto.randomUUID(), actor.sub, `${actor.firstName} ${actor.lastName}`, params.id,
          `Player permanently deleted: ${target.first_name} ${target.last_name}`,
          JSON.stringify({ id: target.id, name: `${target.first_name} ${target.last_name}`, clientId: target.client_id }),
          body.reason ?? null,
        ],
      },
      { sql: 'DELETE FROM players WHERE id = ?', params: [params.id] },
    ]);

    return Response.json({ message: 'Player permanently deleted' });
  }

  // ── PATCH /api/admin/players/:id ────────────────────────────────────────────
  if (request.method === 'PATCH' && params?.id) {
    const body = await request.json().catch(() => ({}));
    const now  = new Date().toISOString();
    const { firstName, lastName, dateOfBirth, ageGroup, experienceLevel,
            currentClub, school, medicalInfo, allergies,
            emergencyContactName, emergencyContactPhone, emergencyContactRelationship, notes, status } = body;

    await execute(env,
      `UPDATE players SET
         first_name = COALESCE(?, first_name),
         last_name  = COALESCE(?, last_name),
         date_of_birth = COALESCE(?, date_of_birth),
         age_group  = COALESCE(?, age_group),
         experience_level = COALESCE(?, experience_level),
         current_club = COALESCE(?, current_club),
         school     = COALESCE(?, school),
         medical_info = COALESCE(?, medical_info),
         allergies  = COALESCE(?, allergies),
         emergency_contact_name  = COALESCE(?, emergency_contact_name),
         emergency_contact_phone = COALESCE(?, emergency_contact_phone),
         emergency_contact_relationship = COALESCE(?, emergency_contact_relationship),
         notes      = COALESCE(?, notes),
         status     = COALESCE(?, status),
         updated_at = ?
       WHERE id = ?`,
      [firstName ?? null, lastName ?? null, dateOfBirth ?? null,
       ageGroup ?? null, experienceLevel ?? null, currentClub ?? null,
       school ?? null, medicalInfo ?? null, allergies ?? null,
       emergencyContactName ?? null, emergencyContactPhone ?? null,
       emergencyContactRelationship ?? null,
       notes ?? null, status ?? null,
       now, params.id]
    );

    const updated = await queryOne(env,
      `SELECT p.*, u.first_name || ' ' || u.last_name as parent_name
       FROM players p JOIN users u ON u.id = p.client_id WHERE p.id = ?`,
      [params.id]
    );
    return Response.json(toCamel(updated));
  }

  // ── GET /api/admin/players ──────────────────────────────────────────────────
  const search = url.searchParams.get('search') || '';
  const statusFilter = url.searchParams.get('status') || '';
  const includeInactive = url.searchParams.get('includeInactive') === 'true';
  const page   = parseInt(url.searchParams.get('page') || '1');
  const limit  = parseInt(url.searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;
  const like   = `%${search}%`;

  const conditions = ['(p.first_name LIKE ? OR p.last_name LIKE ? OR p.current_club LIKE ? OR u.first_name LIKE ?)'];
  const bindings    = [like, like, like, like];
  if (statusFilter) {
    conditions.push('p.status = ?');
    bindings.push(statusFilter);
  } else if (!includeInactive) {
    conditions.push("p.status = 'active'");
  }
  const where = conditions.join(' AND ');

  const [players, countRow] = await Promise.all([
    query(env,
      `SELECT p.*, u.first_name || ' ' || u.last_name as parent_name
       FROM players p JOIN users u ON u.id = p.client_id
       WHERE ${where}
       ORDER BY p.first_name LIMIT ? OFFSET ?`,
      [...bindings, limit, offset]
    ),
    queryOne(env,
      `SELECT COUNT(*) as count FROM players p JOIN users u ON u.id = p.client_id WHERE ${where}`,
      bindings
    ),
  ]);

  return Response.json({ players: toCamelArray(players), total: countRow?.count ?? 0 });
}