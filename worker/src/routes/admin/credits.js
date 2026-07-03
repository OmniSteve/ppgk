/** Admin credit management */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, execute, audit } from '../../lib/db.js';

export async function handleAdminCredits(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin');
  const url    = new URL(request.url);
  const method = request.method;

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

    return Response.json({ entries, total: countRow?.count ?? 0 });
  }

  if (method === 'POST') {
    // POST /api/admin/credits/grant
    const body = await request.json();
    const { clientId, amount, reason } = body;
    if (!clientId || !amount || !reason) return Response.json({ message: 'clientId, amount and reason required' }, { status: 400 });

    const amountInt = parseInt(amount);
    if (isNaN(amountInt)) return Response.json({ message: 'amount must be an integer' }, { status: 400 });

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

    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'credit', recordType: 'credit', recordId: clientId, description: `Admin ${type}: ${amountInt} credits for client ${clientId}. Reason: ${reason}` });
    return Response.json({ message: 'Credits updated', newBalance });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}