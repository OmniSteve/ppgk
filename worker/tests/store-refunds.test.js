/**
 * Store refund / order archive-delete / product archive-instead-of-delete tests.
 *
 * Root cause under test: POST /api/admin/store/orders/:id/refund used to only
 * write store_orders.refund_status locally and never called Stripe (see
 * worker/src/routes/admin/store/orders.js and migrations/0010_store_refunds.sql
 * for the fix + data repair). These tests mock the Stripe HTTP calls (no real
 * network access) and drive the real route handlers against a node:sqlite-
 * backed D1 shim loading the actual migration files, in order.
 *
 * Run with: node worker/tests/store-refunds.test.js
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { webcrypto } from 'node:crypto';
if (typeof crypto === 'undefined') globalThis.crypto = webcrypto;

import { signJwt } from '../src/lib/auth.js';
import { handleAdminStoreOrders } from '../src/routes/admin/store/orders.js';
import { handleAdminStoreProducts } from '../src/routes/admin/store/products.js';
import { handleStripeWebhook } from '../src/routes/webhooks/stripe.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.stack || e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');
const MIGRATION_FILES = [
  '0001_initial_schema', '0002_additions', '0003_player_emergency_relationship',
  '0004_player_performance', '0005_player_account_holder', '0006_booking_roster',
  '0007_account_lifecycle', '0008_ecommerce_store', '0009_sku_generation', '0010_store_refunds',
];
const MIGRATION_SQL = MIGRATION_FILES.map(f => readFileSync(join(MIGRATIONS_DIR, `${f}.sql`), 'utf8'));

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const sql of MIGRATION_SQL) db.exec(sql);
  return db;
}

function makeD1(db) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async all()   { return { results: db.prepare(sql).all(...params) }; },
            async first() { return db.prepare(sql).get(...params) ?? null; },
            async run()   {
              const info = db.prepare(sql).run(...params);
              return { meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
            },
          };
        },
      };
    },
    async batch(prepared) {
      db.exec('BEGIN');
      try {
        const results = [];
        for (const stmt of prepared) results.push(await stmt.run());
        db.exec('COMMIT');
        return results;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

function makeEnv(db) {
  return { JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef', APP_URL: 'https://ppgk.app', STRIPE_SECRET: 'sk_test_mock', DB: makeD1(db) };
}

let seq = 0;
function seedAdmin(db) {
  const id = `admin-${++seq}`;
  db.prepare(`INSERT INTO users (id, email, password_hash, first_name, last_name, role, active, email_verified)
              VALUES (?, ?, 'pbkdf2:x:y', 'Ad', 'Min', 'admin', 1, 1)`).run(id, `${id}@example.com`);
  return id;
}

async function adminToken(env, db) {
  const id = seedAdmin(db);
  return signJwt({ sub: id, role: 'admin', firstName: 'Ad', lastName: 'Min', email: 'a@example.com' }, env.JWT_SECRET);
}

function req(method, path, { token, body } = {}) {
  return new Request(`https://ppgk.app${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// ─── Stripe fetch stub — routes by URL, records calls for assertions ─────────
let stripeCalls;
let stripeRefundStatus = 'succeeded';
let stripeSessionPaymentIntent = null;
globalThis.fetch = async (url, opts) => {
  stripeCalls.push({ url: String(url), body: opts?.body, headers: opts?.headers });
  if (String(url).includes('/v1/refunds')) {
    const params = new URLSearchParams(opts.body);
    return {
      ok: true,
      json: async () => ({ id: `re_test_${stripeCalls.length}`, status: stripeRefundStatus, amount: Number(params.get('amount')), payment_intent: params.get('payment_intent') }),
    };
  }
  if (String(url).includes('/v1/checkout/sessions/')) {
    return { ok: true, json: async () => ({ id: 'cs_test_1', payment_intent: stripeSessionPaymentIntent }) };
  }
  return { ok: false, json: async () => ({ error: { message: 'unhandled stub URL' } }) };
};

function seedPaidOrder(db, overrides = {}) {
  const id = crypto.randomUUID();
  const opts = {
    orderNumber: 'SO-2000', total: 40, subtotal: 35, deliveryFee: 5, taxAmount: 0,
    paymentIntent: 'pi_test_1', sessionId: 'cs_test_1', fulfilmentStatus: 'pending', isTestOrder: 0, ...overrides,
  };
  db.prepare(`INSERT INTO store_orders (
      id, order_number, customer_name, customer_email, customer_phone, delivery_method,
      subtotal, delivery_fee, tax_amount, total, payment_status, fulfilment_status,
      stripe_session_id, stripe_payment_intent, is_test_order
    ) VALUES (?, ?, 'Test Customer', 't@example.com', '35512345', 'collection', ?, ?, ?, ?, 'paid', ?, ?, ?, ?)`)
    .run(id, opts.orderNumber, opts.subtotal, opts.deliveryFee, opts.taxAmount, opts.total, opts.fulfilmentStatus, opts.sessionId, opts.paymentIntent, opts.isTestOrder);

  const itemId = crypto.randomUUID();
  db.prepare(`INSERT INTO store_order_items (id, order_id, product_name_snapshot, unit_price, quantity, line_total)
              VALUES (?, ?, 'Test Product', 35, 1, 35)`).run(itemId, id);
  return id;
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Root-cause reproduction & migration data repair ─────────────');

await test('migration 0010 resets bad refund_status left by the old record-only refund action', async () => {
  const db = makeDb();
  const orderId = crypto.randomUUID();
  // Simulate the OLD buggy behaviour directly (pre-0010 shape) then verify a
  // fresh migration run leaves no order in that bad state — mirrors SO-1000.
  db.prepare(`INSERT INTO store_orders (id, order_number, customer_name, customer_email, customer_phone, delivery_method, subtotal, delivery_fee, tax_amount, total, payment_status, fulfilment_status, refund_status, refund_amount, refunded_at)
              VALUES (?, 'SO-9999', 'X', 'x@example.com', '1', 'collection', 40, 0, 0, 40, 'paid', 'cancelled', 'full', 40, '2026-01-01T00:00:00Z')`).run(orderId);
  // Re-apply the repair statements from 0010 manually is redundant here since
  // makeDb() already ran 0010 before this row existed; instead assert the
  // migration's repair logic by re-running its SQL against this new bad row.
  const sql010 = MIGRATION_SQL[MIGRATION_SQL.length - 1];
  const repairStatements = sql010.split(/;\s*\n/).filter(s => /UPDATE store_orders SET refund_status/.test(s) || /INSERT INTO store_order_status_history/.test(s));
  for (const s of repairStatements) db.exec(s + ';');
  const row = db.prepare('SELECT refund_status, refund_amount, refunded_at FROM store_orders WHERE id = ?').get(orderId);
  assertEqual(row.refund_status, null, 'refund_status must be reset');
  assertEqual(row.refund_amount, null, 'refund_amount must be reset');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Real Stripe refund flow ──────────────────────────────────────');

await test('full refund calls the Stripe Refund API and records a succeeded store_refunds row', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db);
  stripeCalls = []; stripeRefundStatus = 'succeeded';

  const res = await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/refund`, { token, body: { reason: 'requested_by_customer' } }), env, {}, { id: orderId });
  const body = await res.json();
  assertEqual(res.status, 200, JSON.stringify(body));
  assert(body.success === true, 'response must report success');
  assertEqual(body.refunded_amount, 40);
  assertEqual(body.remaining_refundable_amount, 0);
  assert(stripeCalls.some(c => c.url.includes('/v1/refunds')), 'must call the real Stripe refund API');

  const refundRow = db.prepare('SELECT * FROM store_refunds WHERE order_id = ?').get(orderId);
  assert(refundRow, 'a store_refunds row must exist');
  assertEqual(refundRow.status, 'succeeded');
  assertEqual(refundRow.amount_cents, 4000);

  const order = db.prepare('SELECT amount_refunded_cents FROM store_orders WHERE id = ?').get(orderId);
  assertEqual(order.amount_refunded_cents, 4000);
});

await test('partial refund computes remaining refundable correctly and rejects over-refund', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db);
  stripeCalls = []; stripeRefundStatus = 'succeeded';

  const res1 = await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/refund`, { token, body: { amount: 15 } }), env, {}, { id: orderId });
  const body1 = await res1.json();
  assertEqual(res1.status, 200);
  assertEqual(body1.remaining_refundable_amount, 25);

  const resOver = await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/refund`, { token, body: { amount: 999 } }), env, {}, { id: orderId });
  assertEqual(resOver.status, 400, 'must reject a refund amount above what remains refundable');
});

await test('a fully-refunded order cannot be refunded again', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db);
  stripeCalls = []; stripeRefundStatus = 'succeeded';

  await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/refund`, { token, body: {} }), env, {}, { id: orderId });
  const res2 = await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/refund`, { token, body: { amount: 1 } }), env, {}, { id: orderId });
  assertEqual(res2.status, 409, 'a second refund attempt on a fully-refunded order must be rejected');
});

await test('PaymentIntent is resolved from the Checkout Session when not already stored', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db, { paymentIntent: null });
  stripeCalls = []; stripeRefundStatus = 'succeeded'; stripeSessionPaymentIntent = 'pi_resolved_1';

  const res = await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/refund`, { token, body: {} }), env, {}, { id: orderId });
  assertEqual(res.status, 200);
  assert(stripeCalls.some(c => c.url.includes('/v1/checkout/sessions/')), 'must look up the Checkout Session to resolve a PaymentIntent');
  const order = db.prepare('SELECT stripe_payment_intent FROM store_orders WHERE id = ?').get(orderId);
  assertEqual(order.stripe_payment_intent, 'pi_resolved_1', 'the resolved PaymentIntent must be persisted');
});

await test('a failed Stripe refund returns 502 and writes nothing locally', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: { message: 'card_declined' } }) });
  try {
    const res = await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/refund`, { token, body: {} }), env, {}, { id: orderId });
    assertEqual(res.status, 502);
    const refundRow = db.prepare('SELECT * FROM store_refunds WHERE order_id = ?').get(orderId);
    assert(!refundRow, 'no store_refunds row should exist after a failed Stripe call');
  } finally { globalThis.fetch = originalFetch; }
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Inventory restoration ────────────────────────────────────────');

await test('full refund with restoreInventory=true restores the order line item stock', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db);
  const { body: product } = await (async () => {
    const res = await handleAdminStoreProducts(req('POST', '/api/admin/store/products', { token, body: { name: 'Restock Gloves', basePrice: 35, status: 'active', stockQty: 3 } }), env, {}, {});
    return { body: await res.json() };
  })();
  db.prepare('UPDATE store_order_items SET product_id = ? WHERE order_id = ?').run(product.id, orderId);

  stripeCalls = []; stripeRefundStatus = 'succeeded';
  const res = await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/refund`, { token, body: { restoreInventory: true } }), env, {}, { id: orderId });
  assertEqual(res.status, 200);

  const restocked = db.prepare('SELECT stock_qty FROM store_products WHERE id = ?').get(product.id);
  assertEqual(restocked.stock_qty, 4, 'stock should increase by the refunded item quantity (1)');
  const adjustment = db.prepare("SELECT * FROM store_inventory_adjustments WHERE product_id = ? AND reason = 'refund_restock'").get(product.id);
  assert(adjustment, 'a refund_restock inventory adjustment row must be written');
});

await test('partial refund with no restoreItems selected does not touch stock', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db);
  const res = await (async () => {
    const r = await handleAdminStoreProducts(req('POST', '/api/admin/store/products', { token, body: { name: 'No Restock', basePrice: 35, status: 'active', stockQty: 3 } }), env, {}, {});
    return r.json();
  })();
  db.prepare('UPDATE store_order_items SET product_id = ? WHERE order_id = ?').run(res.id, orderId);

  stripeCalls = []; stripeRefundStatus = 'succeeded';
  await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/refund`, { token, body: { amount: 10 } }), env, {}, { id: orderId });
  const product = db.prepare('SELECT stock_qty FROM store_products WHERE id = ?').get(res.id);
  assertEqual(product.stock_qty, 3, 'stock must be unchanged when restoreInventory was not requested');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Webhook idempotency (dashboard-issued refunds) ───────────────');

async function signStripeEvent(secret, rawBody) {
  const timestamp = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  const hex = Array.from(new Uint8Array(signed)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `t=${timestamp},v1=${hex}`;
}

async function sendWebhook(env, event) {
  const rawBody = JSON.stringify(event);
  const signature = await signStripeEvent(env.STRIPE_WEBHOOK_SECRET, rawBody);
  const request = new Request('https://ppgk.app/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: rawBody,
  });
  return handleStripeWebhook(request, env);
}

await test('refund.created webhook (dashboard-issued refund) reconciles into store_refunds and updates the order total', async () => {
  const db = makeDb(); const env = makeEnv(db);
  env.STRIPE_WEBHOOK_SECRET = 'whsec_test_0123456789abcdef';
  const orderId = seedPaidOrder(db, { paymentIntent: 'pi_webhook_1' });

  const res = await sendWebhook(env, {
    id: 'evt_1', type: 'refund.created',
    data: { object: { object: 'refund', id: 're_webhook_1', payment_intent: 'pi_webhook_1', amount: 4000, status: 'succeeded', currency: 'eur' } },
  });
  assertEqual(res.status, 200);

  const refundRow = db.prepare('SELECT * FROM store_refunds WHERE stripe_refund_id = ?').get('re_webhook_1');
  assert(refundRow, 'a dashboard-issued refund must be reconciled into store_refunds even though it was never created through the admin endpoint');
  assertEqual(refundRow.status, 'succeeded');
  const order = db.prepare('SELECT amount_refunded_cents FROM store_orders WHERE id = ?').get(orderId);
  assertEqual(order.amount_refunded_cents, 4000);
});

await test('a re-delivered webhook event (same event id) is skipped and does not double-process', async () => {
  const db = makeDb(); const env = makeEnv(db);
  env.STRIPE_WEBHOOK_SECRET = 'whsec_test_0123456789abcdef';
  const orderId = seedPaidOrder(db, { paymentIntent: 'pi_webhook_2' });
  const event = {
    id: 'evt_2', type: 'refund.created',
    data: { object: { object: 'refund', id: 're_webhook_2', payment_intent: 'pi_webhook_2', amount: 4000, status: 'succeeded', currency: 'eur' } },
  };

  await sendWebhook(env, event);
  const res2 = await sendWebhook(env, event);
  const body2 = await res2.json();
  assertEqual(body2.skipped, true, 'a re-delivered event id must be skipped');

  const count = db.prepare('SELECT COUNT(*) as c FROM store_refunds WHERE stripe_refund_id = ?').get('re_webhook_2');
  assertEqual(count.c, 1, 'redelivery must not create a duplicate refund row');
});

await test('refund status update (pending -> succeeded via refund.updated) is reflected without duplicating the row', async () => {
  const db = makeDb(); const env = makeEnv(db);
  env.STRIPE_WEBHOOK_SECRET = 'whsec_test_0123456789abcdef';
  const orderId = seedPaidOrder(db, { paymentIntent: 'pi_webhook_3' });

  await sendWebhook(env, {
    id: 'evt_3a', type: 'refund.created',
    data: { object: { object: 'refund', id: 're_webhook_3', payment_intent: 'pi_webhook_3', amount: 4000, status: 'pending', currency: 'eur' } },
  });
  let order = db.prepare('SELECT amount_refunded_cents FROM store_orders WHERE id = ?').get(orderId);
  assertEqual(order.amount_refunded_cents, 0, 'a pending refund must not yet count as refunded');

  await sendWebhook(env, {
    id: 'evt_3b', type: 'refund.updated',
    data: { object: { object: 'refund', id: 're_webhook_3', payment_intent: 'pi_webhook_3', amount: 4000, status: 'succeeded', currency: 'eur' } },
  });
  order = db.prepare('SELECT amount_refunded_cents FROM store_orders WHERE id = ?').get(orderId);
  assertEqual(order.amount_refunded_cents, 4000, 'once succeeded, the refund must count toward amount_refunded_cents');

  const count = db.prepare('SELECT COUNT(*) as c FROM store_refunds WHERE stripe_refund_id = ?').get('re_webhook_3');
  assertEqual(count.c, 1, 'the same stripe_refund_id must update one row, not create a second');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Archive / restore ─────────────────────────────────────────────');

await test('archiving an order hides it from the default list but preserves all data', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db);

  const archiveRes = await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/archive`, { token, body: {} }), env, {}, { id: orderId });
  assertEqual(archiveRes.status, 200);

  const listRes = await handleAdminStoreOrders(req('GET', '/api/admin/store/orders', { token }), env, {}, {});
  const listBody = await listRes.json();
  assert(!listBody.orders.some(o => o.id === orderId), 'archived order must not appear in the default list');

  const allRes = await handleAdminStoreOrders(req('GET', '/api/admin/store/orders?archived=all', { token }), env, {}, {});
  const allBody = await allRes.json();
  assert(allBody.orders.some(o => o.id === orderId), 'archived order must still appear with archived=all');

  const detail = db.prepare('SELECT total FROM store_orders WHERE id = ?').get(orderId);
  assertEqual(detail.total, 40, 'order data must be fully preserved after archiving');
});

await test('restoring an archived order returns it to the default list', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db);
  await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/archive`, { token, body: {} }), env, {}, { id: orderId });
  const restoreRes = await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/restore`, { token, body: {} }), env, {}, { id: orderId });
  assertEqual(restoreRes.status, 200);
  const row = db.prepare('SELECT archived_at FROM store_orders WHERE id = ?').get(orderId);
  assertEqual(row.archived_at, null);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Hard delete eligibility ───────────────────────────────────────');

await test('a paid, non-test order cannot be hard-deleted', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db);
  const res = await handleAdminStoreOrders(req('DELETE', `/api/admin/store/orders/${orderId}`, { token, body: { confirm: 'DELETE' } }), env, {}, { id: orderId });
  assertEqual(res.status, 409, 'a paid order without is_test_order must never be hard-deletable');
});

await test('a dispatched order cannot be hard-deleted even if flagged as a test order', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db, { fulfilmentStatus: 'dispatched', isTestOrder: 1, paymentIntent: null, sessionId: null });
  db.prepare("UPDATE store_orders SET payment_status = 'pending' WHERE id = ?").run(orderId);
  const res = await handleAdminStoreOrders(req('DELETE', `/api/admin/store/orders/${orderId}`, { token, body: { confirm: 'DELETE' } }), env, {}, { id: orderId });
  assertEqual(res.status, 409, 'fulfilment history must block hard delete regardless of the test-order flag');
});

await test('a fully-refunded, flagged test order can be hard-deleted', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db, { isTestOrder: 1 });
  stripeCalls = []; stripeRefundStatus = 'succeeded';
  await handleAdminStoreOrders(req('POST', `/api/admin/store/orders/${orderId}/refund`, { token, body: {} }), env, {}, { id: orderId });

  const res = await handleAdminStoreOrders(req('DELETE', `/api/admin/store/orders/${orderId}`, { token, body: { confirm: 'DELETE' } }), env, {}, { id: orderId });
  assertEqual(res.status, 200, 'a fully-refunded flagged test order must be deletable');
  const row = db.prepare('SELECT id FROM store_orders WHERE id = ?').get(orderId);
  assert(!row, 'order row must be gone');
});

await test('an unpaid, flagged test order can be hard-deleted without any refund', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const orderId = seedPaidOrder(db, { isTestOrder: 1 });
  db.prepare("UPDATE store_orders SET payment_status = 'pending' WHERE id = ?").run(orderId);
  const res = await handleAdminStoreOrders(req('DELETE', `/api/admin/store/orders/${orderId}`, { token, body: { confirm: 'DELETE' } }), env, {}, { id: orderId });
  assertEqual(res.status, 200);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Product archive-instead-of-delete (already-correct behaviour, confirmed) ─');

await test('a product referenced by an order cannot be hard-deleted but can be archived', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const createRes = await handleAdminStoreProducts(req('POST', '/api/admin/store/products', { token, body: { name: 'Linked Product', basePrice: 20, status: 'active' } }), env, {}, {});
  const product = await createRes.json();

  const orderId = seedPaidOrder(db);
  db.prepare('UPDATE store_order_items SET product_id = ? WHERE order_id = ?').run(product.id, orderId);

  const deleteRes = await handleAdminStoreProducts(req('DELETE', `/api/admin/store/products/${product.id}`, { token, body: { confirm: 'DELETE' } }), env, {}, { id: product.id });
  assertEqual(deleteRes.status, 409, 'a product referenced by an order must not be hard-deletable');

  const archiveRes = await handleAdminStoreProducts(req('PATCH', `/api/admin/store/products/${product.id}`, { token, body: { status: 'archived' } }), env, {}, { id: product.id });
  assertEqual(archiveRes.status, 200, 'archiving the same product must succeed');

  const orderItem = db.prepare('SELECT product_name_snapshot FROM store_order_items WHERE order_id = ?').get(orderId);
  assertEqual(orderItem.product_name_snapshot, 'Test Product', 'order item snapshot must remain valid after the live product is archived');
});

await test('an unreferenced product can still be permanently deleted', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const createRes = await handleAdminStoreProducts(req('POST', '/api/admin/store/products', { token, body: { name: 'Unlinked Product', basePrice: 20, status: 'active' } }), env, {}, {});
  const product = await createRes.json();
  const deleteRes = await handleAdminStoreProducts(req('DELETE', `/api/admin/store/products/${product.id}`, { token, body: { confirm: 'DELETE' } }), env, {}, { id: product.id });
  assertEqual(deleteRes.status, 200);
});

// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
