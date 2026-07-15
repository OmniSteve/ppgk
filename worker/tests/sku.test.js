/**
 * Automatic SKU generation + blank-SKU bug fix tests.
 *
 * Root cause under test: the admin variant form had no SKU input, so every
 * variant was created with sku = '' — an empty string is a real, non-NULL
 * value to a UNIQUE column, so the second blank-SKU variant always collided
 * with the first ("UNIQUE constraint failed: store_product_variants.sku").
 * See worker/src/lib/sku.js and worker/src/routes/admin/store/products.js.
 *
 * Run with: node worker/tests/sku.test.js
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { webcrypto } from 'node:crypto';
if (typeof crypto === 'undefined') globalThis.crypto = webcrypto;

import { signJwt } from '../src/lib/auth.js';
import { handleAdminStoreProducts } from '../src/routes/admin/store/products.js';
import { handleAdminStoreCategories } from '../src/routes/admin/store/categories.js';
import { handleStoreProducts } from '../src/routes/store/products.js';
import { normaliseSku, categoryCode, repairBlankSkus } from '../src/lib/sku.js';

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
  '0007_account_lifecycle', '0008_ecommerce_store', '0009_sku_generation',
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
  return { JWT_SECRET: 'test-secret-0123456789abcdef0123456789abcdef', APP_URL: 'https://ppgk.app', DB: makeD1(db) };
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

async function createProduct(env, token, overrides = {}) {
  const res = await handleAdminStoreProducts(req('POST', '/api/admin/store/products', {
    token, body: { name: 'Goalkeeper Gloves', basePrice: 30, status: 'active', ...overrides },
  }), env, {}, {});
  return { res, body: await res.json() };
}

async function createVariant(env, token, productId, overrides = {}) {
  const res = await handleAdminStoreProducts(req('POST', `/api/admin/store/products/${productId}/variants`, {
    token, body: { name: 'Variant', stockQty: 5, ...overrides },
  }), env, {}, { id: productId });
  return { res, body: await res.json() };
}

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Root-cause reproduction (exact reported error) ─────────────');

await test('a second blank-SKU variant no longer fails with UNIQUE constraint / 500', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token);

  const v1 = await createVariant(env, token, product.id, { name: 'Size 8 / Black' });
  assertEqual(v1.res.status, 201);
  const v2 = await createVariant(env, token, product.id, { name: 'Size 9 / Black' });
  assertEqual(v2.res.status, 201, `second blank-SKU variant must succeed, got: ${JSON.stringify(v2.body)}`);
  assert(v1.body.sku !== v2.body.sku, 'the two variants must not share a SKU');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── normaliseSku ────────────────────────────────────────────────');

await test('blank/whitespace/null/undefined all normalise to null; real values trim + uppercase', async () => {
  assertEqual(normaliseSku(''), null);
  assertEqual(normaliseSku('   '), null);
  assertEqual(normaliseSku(null), null);
  assertEqual(normaliseSku(undefined), null);
  assertEqual(normaliseSku(' abc-123 '), 'ABC-123');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Product SKU generation (tests 1-2) ──────────────────────────');

await test('a product created without an SKU gets one generated in the PPGK-{CODE}-{SEQ} format', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { res, body } = await createProduct(env, token, { sku: undefined });
  assertEqual(res.status, 201);
  assert(/^PPGK-[A-Z]{3}-\d{6}$/.test(body.sku), `unexpected SKU format: ${body.sku}`);
  const stored = db.prepare('SELECT sku FROM store_products WHERE id = ?').get(body.id);
  assertEqual(stored.sku, body.sku);
});

await test('category code is derived from the category name (Gloves -> GLV)', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const catRes = await handleAdminStoreCategories(req('POST', '/api/admin/store/categories', { token, body: { name: 'Gloves' } }), env, {}, {});
  const { id: categoryId } = await catRes.json();
  const { body } = await createProduct(env, token, { categoryId, sku: undefined });
  assert(body.sku.startsWith('PPGK-GLV-'), `expected GLV category code, got: ${body.sku}`);
});

await test('categoryCode() covers the suggested mapping and falls back to PRD for uncategorised', async () => {
  assertEqual(categoryCode('Gloves'), 'GLV');
  assertEqual(categoryCode('Clothing'), 'CLO');
  assertEqual(categoryCode('Accessories'), 'ACC');
  assertEqual(categoryCode('Equipment'), 'EQP');
  assertEqual(categoryCode('PPGK Merchandise'), 'MER');
  assertEqual(categoryCode(null), 'PRD');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Variant SKU generation (tests 3-7) ──────────────────────────');

await test('five glove variants created without SKUs all receive different SKUs', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token);
  const skus = [];
  for (let i = 4; i <= 8; i += 1) {
    const { res, body } = await createVariant(env, token, product.id, { name: `Size ${i}`, size: String(i), colour: 'Black' });
    assertEqual(res.status, 201);
    skus.push(body.sku);
  }
  assertEqual(new Set(skus).size, 5, `expected 5 unique SKUs, got: ${JSON.stringify(skus)}`);
});

await test('size 4 and size 6 (same colour) generate different SKUs', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token);
  const { body: v4 } = await createVariant(env, token, product.id, { name: 'Size 4', size: '4', colour: 'Black' });
  const { body: v6 } = await createVariant(env, token, product.id, { name: 'Size 6', size: '6', colour: 'Black' });
  assert(v4.sku.endsWith('-BLK-04'), `expected ...-BLK-04, got ${v4.sku}`);
  assert(v6.sku.endsWith('-BLK-06'), `expected ...-BLK-06, got ${v6.sku}`);
  assert(v4.sku !== v6.sku);
});

await test('two variants with identical size+colour get collision-safe suffixed SKUs (-2, -3)', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token);
  const { body: a } = await createVariant(env, token, product.id, { name: 'Black 6 (batch A)', size: '6', colour: 'Black' });
  const { body: b } = await createVariant(env, token, product.id, { name: 'Black 6 (batch B)', size: '6', colour: 'Black' });
  const { body: c } = await createVariant(env, token, product.id, { name: 'Black 6 (batch C)', size: '6', colour: 'Black' });
  assert(a.sku !== b.sku && b.sku !== c.sku && a.sku !== c.sku, `expected 3 unique SKUs, got ${a.sku}, ${b.sku}, ${c.sku}`);
  assert(b.sku === `${a.sku}-2` || /-\d$/.test(b.sku), `expected a collision suffix on the second variant, got ${b.sku}`);
});

await test('a variant with neither size nor colour gets a sequential -V001/-V002 fallback', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token);
  const { body: v1 } = await createVariant(env, token, product.id, { name: 'One Size' });
  const { body: v2 } = await createVariant(env, token, product.id, { name: 'One Size (2)' });
  assert(v1.sku.endsWith('-V001'), `expected -V001, got ${v1.sku}`);
  assert(v2.sku.endsWith('-V002'), `expected -V002, got ${v2.sku}`);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Custom / duplicate SKUs (tests 8-11) ────────────────────────');

await test('a custom supplied product SKU is preserved exactly (normalised)', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body } = await createProduct(env, token, { sku: ' custom-sku-1 ' });
  assertEqual(body.sku, 'CUSTOM-SKU-1');
});

await test('a duplicate custom product SKU returns 409 with a useful message', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  await createProduct(env, token, { sku: 'DUPLICATE-SKU', name: 'First' });
  const { res, body } = await createProduct(env, token, { sku: 'DUPLICATE-SKU', name: 'Second' });
  assertEqual(res.status, 409);
  assert(body.error && body.error.toLowerCase().includes('already assigned'), `expected a useful 409 message, got: ${JSON.stringify(body)}`);
});

await test('a custom supplied variant SKU is preserved, and a duplicate one is rejected with 409', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token);
  const { body: v1 } = await createVariant(env, token, product.id, { name: 'Custom', sku: 'MY-CUSTOM-VARIANT' });
  assertEqual(v1.sku, 'MY-CUSTOM-VARIANT');

  const dup = await createVariant(env, token, product.id, { name: 'Dup attempt', sku: 'my-custom-variant' });
  assertEqual(dup.res.status, 409);
  assert(dup.body.error.includes('already assigned'));
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Stability rule: editing never regenerates an existing SKU (tests 12-15) ─');

await test('editing a variant without touching its SKU leaves the SKU unchanged', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token);
  const { body: variant } = await createVariant(env, token, product.id, { name: 'Size 8', size: '8', colour: 'Black' });

  await handleAdminStoreProducts(req('PATCH', `/api/admin/store/products/${product.id}/variants/${variant.id}`, {
    token, body: { name: 'Renamed Size 8' },
  }), env, {}, { id: product.id, variantId: variant.id });

  const after = db.prepare('SELECT sku, name FROM store_product_variants WHERE id = ?').get(variant.id);
  assertEqual(after.sku, variant.sku);
  assertEqual(after.name, 'Renamed Size 8');
});

await test('changing a variant\'s size and colour does NOT regenerate its existing SKU', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token);
  const { body: variant } = await createVariant(env, token, product.id, { name: 'Size 8 Black', size: '8', colour: 'Black' });
  const originalSku = variant.sku;

  await handleAdminStoreProducts(req('PATCH', `/api/admin/store/products/${product.id}/variants/${variant.id}`, {
    token, body: { size: '10', colour: 'Red' },
  }), env, {}, { id: product.id, variantId: variant.id });

  const after = db.prepare('SELECT sku, size, colour FROM store_product_variants WHERE id = ?').get(variant.id);
  assertEqual(after.sku, originalSku, 'SKU must remain stable even though size/colour changed');
  assertEqual(after.size, '10');
  assertEqual(after.colour, 'Red');
});

await test('changing a product\'s name and category does NOT regenerate its existing SKU', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token);
  const originalSku = product.sku;

  const catRes = await handleAdminStoreCategories(req('POST', '/api/admin/store/categories', { token, body: { name: 'Clothing' } }), env, {}, {});
  const { id: categoryId } = await catRes.json();
  await handleAdminStoreProducts(req('PATCH', `/api/admin/store/products/${product.id}`, {
    token, body: { name: 'Renamed Product', categoryId },
  }), env, {}, { id: product.id });

  const after = db.prepare('SELECT sku, name, category_id FROM store_products WHERE id = ?').get(product.id);
  assertEqual(after.sku, originalSku, 'SKU must remain stable even though name/category changed');
  assertEqual(after.name, 'Renamed Product');
});

await test('an explicit non-blank SKU change on update IS honoured and validated for uniqueness', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: p1 } = await createProduct(env, token, { name: 'A' });
  const { body: p2 } = await createProduct(env, token, { name: 'B' });

  const ok = await handleAdminStoreProducts(req('PATCH', `/api/admin/store/products/${p1.id}`, { token, body: { sku: 'NEW-EXPLICIT-SKU' } }), env, {}, { id: p1.id });
  assertEqual(ok.status, 200);
  assertEqual(db.prepare('SELECT sku FROM store_products WHERE id = ?').get(p1.id).sku, 'NEW-EXPLICIT-SKU');

  const conflict = await handleAdminStoreProducts(req('PATCH', `/api/admin/store/products/${p2.id}`, { token, body: { sku: 'new-explicit-sku' } }), env, {}, { id: p2.id });
  assertEqual(conflict.status, 409);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Frontend payload shape (test 16) ────────────────────────────');

await test('the variant editor sends an explicit sku key in its create/update payload', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(join(__dirname, '..', '..', 'src', 'pages', 'admin', 'store', 'ProductManagement.jsx'), 'utf8');
  assert(/sku:\s*form\.sku/.test(src), 'expected the variant payload builder to explicitly include `sku: form.sku...`');
  assert(/placeholder="SKU|SKU \(optional/.test(src), 'expected a visible SKU input on the variant form');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Existing blank-SKU data repair (tests 17-19) ────────────────');

await test('repairBlankSkus converts blank strings to NULL, then generates real SKUs, without touching valid ones', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);

  // Simulate the pre-fix broken state directly (bypassing the now-fixed API):
  // one product with a real SKU, one with a blank string, one variant with a
  // blank string colliding with a second blank-string variant.
  db.prepare(`INSERT INTO store_products (id, name, slug, base_price, status, sku) VALUES ('p-good', 'Good', 'good', 10, 'active', 'PPGK-GLV-000001')`).run();
  db.prepare(`INSERT INTO store_products (id, name, slug, base_price, status, sku) VALUES ('p-blank', 'Blank Product', 'blank-product', 10, 'active', NULL)`).run();
  // NULL directly since node:sqlite's UNIQUE constraint would reject a second '' insert
  // the same way D1 did — the repair test targets NULL rows, which is exactly
  // what the 0009 migration converts blank strings into.
  db.prepare(`INSERT INTO store_product_variants (id, product_id, name, sku) VALUES ('v-blank-1', 'p-good', 'Size 8', NULL)`).run();

  const report = await repairBlankSkus(env);
  assertEqual(report.productsRepaired, 1);
  assertEqual(report.variantsRepaired, 1);

  const good = db.prepare('SELECT sku FROM store_products WHERE id = ?').get('p-good');
  assertEqual(good.sku, 'PPGK-GLV-000001', 'a valid existing SKU must not be overwritten');
  const repaired = db.prepare('SELECT sku FROM store_products WHERE id = ?').get('p-blank');
  assert(repaired.sku && repaired.sku.startsWith('PPGK-'), `expected a generated SKU, got: ${repaired.sku}`);
  const variant = db.prepare('SELECT sku FROM store_product_variants WHERE id = ?').get('v-blank-1');
  assert(variant.sku && variant.sku.startsWith('PPGK-GLV-000001-'), `expected a variant SKU based on the product SKU, got: ${variant.sku}`);
});

await test('a second variant can be added to a just-repaired product with no Internal Server Error', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  db.prepare(`INSERT INTO store_products (id, name, slug, base_price, status, sku) VALUES ('p-legacy', 'Legacy Gloves', 'legacy-gloves', 25, 'active', NULL)`).run();
  db.prepare(`INSERT INTO store_product_variants (id, product_id, name, sku) VALUES ('v-legacy-1', 'p-legacy', 'Size 7', NULL)`).run();

  await repairBlankSkus(env);

  const { res, body } = await createVariant(env, token, 'p-legacy', { name: 'Size 9', size: '9', colour: 'Black' });
  assertEqual(res.status, 201, `expected 201, got ${res.status}: ${JSON.stringify(body)}`);
  assert(body.sku, 'the new variant must receive a generated SKU');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n── Downstream integrity (tests 20-22) ──────────────────────────');

await test('inventory stock calculations still work after variant creation with generated SKUs', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token);
  await createVariant(env, token, product.id, { name: 'Size 8', size: '8', colour: 'Black', stockQty: 12 });
  const row = db.prepare('SELECT stock_qty, reserved_qty FROM store_product_variants WHERE product_id = ?').get(product.id);
  assertEqual(row.stock_qty, 12);
  assertEqual(row.stock_qty - row.reserved_qty, 12);
});

await test('order line items retain their own sku_snapshot independent of the live product/variant SKU', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token);
  const { body: variant } = await createVariant(env, token, product.id, { name: 'Size 8', size: '8', colour: 'Black', stockQty: 5 });

  db.prepare(`INSERT INTO store_orders (id, order_number, customer_name, customer_email, customer_phone, delivery_method, total)
              VALUES ('o-1', 'SO-1', 'X', 'x@example.com', '1', 'collection', 30)`).run();
  db.prepare(`INSERT INTO store_order_items (id, order_id, product_id, variant_id, product_name_snapshot, sku_snapshot, unit_price, quantity, line_total)
              VALUES ('oi-1', 'o-1', ?, ?, ?, ?, 30, 1, 30)`).run(product.id, variant.id, 'Goalkeeper Gloves', variant.sku);

  // Now change the variant's SKU explicitly (an allowed, deliberate admin action).
  await handleAdminStoreProducts(req('PATCH', `/api/admin/store/products/${product.id}/variants/${variant.id}`, { token, body: { sku: 'RELABELLED-SKU' } }), env, {}, { id: product.id, variantId: variant.id });

  const snapshot = db.prepare('SELECT sku_snapshot FROM store_order_items WHERE id = ?').get('oi-1');
  assertEqual(snapshot.sku_snapshot, variant.sku, 'the historical order snapshot must not change when the live SKU is later edited');
});

await test('the public shop product endpoint returns 200 for an active product with generated SKUs', async () => {
  const db = makeDb(); const env = makeEnv(db);
  const token = await adminToken(env, db);
  const { body: product } = await createProduct(env, token, { name: 'Public Gloves', status: 'active' });
  await createVariant(env, token, product.id, { name: 'Size 8', size: '8', colour: 'Black', stockQty: 5 });

  const slug = db.prepare('SELECT slug FROM store_products WHERE id = ?').get(product.id).slug;
  const res = await handleStoreProducts(req('GET', `/api/store/products/${slug}`), env, {}, { slug });
  assertEqual(res.status, 200);
  const body = await res.json();
  assertEqual(body.variants.length, 1);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
