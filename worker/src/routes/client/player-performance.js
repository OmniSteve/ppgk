/** Client-facing player performance evaluations (visible records for own players only) */
import { requireAuth } from '../../lib/auth.js';
import { query } from '../../lib/db.js';
import { ok } from '../../lib/validate.js';

export async function handleClientPlayerPerformance(request, env, ctx, params) {
  const payload = await requireAuth(request, env);

  const records = await query(env,
    `SELECT pp.* FROM player_performance pp
     JOIN players p ON p.id = pp.player_id
     WHERE pp.player_id = ? AND p.client_id = ? AND pp.is_visible_to_client = 1
     ORDER BY pp.evaluation_date DESC`,
    [params.playerId, payload.sub]
  );

  return ok({ records });
}
