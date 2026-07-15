/** Admin credit management */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, execute, audit } from '../../lib/db.js';
import { toCamelArray } from '../../lib/serializers.js';

export async function handleAdminCredits(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin');
  const url    = new URL(request.url);
  const method = request.method;

  // ── GET /api/admin/credits/search-players ─────────────────────────────────
  // Player-based search for the grant/deduct selector. Joins players → users
  // (the client/parent account) and returns camelCase fields with the current
  // valid (non-expired) credit balance.
  if (method === 'GET' && url.pathname.endsWith('/search-players')) {
    const q = (url.searchParams.get('q') || '').trim();
    if (q.length < 2) return Response.json([]);

    const like = `%${q}%`;
    const now  = new Date().toISOString();
    const rows = await query(env,
      `SELECT p.id            AS player_id,
              p.client_id     AS client_id,
              p.first_name   AS player_first_name,
              p.last_name    AS player_last_name,
              p.date_of_birth AS player_date_of_birth,
              u.first_name   AS client_first_name,
              u.last_name    AS client_last_name,
              u.email        AS client_email,
              u.phone        AS client_phone,
              (SELECT COALESCE(SUM(amount), 0)
                 FROM credit_ledger
                WHERE client_id = p.client_id
                  AND (expires_at IS NULL OR expires_at > ?)) AS credit_balance
         FROM players p
         JOIN users u ON u.id = p.client_id
        WHERE p.first_name LIKE ? OR p.last_name LIKE ?
           OR u.first_name LIKE ? OR u.last_name LIKE ?
           OR u.email LIKE ? OR u.phone LIKE ?
        ORDER BY p.first_name, p.last_name
        LIMIT 15`,
      [now, like, like, like, like, like, like]
    );

    const results = rows.map((r) => ({
      playerId:         r.player_id,
      clientId:         r.client_id,
      playerName:       `${r.player_first_name} ${r.player_last_name}`,
      playerDateOfBirth: r.player_date_of_birth,
      clientName:       `${r.client_first_name} ${r.client_last_name}`,
      clientEmail:      r.client_email,
      clientPhone:      r.client_phone,
      creditBalance:    r.credit_balance ?? 0,
    }));
    return Response.json(results);
  }

  if (method === 'GET') {
    const search = url.searchParams.get('search') || '';
    const type   = url.searchParams.get('type')   || '';
    const page   = parseInt(url.searchParams.get('page') || '1');
    const limit  = parseInt(url.searchParams.get('limit') || '25');
    const offset = (page - 1) * limit;
    const like   = `%${search}%`;

    const conditions = ['1=1'];
    const bindings   = [];
    if (search) { conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ?)'); bindings.push(like, like); }
    if (type)   { conditions.push('cl.type = ?'); bindings.push(type); }
    const where = conditions.join(' AND ');

    const [entries, countRow] = await Promise.all([
      query(env,
        `SELECT cl.id, cl.type, cl.amount, cl.balance_after, cl.description, cl.expires_at, cl.created_at,
                u.first_name || ' ' || u.last_name as client_name
         FROM credit_ledger cl JOIN users u ON u.id = cl.client_id
         WHERE ${where}
         ORDER BY cl.created_at DESC LIMIT ? OFFSET ?`,
        [...bindings, limit, offset]
      ),
      queryOne(env,
        `SELECT COUNT(*) as count FROM credit_ledger cl JOIN users u ON u.id = cl.client_id WHERE ${where}`,
        bindings
      ),
    ]);

    return Response.json({ entries: toCamelArray(entries), total: countRow?.count ?? 0 });
  }

  if (method === 'POST') {
    // POST /api/admin/credits/grant
    const body = await request.json();
    const { clientId, playerId, amount, reason } = body;
    if (!clientId || !amount || !reason) return Response.json({ message: 'clientId, amount and reason required' }, { status: 400 });

    const amountInt = parseInt(amount);
    if (isNaN(amountInt)) return Response.json({ message: 'amount must be an integer' }, { status: 400 });

    // Validate the client exists and is active
    const client = await queryOne(env, 'SELECT id, active FROM users WHERE id = ?', [clientId]);
    if (!client) return Response.json({ message: 'Selected client does not exist' }, { status: 400 });
    if (!client.active) return Response.json({ message: 'Cannot grant credits to an inactive client' }, { status: 400 });

    // If a playerId is supplied, validate it exists, belongs to that client, and is active
    if (playerId) {
      const player = await queryOne(env, 'SELECT id, client_id, status FROM players WHERE id = ?', [playerId]);
      if (!player) return Response.json({ message: 'Selected player does not exist' }, { status: 400 });
      if (player.client_id !== clientId) return Response.json({ message: 'Player does not belong to the selected client' }, { status: 400 });
      if (player.status !== 'active') return Response.json({ message: 'Cannot grant credits for an inactive player' }, { status: 400 });
    }

    // Calculate current balance
    const balRow = await queryOne(env,
      'SELECT COALESCE(SUM(amount), 0) as balance FROM credit_ledger WHERE client_id = ?',
      [clientId]
    );
    const currentBalance = balRow?.balance ?? 0;
    const newBalance     = currentBalance + amountInt;

    if (newBalance < 0) return Response.json({ message: 'Cannot deduct more credits than the client has' }, { status: 400 });

    const type = amountInt > 0 ? 'admin_grant' : 'admin_deduct';
    await execute(env,
      `INSERT INTO credit_ledger (id, client_id, type, amount, balance_after, description, performed_by)
       VALUES (?,?,?,?,?,?,?)`,
      [crypto.randomUUID(), clientId, type, amountInt, newBalance, reason, actor.sub]
    );

    const auditDesc = playerId
      ? `Admin ${type}: ${amountInt} credits for client ${clientId} (player ${playerId}). Reason: ${reason}`
      : `Admin ${type}: ${amountInt} credits for client ${clientId}. Reason: ${reason}`;
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'credit', recordType: 'credit', recordId: clientId, description: auditDesc });
    return Response.json({ message: 'Credits updated', newBalance });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}