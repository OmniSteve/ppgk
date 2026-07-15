/**
 * Player performance evaluations (admin / head_coach / coach).
 *
 * Permission model:
 *  - admin / head_coach: unrestricted read/write on all records (same precedent as
 *    admin/attendance.js, admin/sessions.js — head_coach is treated as admin-equivalent).
 *  - coach: may create a record for any player. May view a record only if they created it
 *    (created_by = their user id) or the record's effective session (session_id, or the
 *    session_id derived from booking_id) is assigned to them via
 *    sessions.coach_id = coach_profiles.id (resolved from coach_profiles.user_id, since a
 *    coach's JWT `sub` is a users.id, not a coach_profiles.id — see coach/sessions.js).
 *    May update/delete any record.
 */
import { requireRole } from '../lib/auth.js';
import { query, queryOne, execute, audit } from '../lib/db.js';
import { ok, err, requireFields, isValidDate } from '../lib/validate.js';
import { RATING_FIELDS, validateRatings, mapPerformanceInput } from '../lib/playerPerformance.js';

const EFFECTIVE_SESSION_SQL =
  'COALESCE(pp.session_id, (SELECT b.session_id FROM bookings b WHERE b.id = pp.booking_id))';

async function resolveCoachId(env, userId) {
  const coach = await queryOne(env, 'SELECT id FROM coach_profiles WHERE user_id = ? AND active = 1', [userId]);
  return coach?.id ?? null;
}

export async function handlePlayerPerformance(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin', 'head_coach', 'coach');
  const method = request.method;
  const isPrivileged = actor.role === 'admin' || actor.role === 'head_coach';

  if (method === 'GET' && params?.playerId) {
    const player = await queryOne(env, 'SELECT id FROM players WHERE id = ?', [params.playerId]);
    if (!player) return err('Player not found', 404);

    let coachId = null;
    if (!isPrivileged) coachId = await resolveCoachId(env, actor.sub);

    const records = await query(env,
      `SELECT pp.* FROM player_performance pp
       LEFT JOIN sessions s ON s.id = ${EFFECTIVE_SESSION_SQL}
       WHERE pp.player_id = ?
       AND (${isPrivileged ? '1=1' : '(pp.created_by = ? OR s.coach_id = ?)'})
       ORDER BY pp.evaluation_date DESC`,
      isPrivileged ? [params.playerId] : [params.playerId, actor.sub, coachId]
    );
    return ok({ records });
  }

  if (method === 'GET' && params?.id) {
    const row = await queryOne(env,
      `SELECT pp.*, s.coach_id AS effective_coach_id FROM player_performance pp
       LEFT JOIN sessions s ON s.id = ${EFFECTIVE_SESSION_SQL}
       WHERE pp.id = ?`,
      [params.id]
    );
    if (!row) return err('Performance record not found', 404);

    if (!isPrivileged && row.created_by !== actor.sub) {
      const coachId = await resolveCoachId(env, actor.sub);
      if (!coachId || row.effective_coach_id !== coachId) return err('Forbidden', 403);
    }

    delete row.effective_coach_id;
    return ok(row);
  }

  if (method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return err('Request body must be valid JSON'); }

    const missing = requireFields(body, ['playerId', 'clientId', 'evaluationDate', ...RATING_FIELDS]);
    if (missing) return err(missing);

    const ratingError = validateRatings(body);
    if (ratingError) return err(ratingError);

    if (!isValidDate(body.evaluationDate)) return err('evaluationDate must be a valid YYYY-MM-DD date');

    const player = await queryOne(env, 'SELECT id, client_id FROM players WHERE id = ?', [body.playerId]);
    if (!player) return err('Player not found', 404);
    if (player.client_id !== body.clientId) return err("clientId does not match this player's client", 400);

    let sessionId = body.sessionId ?? null;
    if (body.bookingId) {
      const booking = await queryOne(env, 'SELECT id, session_id, player_id FROM bookings WHERE id = ?', [body.bookingId]);
      if (!booking) return err('Booking not found', 404);
      if (booking.player_id !== body.playerId) return err('bookingId does not belong to this player', 400);
      if (sessionId && sessionId !== booking.session_id) return err("sessionId does not match booking's session", 400);
      sessionId = booking.session_id;
    }
    if (sessionId) {
      const session = await queryOne(env, 'SELECT id FROM sessions WHERE id = ?', [sessionId]);
      if (!session) return err('Session not found', 404);
    }

    const id = crypto.randomUUID();
    const f = mapPerformanceInput(body);
    await execute(env,
      `INSERT INTO player_performance (
         id, player_id, client_id, booking_id, session_id, created_by,
         evaluation_date, overall_rating, handling_rating, diving_rating, footwork_rating,
         distribution_rating, communication_rating, attitude_rating,
         strengths, areas_to_improve, coach_notes, recommended_focus, is_visible_to_client
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, body.playerId, body.clientId, body.bookingId ?? null, sessionId, actor.sub,
        f.evaluation_date, f.overall_rating, f.handling_rating, f.diving_rating, f.footwork_rating,
        f.distribution_rating, f.communication_rating, f.attitude_rating,
        f.strengths, f.areas_to_improve, f.coach_notes, f.recommended_focus, f.is_visible_to_client,
      ]
    );

    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'create', recordType: 'player_performance', recordId: id,
      description: `Performance record created for player ${body.playerId}`,
    });

    return ok({ id }, 201);
  }

  if (method === 'PUT' && params?.id) {
    const existing = await queryOne(env, 'SELECT id FROM player_performance WHERE id = ?', [params.id]);
    if (!existing) return err('Performance record not found', 404);

    let body;
    try { body = await request.json(); } catch { return err('Request body must be valid JSON'); }

    const missing = requireFields(body, ['evaluationDate', ...RATING_FIELDS]);
    if (missing) return err(missing);

    const ratingError = validateRatings(body);
    if (ratingError) return err(ratingError);

    if (!isValidDate(body.evaluationDate)) return err('evaluationDate must be a valid YYYY-MM-DD date');

    const f = mapPerformanceInput(body);
    await execute(env,
      `UPDATE player_performance SET
         evaluation_date=?, overall_rating=?, handling_rating=?, diving_rating=?, footwork_rating=?,
         distribution_rating=?, communication_rating=?, attitude_rating=?,
         strengths=?, areas_to_improve=?, coach_notes=?, recommended_focus=?, is_visible_to_client=?,
         updated_at=?
       WHERE id=?`,
      [
        f.evaluation_date, f.overall_rating, f.handling_rating, f.diving_rating, f.footwork_rating,
        f.distribution_rating, f.communication_rating, f.attitude_rating,
        f.strengths, f.areas_to_improve, f.coach_notes, f.recommended_focus, f.is_visible_to_client,
        new Date().toISOString(), params.id,
      ]
    );

    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'update', recordType: 'player_performance', recordId: params.id,
      description: 'Performance record updated',
    });

    return ok({ message: 'Updated' });
  }

  if (method === 'DELETE' && params?.id) {
    const existing = await queryOne(env, 'SELECT id FROM player_performance WHERE id = ?', [params.id]);
    if (!existing) return err('Performance record not found', 404);

    await execute(env, 'DELETE FROM player_performance WHERE id = ?', [params.id]);

    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'delete', recordType: 'player_performance', recordId: params.id,
      description: 'Performance record deleted',
    });

    return ok({ message: 'Deleted' });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}
