/** GET /api/credits */
import { requireAuth } from '../../lib/auth.js';
import { query, queryOne } from '../../lib/db.js';
import { toCamelArray } from '../../lib/serializers.js';

export async function handleClientCredits(request, env) {
  const payload = await requireAuth(request, env);

  const [balRow, entries, purchases] = await Promise.all([
    queryOne(env, 'SELECT COALESCE(SUM(amount), 0) as balance FROM credit_ledger WHERE client_id = ?', [payload.sub]),
    query(env,
      'SELECT id, type, amount, description, expires_at, created_at FROM credit_ledger WHERE client_id = ? ORDER BY created_at DESC LIMIT 50',
      [payload.sub]
    ),
    query(env,
      `SELECT pp.*, pd.name as package_name FROM package_purchases pp
       JOIN package_definitions pd ON pd.id = pp.package_definition_id
       WHERE pp.client_id = ? AND pp.status = 'active' ORDER BY pp.expires_at`,
      [payload.sub]
    ),
  ]);

  return Response.json({
    balance:   balRow?.balance ?? 0,
    entries:   toCamelArray(entries),
    purchases: toCamelArray(purchases),
  });
}