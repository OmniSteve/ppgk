/** Admin payment management */
import { requireRole } from '../../lib/auth.js';
import { query, queryOne, batch, audit } from '../../lib/db.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';
import { getBalance, computeRefundCreditImpact, buildCreditRemovalStatements } from '../../lib/credits.js';

/** Round to 2 decimal places (money). */
const round2 = (n) => Math.round(n * 100) / 100;

/** Sum of refunds already recorded against a payment (excluding failed). */
async function alreadyRefunded(env, paymentId) {
  const row = await queryOne(env,
    "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM refunds WHERE payment_id = ? AND status != 'failed'",
    [paymentId]
  );
  return { total: Number(row?.total ?? 0), count: Number(row?.count ?? 0) };
}

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

  // GET /api/admin/payments/:id/refund-preview?amount=X
  if (method === 'GET' && params?.id && url.pathname.endsWith('/refund-preview')) {
    const payment = await queryOne(env, 'SELECT * FROM payments WHERE id = ?', [params.id]);
    if (!payment) return Response.json({ message: 'Payment not found' }, { status: 404 });

    const refunded      = await alreadyRefunded(env, payment.id);
    const maxRefundable = round2(payment.amount - refunded.total);
    const requested     = url.searchParams.get('amount');
    const amount        = requested !== null && requested !== '' ? round2(Number(requested)) : maxRefundable;

    if (!Number.isFinite(amount) || amount <= 0 || amount > maxRefundable) {
      return Response.json({
        message: `Refund amount must be between 0.01 and ${maxRefundable.toFixed(2)}`,
        maxRefundable,
      }, { status: 400 });
    }

    const impact = await computeRefundCreditImpact(env, {
      clientId:     payment.client_id,
      orderId:      payment.order_id,
      refundAmount: amount,
    });

    return Response.json(toCamel({
      refund_amount:    amount,
      max_refundable:   maxRefundable,
      already_refunded: refunded.total,
      credits_to_remove: impact.creditsToRemove,
      total_available:   impact.totalAvailable,
      blocked:           impact.blocked,
      blocked_reason:    impact.blockedReason,
      packages:          impact.packages,
    }));
  }

  if (method === 'POST' && params?.id) {
    // POST /api/admin/payments/:id/refund
    // Body: { amount?, keepCredits?, adminNote? }
    if (!url.pathname.endsWith('/refund')) return Response.json({ message: 'Not found' }, { status: 404 });

    let body = {};
    try { body = await request.json(); } catch { /* empty body = full refund, defaults apply */ }
    const keepCredits = body.keepCredits === true;
    const adminNote   = typeof body.adminNote === 'string' ? body.adminNote.trim() : '';

    // Server-side validation — never rely on the frontend alone
    if (keepCredits && adminNote.length < 5) {
      return Response.json({ message: 'An admin note explaining why credits are being kept is required (min 5 characters)' }, { status: 400 });
    }

    const payment = await queryOne(env, 'SELECT * FROM payments WHERE id = ?', [params.id]);
    if (!payment) return Response.json({ message: 'Payment not found' }, { status: 404 });
    if (!['paid', 'partial_refund'].includes(payment.status)) {
      return Response.json({ message: 'Payment cannot be refunded (not in a refundable status)' }, { status: 400 });
    }
    if (!payment.stripe_payment_intent) {
      return Response.json({ message: 'Payment has no Stripe payment intent on record — refund it from the Stripe dashboard' }, { status: 400 });
    }
    if (!env.STRIPE_SECRET) return Response.json({ message: 'Payment processing is not configured' }, { status: 503 });

    const refunded      = await alreadyRefunded(env, payment.id);
    const maxRefundable = round2(payment.amount - refunded.total);
    const amount        = body.amount !== undefined && body.amount !== null && body.amount !== ''
      ? round2(Number(body.amount))
      : maxRefundable;

    if (!Number.isFinite(amount) || amount <= 0 || amount > maxRefundable) {
      return Response.json({ message: `Refund amount must be between 0.01 and ${maxRefundable.toFixed(2)}` }, { status: 400 });
    }

    // Compute credit impact and block BEFORE any money moves
    const impact = await computeRefundCreditImpact(env, {
      clientId:     payment.client_id,
      orderId:      payment.order_id,
      refundAmount: amount,
    });
    if (!keepCredits && impact.blocked) {
      return Response.json({ message: impact.blockedReason }, { status: 409 });
    }

    // Issue the refund with Stripe first; only record it locally once Stripe accepts.
    // Key is deterministic per refund sequence, so endpoint retries are safe.
    const formData = new URLSearchParams();
    formData.set('payment_intent', payment.stripe_payment_intent);
    formData.set('amount', String(Math.round(amount * 100)));
    const stripeRes = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `ppgk-refund-${payment.id}-${refunded.count}`,
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

    // Assemble every DB write into one atomic batch: refund row, payment
    // status, credit removals, package status — all or nothing.
    const statements = [];
    let creditsRemoved = 0;

    if (!keepCredits && impact.creditsToRemove > 0) {
      const currentBalance = await getBalance(env, payment.client_id);
      const removal = buildCreditRemovalStatements({
        clientId:         payment.client_id,
        impact,
        currentBalance,
        performedBy:      actor.sub,
        paymentReference: payment.reference || payment.id,
        now,
      });
      statements.push(...removal.statements);
      creditsRemoved = removal.removed;
    }

    const refundId  = crypto.randomUUID();
    const newStatus = round2(refunded.total + amount) >= payment.amount ? 'refunded' : 'partial_refund';
    statements.push({
      sql: `INSERT INTO refunds (id, payment_id, amount, stripe_refund_id, reason, status, performed_by) VALUES (?,?,?,?,?,?,?)`,
      params: [refundId, payment.id, amount, stripeRefund.id ?? null,
               keepCredits ? `admin_requested (credits kept: ${adminNote})` : 'admin_requested',
               stripeRefund.status === 'succeeded' ? 'succeeded' : 'pending', actor.sub],
    });
    statements.push({
      sql: 'UPDATE payments SET status = ?, updated_at = ? WHERE id = ?',
      params: [newStatus, now, payment.id],
    });

    try {
      await batch(env, statements);
    } catch (err) {
      // Stripe refund succeeded but local recording failed — log loudly so it
      // can be reconciled; the charge.refunded webhook will still update the
      // payment status.
      console.error(`CRITICAL: Stripe refund ${stripeRefund.id} succeeded but DB batch failed for payment ${payment.id}:`, err);
      return Response.json({
        message: 'Refund was issued with Stripe but recording it locally failed — check the audit log and Stripe dashboard before retrying',
      }, { status: 500 });
    }

    // Related bookings/players for the audit trail (best effort)
    const bookings = payment.order_id
      ? await query(env, 'SELECT id, player_id FROM bookings WHERE order_id = ?', [payment.order_id])
      : [];

    await audit(env, {
      actorId:     actor.sub,
      actorName:   `${actor.firstName} ${actor.lastName}`,
      action:      'payment',
      recordType:  'payment',
      recordId:    payment.id,
      description: `Refund of €${amount.toFixed(2)} issued via Stripe (${stripeRefund.id}) for payment ${payment.reference}. ` +
                   (keepCredits
                     ? `Credits kept as goodwill (${impact.creditsToRemove} would have been removed).`
                     : `${creditsRemoved} credit(s) removed.`),
      newValue: {
        refundAmount:       amount,
        creditsRemoved,
        creditsKept:        keepCredits,
        clientId:           payment.client_id,
        orderId:            payment.order_id,
        packagePurchaseIds: impact.packages.map((p) => p.packagePurchaseId),
        bookingIds:         bookings.map((b) => b.id),
        playerIds:          [...new Set(bookings.map((b) => b.player_id).filter(Boolean))],
        refundId,
        stripeRefundId:     stripeRefund.id,
        paymentStatus:      newStatus,
      },
      reason: adminNote || null,
    });

    return Response.json(toCamel({
      message:          keepCredits ? 'Refund issued — credits kept' : 'Refund issued',
      stripe_refund_id: stripeRefund.id,
      stripe_status:    stripeRefund.status,
      credits_removed:  creditsRemoved,
      credits_kept:     keepCredits,
      payment_status:   newStatus,
    }));
  }

  return Response.json({ message: 'Method not allowed' }, { status: 405 });
}
