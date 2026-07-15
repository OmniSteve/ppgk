/**
 * Tests for refund → credit removal flow.
 * Run with: node worker/tests/refund-credits.test.js
 *
 * Unlike booking.test.js these import the REAL modules (lib/credits.js and
 * the admin payments route) and drive them through a mock D1 binding and a
 * stubbed Stripe fetch — no network, no real D1 required.
 */
import { computeRefundCreditImpact, deductCredits, refundCredits } from '../src/lib/credits.js';
import { handleAdminPayments } from '../src/routes/admin/payments.js';
import { signJwt } from '../src/lib/auth.js';

// ─── In-memory D1 mock ────────────────────────────────────────────────────────
let store;

function resetStore() {
  store = {
    payments: [], refunds: [], package_purchases: [], package_definitions: [],
    credit_ledger: [], bookings: [], audit_log: [],
  };
}

function ledgerInsert(sql, params) {
  // Column layouts match the exact INSERT statements in credits.js / payments.js
  const type = ["usage", "refund", "purchase", "refund_removal", "admin_grant"]
    .find((t) => sql.includes(`'${t}'`));
  let row;
  if (type === 'usage' || type === 'refund') {
    // (id, client_id, 'type', amount, balance_after, booking_id, package_purchase_id, description, expires_at)
    row = { id: params[0], client_id: params[1], type, amount: params[2], balance_after: params[3],
            booking_id: params[4], package_purchase_id: params[5], description: params[6], expires_at: params[7] };
  } else if (type === 'purchase') {
    row = { id: params[0], client_id: params[1], type, amount: params[2], balance_after: params[3],
            package_purchase_id: params[4], description: params[5], expires_at: params[6] };
  } else if (type === 'refund_removal') {
    // (id, client_id, 'refund_removal', amount, balance_after, package_purchase_id, description, expires_at, performed_by)
    row = { id: params[0], client_id: params[1], type, amount: params[2], balance_after: params[3],
            package_purchase_id: params[4], description: params[5], expires_at: params[6], performed_by: params[7] };
  } else {
    throw new Error(`ledgerInsert: unrecognised statement: ${sql}`);
  }
  store.credit_ledger.push(row);
}

function makeStatement(sql, params) {
  return {
    sql, params,
    async first() {
      if (sql.includes('FROM refunds WHERE payment_id')) {
        const rows = store.refunds.filter((r) => r.payment_id === params[0] && r.status !== 'failed');
        return { total: rows.reduce((s, r) => s + r.amount, 0), count: rows.length };
      }
      if (sql.includes('SELECT * FROM payments')) return store.payments.find((p) => p.id === params[0]) ?? null;
      if (sql.includes("booking_id = ? AND type = 'usage'")) {
        return store.credit_ledger.find((e) => e.booking_id === params[0] && e.type === 'usage') ?? null;
      }
      if (sql.includes("booking_id = ? AND type = 'refund'")) {
        return store.credit_ledger.find((e) => e.booking_id === params[0] && e.type === 'refund') ?? null;
      }
      if (sql.includes("package_purchase_id = ? AND type = 'purchase'")) {
        return store.credit_ledger.find((e) => e.package_purchase_id === params[0] && e.type === 'purchase') ?? null;
      }
      if (sql.includes('as balance')) {
        const [clientId, now] = params;
        const balance = store.credit_ledger
          .filter((e) => e.client_id === clientId && (!e.expires_at || e.expires_at > now))
          .reduce((s, e) => s + e.amount, 0);
        return { balance };
      }
      if (sql.includes('as consumed') && sql.includes('package_purchase_id IS NULL')) {
        const consumed = -store.credit_ledger
          .filter((e) => e.client_id === params[0] && !e.package_purchase_id &&
                         ['usage', 'refund', 'admin_deduct'].includes(e.type))
          .reduce((s, e) => s + e.amount, 0);
        return { consumed };
      }
      if (sql.includes('SELECT active FROM users WHERE id')) {
        // requireAuth()'s active-status re-check — this file doesn't model a
        // users table or test deactivation, so every actor is active.
        return { active: 1 };
      }
      throw new Error(`mock first(): unhandled SQL: ${sql}`);
    },
    async all() {
      if (sql.includes('GROUP BY package_purchase_id')) {
        const byPkg = {};
        for (const e of store.credit_ledger) {
          if (e.client_id !== params[0] || !e.package_purchase_id) continue;
          if (!['usage', 'refund', 'refund_removal'].includes(e.type)) continue;
          byPkg[e.package_purchase_id] = (byPkg[e.package_purchase_id] ?? 0) - e.amount;
        }
        return { results: Object.entries(byPkg).map(([id, consumed]) => ({ package_purchase_id: id, consumed })) };
      }
      if (sql.includes("type IN ('purchase', 'admin_grant')")) {
        const [clientId, now] = params;
        const results = store.credit_ledger
          .filter((e) => e.client_id === clientId && ['purchase', 'admin_grant'].includes(e.type) &&
                         (!e.expires_at || e.expires_at > now))
          .sort((a, b) => (a.expires_at ?? '9999') < (b.expires_at ?? '9999') ? -1 : 1);
        return { results };
      }
      if (sql.includes('FROM package_purchases pp')) {
        const results = store.package_purchases
          .filter((pp) => pp.order_id === params[0] && pp.client_id === params[1])
          .map((pp) => ({ ...pp, package_name: store.package_definitions.find((d) => d.id === pp.package_definition_id)?.name ?? 'Package' }));
        return { results };
      }
      if (sql.includes("FROM credit_ledger WHERE booking_id = ? AND type = 'usage'")) {
        return { results: store.credit_ledger.filter((e) => e.booking_id === params[0] && e.type === 'usage') };
      }
      if (sql.includes('FROM bookings WHERE order_id')) {
        return { results: store.bookings.filter((b) => b.order_id === params[0]).map((b) => ({ id: b.id, player_id: b.player_id })) };
      }
      throw new Error(`mock all(): unhandled SQL: ${sql}`);
    },
    async run() {
      if (sql.includes('INSERT INTO credit_ledger')) ledgerInsert(sql, params);
      else if (sql.includes('INSERT INTO refunds')) {
        store.refunds.push({ id: params[0], payment_id: params[1], amount: params[2], stripe_refund_id: params[3],
                             reason: params[4], status: params[5], performed_by: params[6] });
      } else if (sql.includes('UPDATE payments SET status')) {
        const p = store.payments.find((x) => x.id === params[2]);
        if (p) p.status = params[0];
      } else if (sql.includes("UPDATE package_purchases SET status = 'refunded'")) {
        const pp = store.package_purchases.find((x) => x.id === params[1]);
        if (pp) pp.status = 'refunded';
      } else if (sql.includes('INSERT INTO audit_log')) {
        store.audit_log.push({ description: params[5], new_value: params[7] ? JSON.parse(params[7]) : null, reason: params[8] });
      } else {
        throw new Error(`mock run(): unhandled SQL: ${sql}`);
      }
      return { meta: {} };
    },
  };
}

function makeEnv() {
  return {
    JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef',
    STRIPE_SECRET: 'sk_test_mock',
    DB: {
      prepare(sql) { return { bind: (...params) => makeStatement(sql, params) }; },
      async batch(stmts) { for (const s of stmts) await s.run(); return []; },
    },
  };
}

// ─── Stripe fetch stub ────────────────────────────────────────────────────────
let stripeCalls;
globalThis.fetch = async (fetchUrl, opts) => {
  stripeCalls.push({ url: fetchUrl, body: opts?.body, headers: opts?.headers });
  return { ok: true, json: async () => ({ id: 're_test_1', status: 'succeeded' }) };
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const FUTURE = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();

function seedPackagePayment({ credits = 5, price = 50, used = 0, amountPaid = price } = {}) {
  resetStore();
  stripeCalls = [];
  store.package_definitions.push({ id: 'pd1', name: '5 Session Package' });
  store.package_purchases.push({ id: 'pp1', client_id: 'client-1', order_id: 'o1', package_definition_id: 'pd1',
                                 credits_granted: credits, price_paid: price, status: 'active', expires_at: FUTURE });
  store.credit_ledger.push({ id: 'l1', client_id: 'client-1', type: 'purchase', amount: credits,
                             balance_after: credits, package_purchase_id: 'pp1', expires_at: FUTURE });
  for (let i = 0; i < used; i++) {
    store.credit_ledger.push({ id: `use-${i}`, client_id: 'client-1', type: 'usage', amount: -1,
                               balance_after: credits - i - 1, booking_id: `b-${i}`, package_purchase_id: 'pp1', expires_at: FUTURE });
  }
  store.payments.push({ id: 'pay1', order_id: 'o1', client_id: 'client-1', amount: amountPaid,
                        status: 'paid', stripe_payment_intent: 'pi_1', reference: 'PAY-TEST0001' });
}

async function callRefund(env, body) {
  const token = await signJwt({ sub: 'admin-1', role: 'admin', firstName: 'Admin', lastName: 'User' }, env.JWT_SECRET);
  const request = new Request('https://ppgk.app/api/admin/payments/pay1/refund', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const res = await handleAdminPayments(request, env, {}, { id: 'pay1' });
  return { status: res.status, body: await res.json() };
}

async function callPreview(env, amountParam) {
  const token = await signJwt({ sub: 'admin-1', role: 'admin', firstName: 'Admin', lastName: 'User' }, env.JWT_SECRET);
  const q = amountParam !== undefined ? `?amount=${amountParam}` : '';
  const request = new Request(`https://ppgk.app/api/admin/payments/pay1/refund-preview${q}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const res = await handleAdminPayments(request, env, {}, { id: 'pay1' });
  return { status: res.status, body: await res.json() };
}

// ─── Test runner ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ─── Tests ────────────────────────────────────────────────────────────────────
console.log('\n── Refund credit impact ─────────────────────────────');

await test('full refund of unused package removes all credits', async () => {
  seedPackagePayment();
  const impact = await computeRefundCreditImpact(makeEnv(), { clientId: 'client-1', orderId: 'o1', refundAmount: 50 });
  assert(impact.creditsToRemove === 5, `expected 5, got ${impact.creditsToRemove}`);
  assert(!impact.blocked, 'should not be blocked');
});

await test('refund of one session value removes one credit', async () => {
  seedPackagePayment(); // €10/credit
  const impact = await computeRefundCreditImpact(makeEnv(), { clientId: 'client-1', orderId: 'o1', refundAmount: 10 });
  assert(impact.creditsToRemove === 1, `expected 1, got ${impact.creditsToRemove}`);
});

await test('refund of two sessions value removes two credits', async () => {
  seedPackagePayment();
  const impact = await computeRefundCreditImpact(makeEnv(), { clientId: 'client-1', orderId: 'o1', refundAmount: 20 });
  assert(impact.creditsToRemove === 2, `expected 2, got ${impact.creditsToRemove}`);
});

await test('blocked when refund needs more credits than remain unused', async () => {
  seedPackagePayment({ used: 4 }); // 1 unused
  const impact = await computeRefundCreditImpact(makeEnv(), { clientId: 'client-1', orderId: 'o1', refundAmount: 50 });
  assert(impact.blocked, 'should be blocked');
  assert(impact.blockedReason.includes('already used'), 'reason should explain used credits');
});

await test('order with no packages involves no credits', async () => {
  seedPackagePayment();
  store.package_purchases = []; // money-only booking order
  const impact = await computeRefundCreditImpact(makeEnv(), { clientId: 'client-1', orderId: 'o1', refundAmount: 35 });
  assert(impact.creditsToRemove === 0 && !impact.blocked, 'no credits, not blocked');
});

console.log('\n── Refund route (end-to-end with mock D1 + Stripe) ──');

await test('full refund removes credits, records refund, marks package refunded', async () => {
  seedPackagePayment();
  const { status, body } = await callRefund(makeEnv(), {});
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(body)}`);
  assert(body.creditsRemoved === 5, `expected 5 removed, got ${body.creditsRemoved}`);
  const removal = store.credit_ledger.find((e) => e.type === 'refund_removal');
  assert(removal && removal.amount === -5, 'refund_removal ledger row of -5 expected');
  assert(removal.expires_at === FUTURE, 'removal row must inherit package expiry');
  assert(store.package_purchases[0].status === 'refunded', 'package should be marked refunded');
  assert(store.payments[0].status === 'refunded', 'payment should be refunded');
  assert(store.refunds.length === 1 && store.refunds[0].stripe_refund_id === 're_test_1', 'refund row with stripe id');
  assert(stripeCalls.length === 1 && stripeCalls[0].body.includes('amount=5000'), 'Stripe called with amount in cents');
});

await test('partial refund removes proportional credits and sets partial_refund', async () => {
  seedPackagePayment();
  const { status, body } = await callRefund(makeEnv(), { amount: 10 });
  assert(status === 200, `expected 200, got ${status}`);
  assert(body.creditsRemoved === 1, `expected 1 removed, got ${body.creditsRemoved}`);
  assert(store.payments[0].status === 'partial_refund', 'payment should be partial_refund');
  assert(store.package_purchases[0].status === 'active', 'package stays active');
});

await test('refund blocked with 409 when unused credits are insufficient — Stripe never called', async () => {
  seedPackagePayment({ used: 4 });
  const { status, body } = await callRefund(makeEnv(), {});
  assert(status === 409, `expected 409, got ${status}`);
  assert(body.message.includes('Not enough unused credits'), 'clear admin-facing error expected');
  assert(stripeCalls.length === 0, 'no money must move when blocked');
  assert(!store.credit_ledger.some((e) => e.type === 'refund_removal'), 'no credits removed');
});

await test('keepCredits without admin note is rejected with 400 — Stripe never called', async () => {
  seedPackagePayment();
  const { status, body } = await callRefund(makeEnv(), { keepCredits: true });
  assert(status === 400, `expected 400, got ${status}`);
  assert(body.message.toLowerCase().includes('note'), 'error should mention the note');
  assert(stripeCalls.length === 0, 'no money must move without a note');
});

await test('keepCredits with note refunds money but keeps credits, audit captures everything', async () => {
  seedPackagePayment({ used: 4 }); // would be blocked without override
  const { status, body } = await callRefund(makeEnv(), { keepCredits: true, adminNote: 'Goodwill — coach cancelled twice' });
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(body)}`);
  assert(body.creditsKept === true && body.creditsRemoved === 0, 'credits kept, none removed');
  assert(!store.credit_ledger.some((e) => e.type === 'refund_removal'), 'ledger untouched');
  const entry = store.audit_log[0];
  assert(entry, 'audit entry expected');
  assert(entry.reason === 'Goodwill — coach cancelled twice', 'audit must store the admin note');
  assert(entry.new_value.creditsKept === true, 'audit must record creditsKept');
  assert(entry.new_value.refundAmount === 50 && entry.new_value.clientId === 'client-1', 'audit records amount + client');
  assert(entry.new_value.stripeRefundId === 're_test_1', 'audit records the Stripe refund id');
});

await test('audit entry records credits removed, client, package and refund ids', async () => {
  seedPackagePayment();
  store.bookings.push({ id: 'bk1', order_id: 'o1', player_id: 'player-9' });
  await callRefund(makeEnv(), {});
  const entry = store.audit_log[0];
  assert(entry.new_value.creditsRemoved === 5, 'audit records credits removed');
  assert(entry.new_value.packagePurchaseIds.includes('pp1'), 'audit records package purchase');
  assert(entry.new_value.playerIds.includes('player-9'), 'audit records related player');
});

await test('refund preview endpoint returns credit impact', async () => {
  seedPackagePayment();
  const { status, body } = await callPreview(makeEnv(), 20);
  assert(status === 200, `expected 200, got ${status}`);
  assert(body.creditsToRemove === 2 && body.maxRefundable === 50, `unexpected preview: ${JSON.stringify(body)}`);
});

console.log('\n── Ledger consistency after removal ─────────────────');

await test('removed credits can no longer be spent on bookings', async () => {
  seedPackagePayment();
  const env = makeEnv();
  await callRefund(env, {}); // removes all 5
  const result = await deductCredits(env, { clientId: 'client-1', bookingId: 'b-new', amount: 1 });
  assert(result.success === false, `deduction should fail, got ${JSON.stringify(result)}`);
  assert(result.error.includes('Insufficient'), 'insufficient credits error expected');
});

await test('booking-cancel refund restores spendable availability (regression)', async () => {
  seedPackagePayment({ credits: 1, price: 10 });
  const env = makeEnv();
  await deductCredits(env, { clientId: 'client-1', bookingId: 'b-x', amount: 1 });
  await refundCredits(env, { clientId: 'client-1', bookingId: 'b-x' });
  const result = await deductCredits(env, { clientId: 'client-1', bookingId: 'b-y', amount: 1 });
  assert(result.success === true && !result.skipped, `re-deduction should succeed, got ${JSON.stringify(result)}`);
});

console.log(`\n═══════════════════════════════════════════════════\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
