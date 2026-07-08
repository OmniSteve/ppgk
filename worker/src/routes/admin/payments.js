/** Admin payment management */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, execute, audit } from '../../lib/db.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';

export async function handleAdminPayments(request, env, ctx, params) {
  const actor  = await requireRole(request, env, 'admin');
  const url    = new URL(request.url);
  const method = request.method;

  if (method === 'GET' && !params?.id) {
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    const page   = parseInt(url.searchParams.get('page') || '1');
    const limit  = parseInt(url.searchParams.get('limit') || '25');
    const offset = (page - 1) * limit;
    const like   = `%${search}%`;

    const conditions = ['1=1'];
    const bindings   = [];
    if (search) { conditions.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR p.reference LIKE ?)'); bindings.push(like, like, like); }
    if (status) { conditions.push('p.status = ?'); bindings.push(status); }
    const where = conditions.join(' AND ');

    const [payments, countRow, totals] = await Promise.all([
      query(env,
        `SELECT p.id, p.amount, p.status, p.reference, p.description, p.created_at, p.stripe_payment_intent,
                u.first_name || ' ' || u.last_name as client_name
         FROM payments p JOIN users u ON u.id = p.client_id
         WHERE ${where}
         ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
        [...bindings, limit, offset]
      ),
      queryOne(env, `SELECT COUNT(*) as count FROM payments p JOIN users u ON u.id = p.client_id WHERE ${where}`, bindings),
      queryOne(env,
        `SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) as total_paid,
                COALESCE(SUM(CASE WHEN status='refunded' THEN amount ELSE 0 END),0) as total_refunded,
                COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) as total_pending
         FROM payments`, []
      ),
    ]);

    return Response.json({ payments: toCamelArray(payments), total: countRow?.count ?? 0, totals: toCamel(totals) });
  }

  if (method === 'POST' && params?.id) {
    // POST /api/admin/payments/:id/refund
    const url2 = new URL(request.url);
    if (!url2.pathname.endsWith('/refund')) return Response.json({ message: 'Not found' }, { status: 404 });

    const payment = await queryOne(env, 'SELECT * FROM payments WHERE id = ?', [params.id]);
    if (!payment) return Response.json({ message: 'Payment not found' }, { status: 404 });
    if (payment.status !== 'paid') return Response.json({ message: 'Payment cannot be refunded (not in paid status)' }, { status: 400 });
    if (!payment.stripe_payment_intent) {
      return Response.json({ message: 'Payment has no Stripe payment intent on record — refund it from the Stripe dashboard' }, { status: 400 });
    }
    if (!env.STRIPE_SECRET) return Response.json({ message: 'Payment processing is not configured' }, { status: 503 });

    // Issue the refund with Stripe first; only record it locally once Stripe accepts.
    // The idempotency key makes retries of this endpoint safe (Stripe dedupes).
    const formData = new URLSearchParams();
    formData.set('payment_intent', payment.stripe_payment_intent);
    const stripeRes = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `ppgk-refund-${payment.id}`,
      },
      body: formData.toString(),
    });

    if (!stripeRes.ok) {
      const stripeErr = await stripeRes.json().catch(() => ({}));
      console.error('Stripe refund failed:', stripeErr);
      const detail = stripeErr?.error?.message ? ` (${stripeErr.error.message})` : '';
      return Response.json({ message: `Stripe refund failed${detail}` }, { status: 502 });
    }

    const stripeRefund = await stripeRes.json();
    const now = new Date().toISOString();

    const refundId = crypto.randomUUID();
    await execute(env,
      `INSERT INTO refunds (id, payment_id, amount, stripe_refund_id, reason, status, performed_by) VALUES (?,?,?,?,?,?,?)`,
      [refundId, payment.id, payment.amount, stripeRefund.id ?? null, 'admin_requested',
       stripeRefund.status === 'succeeded' ? 'succeeded' : 'pending', actor.sub]
    );
    await execute(env,
      'UPDATE payments SET status = ?, updated_at = ? WHERE id = ?',
      ['refunded', now, payment.id]
    );
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'payment', recordType: 'payment', recordId: payment.id, description: `Refund issued via Stripe (${stripeRefund.id}) for payment ${payment.reference}` });
    return Response.json({ message: 'Refund issued', stripeRefundId: stripeRefund.id, stripeStatus: stripeRefund.status });
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}