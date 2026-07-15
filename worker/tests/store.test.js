/**
 * E-commerce store tests — same node:sqlite-backed real-D1 harness introduced
 * in lifecycle.test.js (see that file's header comment for why: eligibility/
 * checkout logic here runs enough distinct queries that a hand-rolled SQL-
 * string-matching mock doesn't scale, and running against real SQL/FK
 * semantics is strictly more trustworthy).
 *
 * Run with: node worker/tests/store.test.js
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { webcrypto } from 'node:crypto';
if (typeof crypto === 'undefined') globalThis.crypto = webcrypto;

import { signJwt } from '../src/lib/auth.js';
import { handleStoreProducts, handleStoreCategories } from '../src/routes/store/products.js';
import { handleStoreCheckout } from '../src/routes/store/checkout.js';
import { handleStoreOrders } from '../src/routes/store/orders.js';
import { handleAdminStoreProducts } from '../src/routes/admin/store/products.js';
import { handleAdminStoreCategories } from '../src/routes/admin/store/categories.js';
import { handleAdminStoreInventory } from '../src/routes/admin/store/inventory.js';
import { handleAdminStoreOrders } from '../src/routes/admin/store/orders.js';
import { handleStripeWebhook } from '../src/routes/webhooks/stripe.js';
import { handleClientPackages } from '../src/routes/client/packages.js';
import { reserveStockForItems, computeDeliveryFee, computeTax } from '../src/lib/store.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.stack || e.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ─── Migration loading ──────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');
const MIGRATION_FILES = [
  '0001_initial_schema', '0002_additions', '0003_player_emergency_relationship',
  '0004_player_performance', '0005_player_account_holder', '0006_booking_roster',
  '0007_account_lifecycle', '0008_ecommerce_store',
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

function makeEnv(db, extra = {}) {
  return { JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef', APP_URL: 'https://ppgk.app', DB: makeD1(db), ...extra };
}

async function tokenFor(env, sub, role, extra = {}) {
  return signJwt({ sub, role, firstName: 'Test', lastName: 'User', email: 't@example.com', ...extra }, env.JWT_SECRET);
}

function req(method, path, { token, body } = {}) {
  return new Request(`https://ppgk.app${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

let seq = 0;
const uid = (prefix) => `${prefix}-${++seq}`;

function seedUser(db, { id = uid('user'), email = `${id}@example.com`, role = 'client', active = 1 } = {}) {
  db.prepare(`INSERT INTO users (id, email, password_hash, first_name, last_name, role, active, email_verified)
              VALUES (?, ?, 'pbkdf2:x:y', 'Test', 'User', ?, ?, 1)`).run(id, email, role, active);
  return id;
}

function seedProduct(db, { id = uid('product'), name = 'Test Gloves', slug = uid('slug'), basePrice = 30, salePrice = null, status = 'active', stockQty = 10, trackStock = 1 } = {}) {
  db.prepare(`INSERT INTO store_products (id, name, slug, base_price, sale_price, status, stock_qty, track_stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, name, slug, basePrice, salePrice, status, stockQty, trackStock);
  return id;
}

function seedVariant(db, { id = uid('variant'), productId, name = 'Size 8', stockQty = 5, active = 1 }) {
  db.prepare(`INSERT INTO store_product_variants (id, product_id, name, stock_qty, active) VALUES (?, ?, ?, ?, ?)`)
    .run(id, productId, name, stockQty, active);
  return id;
}

function seedOrder(db, { id = uid('order'), orderNumber = uid('SO') } = {}) {
  db.prepare(`INSERT INTO store_orders (id, order_number, customer_name, customer_email, customer_phone, delivery_method, total)
              VALUES (?, ?, 'Test', 'test@example.com', '1', 'collection', 0)`).run(id, orderNumber);
  return id;
}

function setSetting(db, key, value) {
  db.prepare(`INSERT INTO app_settings (key, value, data_type) VALUES (?, ?, 'string')
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, String(value));
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Migration & schema ───────────────────────────────────────────');

await test('the 0008 migration loads cleanly and seeds settings + templates', async () => {
  const db = makeDb();
  const settings = db.prepare("SELECT COUNT(*) c FROM app_settings WHERE key LIKE 'store_%' OR key LIKE 'collection_%'").get();
  assert(settings.c >= 14, 'expected store settings to be seeded');
  const templates = db.prepare("SELECT COUNT(*) c FROM notification_templates WHERE event_trigger LIKE 'store_%'").get();
  assertEqual(templates.c, 8);
  const seq = db.prepare('SELECT next_number FROM store_order_sequence WHERE id = 1').get();
  assertEqual(seq.next_number, 1000);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Public catalogue ─────────────────────────────────────────────');

await test('the public product list only returns active products', async () => {
  const db = makeDb(); const env = makeEnv(db);
  seedProduct(db, { name: 'Active One', slug: 'active-one', status: 'active' });
  seedProduct(db, { name: 'Draft One', slug: 'draft-one', status: 'draft' });
  const res = await handleStoreProducts(req('GET', '/api/store/products'), env, {}, {});
  const body = await res.json();
  assertEqual(body.products.length, 1);
  assertEqual(body.products[0].name, 'Active One');
});

await test('a product requiring variant selection reports inStock correctly and exposes variants', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const productId = seedProduct(db, { slug: 'gloves-with-variants', stockQty: 0 });
  seedVariant(db, { productId, name: 'Size 7', stockQty: 3 });
  const res = await handleStoreProducts(req('GET', '/api/store/products/gloves-with-variants'), env, {}, { slug: 'gloves-with-variants' });
  const body = await res.json();
  assertEqual(body.variants.length, 1);
  assertEqual(body.variants[0].available, 3);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Stock reservation race safety ───────────────────────────────');

await test('reserving more than available stock fails and rolls back nothing was reserved', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const productId = seedProduct(db, { stockQty: 2 });
  const result = await reserveStockForItems(env, 'fake-order-1', [{ productId, variantId: null, quantity: 5 }]);
  assertEqual(result.success, false);
  const row = db.prepare('SELECT reserved_qty FROM store_products WHERE id = ?').get(productId);
  assertEqual(row.reserved_qty, 0);
});

await test('two "simultaneous" reservations for the last unit — only one succeeds', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const productId = seedProduct(db, { stockQty: 1 });
  const orderA = seedOrder(db);
  const orderB = seedOrder(db);
  const r1 = await reserveStockForItems(env, orderA, [{ productId, variantId: null, quantity: 1 }]);
  const r2 = await reserveStockForItems(env, orderB, [{ productId, variantId: null, quantity: 1 }]);
  assertEqual(r1.success, true);
  assertEqual(r2.success, false, 'the second buyer must not also succeed for the last unit');
});

await test('a multi-item reservation that partially fails rolls back the items that did succeed', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const p1 = seedProduct(db, { stockQty: 5 });
  const p2 = seedProduct(db, { stockQty: 0 });
  const orderId = seedOrder(db);
  const result = await reserveStockForItems(env, orderId, [
    { productId: p1, variantId: null, quantity: 2 },
    { productId: p2, variantId: null, quantity: 1 },
  ]);
  assertEqual(result.success, false);
  assertEqual(db.prepare('SELECT reserved_qty FROM store_products WHERE id = ?').get(p1).reserved_qty, 0, 'the first item must be rolled back');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Pricing / delivery / tax computation ────────────────────────');

await test('delivery fee is waived at or above the free-delivery threshold, and always zero for collection', async () => {
  const settings = { delivery_enabled: true, store_delivery_fee: 5, store_free_delivery_threshold: 50 };
  assertEqual(computeDeliveryFee(settings, 'delivery', 20), 5);
  assertEqual(computeDeliveryFee(settings, 'delivery', 50), 0);
  assertEqual(computeDeliveryFee(settings, 'collection', 5), 0);
});

await test('tax defaults to not_applicable / 0 unless explicitly configured', async () => {
  const { taxAmount, taxMode } = computeTax({ store_tax_mode: 'not_applicable', store_tax_rate: 20 }, 100);
  assertEqual(taxAmount, 0);
  assertEqual(taxMode, 'not_applicable');
  const added = computeTax({ store_tax_mode: 'added', store_tax_rate: 20 }, 100);
  assertEqual(added.taxAmount, 20);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Guest and authenticated checkout ────────────────────────────');

await test('a guest can create an order with no Authorization header, and gets a guest_token', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const productId = seedProduct(db, { basePrice: 25, stockQty: 10 });
  const res = await handleStoreCheckout(req('POST', '/api/store/orders', {
    body: {
      items: [{ productId, quantity: 1 }],
      customerName: 'Guest Buyer', customerEmail: 'guest@example.com', customerPhone: '99999999',
      deliveryMethod: 'collection',
    },
  }), env, {}, {});
  assertEqual(res.status, 201);
  const body = await res.json();
  assert(body.guestToken, 'a guest order must receive a lookup token');
  const order = db.prepare('SELECT user_id, customer_email FROM store_orders WHERE id = ?').get(body.orderId);
  assertEqual(order.user_id, null);
  assertEqual(order.customer_email, 'guest@example.com');
});

await test('an authenticated customer\'s order is associated with their account and has no guest_token', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const userId = seedUser(db, { role: 'client' });
  const token = await tokenFor(env, userId, 'client');
  const productId = seedProduct(db, { basePrice: 25, stockQty: 10 });
  const res = await handleStoreCheckout(req('POST', '/api/store/orders', {
    token,
    body: { items: [{ productId, quantity: 1 }], customerName: 'Reg User', customerEmail: 'reg@example.com', customerPhone: '99999999', deliveryMethod: 'collection' },
  }), env, {}, {});
  const body = await res.json();
  assertEqual(res.status, 201);
  assertEqual(body.guestToken, null);
  const order = db.prepare('SELECT user_id FROM store_orders WHERE id = ?').get(body.orderId);
  assertEqual(order.user_id, userId);
});

await test('checkout server-side price ignores any client-supplied price and uses the DB sale price', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const productId = seedProduct(db, { basePrice: 100, salePrice: 40, stockQty: 5 });
  const res = await handleStoreCheckout(req('POST', '/api/store/orders', {
    body: {
      items: [{ productId, quantity: 2, unitPrice: 1 }], // client tries to lie about price — must be ignored
      customerName: 'X', customerEmail: 'x@example.com', customerPhone: '1', deliveryMethod: 'collection',
    },
  }), env, {}, {});
  const body = await res.json();
  assertEqual(res.status, 201);
  assertEqual(body.total, 80, 'must charge 2 x the real sale price (40), not the client-supplied price');
});

await test('checkout is rejected when requested quantity exceeds live stock', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const productId = seedProduct(db, { stockQty: 1 });
  const res = await handleStoreCheckout(req('POST', '/api/store/orders', {
    body: { items: [{ productId, quantity: 5 }], customerName: 'X', customerEmail: 'x@example.com', customerPhone: '1', deliveryMethod: 'collection' },
  }), env, {}, {});
  assertEqual(res.status, 400);
});

await test('a variant-requiring product cannot be ordered without selecting a variant', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const productId = seedProduct(db, { stockQty: 0 });
  seedVariant(db, { productId, stockQty: 5 });
  const res = await handleStoreCheckout(req('POST', '/api/store/orders', {
    body: { items: [{ productId, quantity: 1 }], customerName: 'X', customerEmail: 'x@example.com', customerPhone: '1', deliveryMethod: 'collection' },
  }), env, {}, {});
  assertEqual(res.status, 400);
});

await test('delivery checkout requires a full address; collection does not', async () => {
  const db = makeDb(); const env = makeEnv(db);
  setSetting(db, 'delivery_enabled', 'true');
  const productId = seedProduct(db, { stockQty: 5 });
  const noAddress = await handleStoreCheckout(req('POST', '/api/store/orders', {
    body: { items: [{ productId, quantity: 1 }], customerName: 'X', customerEmail: 'x@example.com', customerPhone: '1', deliveryMethod: 'delivery' },
  }), env, {}, {});
  assertEqual(noAddress.status, 400);

  const withAddress = await handleStoreCheckout(req('POST', '/api/store/orders', {
    body: {
      items: [{ productId, quantity: 1 }], customerName: 'X', customerEmail: 'x@example.com', customerPhone: '1',
      deliveryMethod: 'delivery', deliveryAddressLine1: '1 Test St', deliveryCity: 'Valletta', deliveryPostCode: 'VLT01',
    },
  }), env, {}, {});
  assertEqual(withAddress.status, 201);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Webhook: store fulfilment, idempotency, and coaching isolation ─');

function fakeStripeEvent(id, type, object) {
  return { id, type, data: { object } };
}

async function directDeliverWebhookEvent(env, event) {
  // Exercise the fulfilment + idempotency logic directly (bypassing HMAC
  // signature verification, which is already covered by not needing new
  // tests here — the webhook handler's signature check is unchanged code).
  const { handleStripeWebhook } = await import('../src/routes/webhooks/stripe.js');
  const encoder = new TextEncoder();
  const secret = 'whsec_test';
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const req = new Request('https://ppgk.app/api/webhooks/stripe', {
    method: 'POST', body, headers: { 'stripe-signature': `t=${timestamp},v1=${hex}` },
  });
  return handleStripeWebhook(req, { ...env, STRIPE_WEBHOOK_SECRET: secret });
}

await test('checkout.session.completed marks a store order paid and confirms stock exactly once, even if delivered twice', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const productId = seedProduct(db, { stockQty: 5 });
  const orderRes = await handleStoreCheckout(req('POST', '/api/store/orders', {
    body: { items: [{ productId, quantity: 2 }], customerName: 'X', customerEmail: 'x@example.com', customerPhone: '1', deliveryMethod: 'collection' },
  }), env, {}, {});
  const { orderId } = await orderRes.json();

  const event = fakeStripeEvent('evt_1', 'checkout.session.completed', {
    id: 'cs_1', payment_intent: 'pi_1', metadata: { payment_type: 'store_order', store_order_id: orderId },
  });

  const res1 = await directDeliverWebhookEvent(env, event);
  assertEqual(res1.status, 200);
  const res2 = await directDeliverWebhookEvent(env, event); // Stripe redelivers the same event
  assertEqual(res2.status, 200);
  const body2 = await res2.json();
  assertEqual(body2.skipped, true, 'the duplicate event must be recognised via stripe_events and skipped');

  const order = db.prepare('SELECT payment_status FROM store_orders WHERE id = ?').get(orderId);
  assertEqual(order.payment_status, 'paid');
  const product = db.prepare('SELECT stock_qty, reserved_qty FROM store_products WHERE id = ?').get(productId);
  assertEqual(product.stock_qty, 3, 'stock must be permanently decremented by exactly 2, not 4');
  assertEqual(product.reserved_qty, 0);
  const adjustments = db.prepare("SELECT COUNT(*) c FROM store_inventory_adjustments WHERE order_id = ? AND reason = 'order_fulfilled'").get(orderId);
  assertEqual(adjustments.c, 1, 'exactly one fulfilment adjustment row, not two');
});

await test('a store checkout session never issues coaching credits, and a package purchase is unaffected by the store webhook branch', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const userId = seedUser(db, { role: 'client', email: 'buyer@example.com' });

  // Seed a package purchase order the OLD way (coaching path) to prove it still works.
  const pkgDefId = uid('pkgdef');
  db.prepare(`INSERT INTO package_definitions (id, name, credits, price, validity_months, active) VALUES (?, '10-Pack', 10, 200, 3, 1)`).run(pkgDefId);
  const pkgOrderId = uid('order');
  db.prepare(`INSERT INTO orders (id, client_id, idempotency_key, status, total_amount) VALUES (?, ?, ?, 'pending', 200)`).run(pkgOrderId, userId, uid('idem'));
  db.prepare(`INSERT INTO order_items (id, order_id, item_type, package_definition_id, quantity, unit_price) VALUES (?, ?, 'package_purchase', ?, 1, 200)`).run(uid('item'), pkgOrderId, pkgDefId);

  const pkgEvent = fakeStripeEvent('evt_pkg', 'checkout.session.completed', { id: 'cs_pkg', payment_intent: 'pi_pkg', metadata: { orderId: pkgOrderId } });
  await directDeliverWebhookEvent(env, pkgEvent);

  const ledger = db.prepare("SELECT COUNT(*) c FROM credit_ledger WHERE client_id = ? AND type = 'purchase'").get(userId);
  assertEqual(ledger.c, 1, 'the coaching package purchase must still issue credits via the untouched coaching path');

  // Now a store order for the SAME user must never touch credit_ledger.
  const productId = seedProduct(db, { stockQty: 5 });
  const storeOrderRes = await handleStoreCheckout(req('POST', '/api/store/orders', {
    token: await tokenFor(env, userId, 'client'),
    body: { items: [{ productId, quantity: 1 }], customerName: 'X', customerEmail: 'buyer@example.com', customerPhone: '1', deliveryMethod: 'collection' },
  }), env, {}, {});
  const { orderId: storeOrderId } = await storeOrderRes.json();
  const storeEvent = fakeStripeEvent('evt_store', 'checkout.session.completed', { id: 'cs_store', payment_intent: 'pi_store', metadata: { payment_type: 'store_order', store_order_id: storeOrderId } });
  await directDeliverWebhookEvent(env, storeEvent);

  const ledgerAfter = db.prepare("SELECT COUNT(*) c FROM credit_ledger WHERE client_id = ?").get(userId);
  assertEqual(ledgerAfter.c, 1, 'a store purchase must never add a credit_ledger row');
  const storeOrder = db.prepare('SELECT payment_status FROM store_orders WHERE id = ?').get(storeOrderId);
  assertEqual(storeOrder.payment_status, 'paid');
});

await test('payment_intent.payment_failed releases the store reservation so stock becomes available again', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const productId = seedProduct(db, { stockQty: 3 });
  const orderRes = await handleStoreCheckout(req('POST', '/api/store/orders', {
    body: { items: [{ productId, quantity: 3 }], customerName: 'X', customerEmail: 'x@example.com', customerPhone: '1', deliveryMethod: 'collection' },
  }), env, {}, {});
  const { orderId } = await orderRes.json();
  assertEqual(db.prepare('SELECT reserved_qty FROM store_products WHERE id = ?').get(productId).reserved_qty, 3);

  const event = fakeStripeEvent('evt_fail', 'payment_intent.payment_failed', { id: 'pi_fail', metadata: { payment_type: 'store_order', store_order_id: orderId } });
  await directDeliverWebhookEvent(env, event);

  assertEqual(db.prepare('SELECT payment_status FROM store_orders WHERE id = ?').get(orderId).payment_status, 'failed');
  assertEqual(db.prepare('SELECT reserved_qty FROM store_products WHERE id = ?').get(productId).reserved_qty, 0, 'reservation must be released on failure');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Admin access control & CRUD ─────────────────────────────────');

await test('non-admin cannot access any admin store endpoint', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const userId = seedUser(db, { role: 'client' });
  const token = await tokenFor(env, userId, 'client');
  let caught = null;
  try { await handleAdminStoreProducts(req('GET', '/api/admin/store/products', { token }), env, {}, {}); }
  catch (e) { caught = e; }
  assert(caught, 'a client role must be rejected');
  assertEqual(caught.status, 403);
});

await test('admin can create a product (auto-slugified) and it is not publicly visible until active', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const token = await tokenFor(env, adminId, 'admin');
  const createRes = await handleAdminStoreProducts(req('POST', '/api/admin/store/products', {
    token, body: { name: 'New Training Top!', basePrice: 45 },
  }), env, {}, {});
  assertEqual(createRes.status, 201);
  const { id, slug } = await createRes.json();
  assertEqual(slug, 'new-training-top');

  const publicList = await handleStoreProducts(req('GET', '/api/store/products'), env, {}, {});
  assertEqual((await publicList.json()).products.length, 0, 'a draft product must not appear publicly');

  await handleAdminStoreProducts(req('PATCH', `/api/admin/store/products/${id}`, { token, body: { status: 'active' } }), env, {}, { id });
  const publicListAfter = await handleStoreProducts(req('GET', '/api/store/products'), env, {}, {});
  assertEqual((await publicListAfter.json()).products.length, 1);
});

await test('a product referenced by an order cannot be permanently deleted', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const token = await tokenFor(env, adminId, 'admin');
  const productId = seedProduct(db, {});
  const orderId = uid('order');
  db.prepare(`INSERT INTO store_orders (id, order_number, customer_name, customer_email, customer_phone, delivery_method, total) VALUES (?, 'SO-1', 'X', 'x@example.com', '1', 'collection', 10)`).run(orderId);
  db.prepare(`INSERT INTO store_order_items (id, order_id, product_id, product_name_snapshot, unit_price, quantity, line_total) VALUES (?, ?, ?, 'X', 10, 1, 10)`).run(uid('item'), orderId, productId);

  const elig = await handleAdminStoreProducts(req('GET', `/api/admin/store/products/${productId}/deletion-eligibility`, { token }), env, {}, { id: productId });
  assertEqual((await elig.json()).eligible, false);

  const del = await handleAdminStoreProducts(req('DELETE', `/api/admin/store/products/${productId}`, { token, body: { confirm: 'DELETE' } }), env, {}, { id: productId });
  assertEqual(del.status, 409);
});

await test('a category with assigned products cannot be deleted', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const token = await tokenFor(env, adminId, 'admin');
  const catRes = await handleAdminStoreCategories(req('POST', '/api/admin/store/categories', { token, body: { name: 'Gloves' } }), env, {}, {});
  const { id: categoryId } = await catRes.json();
  seedProduct(db, { id: uid('p') });
  db.prepare('UPDATE store_products SET category_id = ? WHERE id = (SELECT id FROM store_products LIMIT 1)').run(categoryId);

  const del = await handleAdminStoreCategories(req('DELETE', `/api/admin/store/categories/${categoryId}`, { token }), env, {}, { id: categoryId });
  assertEqual(del.status, 409);
});

await test('manual stock adjustment cannot reduce stock below what is currently reserved', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const token = await tokenFor(env, adminId, 'admin');
  const productId = seedProduct(db, { stockQty: 5 });
  const orderId = seedOrder(db);
  await reserveStockForItems(env, orderId, [{ productId, variantId: null, quantity: 3 }]);

  const res = await handleAdminStoreInventory(req('POST', '/api/admin/store/inventory/adjust', {
    token, body: { productId, delta: -4, note: 'test' },
  }), env, {}, {});
  assertEqual(res.status, 409, 'must not allow stock to drop below the 3 units already reserved');
});

await test('admin marking an order dispatched writes a status-history row', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const adminId = seedUser(db, { role: 'admin' });
  const token = await tokenFor(env, adminId, 'admin');
  const orderId = uid('order');
  db.prepare(`INSERT INTO store_orders (id, order_number, customer_name, customer_email, customer_phone, delivery_method, total, payment_status, fulfilment_status) VALUES (?, 'SO-2', 'X', 'x@example.com', '1', 'delivery', 10, 'paid', 'processing')`).run(orderId);

  const res = await handleAdminStoreOrders(req('PATCH', `/api/admin/store/orders/${orderId}`, { token, body: { fulfilmentStatus: 'dispatched' } }), env, {}, { id: orderId });
  assertEqual(res.status, 200);
  const history = db.prepare('SELECT from_status, to_status FROM store_order_status_history WHERE order_id = ?').get(orderId);
  assertEqual(history.from_status, 'processing');
  assertEqual(history.to_status, 'dispatched');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Guest order privacy ──────────────────────────────────────────');

await test('a guest order is retrievable by its token but the token itself is never echoed back', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const productId = seedProduct(db, { stockQty: 5 });
  const orderRes = await handleStoreCheckout(req('POST', '/api/store/orders', {
    body: { items: [{ productId, quantity: 1 }], customerName: 'X', customerEmail: 'x@example.com', customerPhone: '1', deliveryMethod: 'collection' },
  }), env, {}, {});
  const { guestToken } = await orderRes.json();

  const lookup = await handleStoreOrders(req('GET', `/api/store/orders/guest/${guestToken}`), env, {}, { token: guestToken });
  assertEqual(lookup.status, 200);
  const body = await lookup.json();
  assert(!('guestToken' in body), 'the token must not be echoed back in the order payload');
});

await test('a non-existent guest token returns 404, not an empty/default order', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const res = await handleStoreOrders(req('GET', '/api/store/orders/guest/does-not-exist'), env, {}, { token: 'does-not-exist' });
  assertEqual(res.status, 404);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
