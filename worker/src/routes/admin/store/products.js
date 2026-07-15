/**
 * Admin product (+ variant) management.
 * GET    /api/admin/store/products
 * GET    /api/admin/store/products/:id
 * POST   /api/admin/store/products
 * PATCH  /api/admin/store/products/:id
 * GET    /api/admin/store/products/:id/deletion-eligibility
 * DELETE /api/admin/store/products/:id
 * POST   /api/admin/store/products/:id/variants
 * PATCH  /api/admin/store/products/:id/variants/:variantId
 * DELETE /api/admin/store/products/:id/variants/:variantId
 * POST   /api/admin/store/repair-skus   — one-time back-fill of blank/NULL SKUs
 */
import { requireRole } from '../../../lib/auth.js';
import { query, queryOne, execute, audit, batch } from '../../../lib/db.js';
import { toCamel, toCamelArray } from '../../../lib/serializers.js';
import { uniqueSlug } from '../../../lib/slug.js';
import { normaliseSku, generateProductSku, generateVariantSku, isSkuUniqueViolation, repairBlankSkus } from '../../../lib/sku.js';

const STATUSES = ['draft', 'active', 'archived'];
const SKU_CONFLICT = { error: 'This SKU is already assigned to another product or variant.' };

/**
 * Resolve the final SKU for a new row: normalise whatever was supplied; if
 * non-blank, it must be unique (checked via `checkExisting`) or we return a
 * conflict signal — auto-generation only ever applies when nothing was
 * supplied, never as a silent substitute for a duplicate explicit value.
 */
async function resolveSkuForCreate({ supplied, checkExisting, generate }) {
  const normalised = normaliseSku(supplied);
  if (normalised) {
    if (await checkExisting(normalised)) return { conflict: true };
    return { sku: normalised, wasGenerated: false };
  }
  return { sku: await generate(), wasGenerated: true };
}

/**
 * Insert with a bounded retry: if the (auto-generated) SKU collides at the DB
 * level despite our pre-check — e.g. a genuine race between two concurrent
 * requests — regenerate and try again. An admin-supplied SKU never retries
 * here; its uniqueness was already authoritatively checked and any DB-level
 * conflict at that point is surfaced as-is (extremely unlikely, but not
 * silently papered over by swapping the admin's chosen value).
 */
async function insertWithSkuRetry({ sku, wasGenerated, regenerate, doInsert, maxAttempts = 5 }) {
  let currentSku = sku;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await doInsert(currentSku);
      return currentSku;
    } catch (e) {
      if (wasGenerated && isSkuUniqueViolation(e) && attempt < maxAttempts - 1) {
        currentSku = await regenerate();
        continue;
      }
      throw e;
    }
  }
  throw Object.assign(new Error('Could not generate a unique SKU after multiple attempts'), { status: 500 });
}

async function getProductDeletionEligibility(env, productId) {
  const product = await queryOne(env, 'SELECT id FROM store_products WHERE id = ?', [productId]);
  if (!product) return { eligible: false, blockingReasons: ['Product not found'], dependencyCounts: {} };
  const row = await queryOne(env, 'SELECT COUNT(*) as c FROM store_order_items WHERE product_id = ?', [productId]);
  const count = row?.c ?? 0;
  return {
    eligible: count === 0,
    blockingReasons: count > 0 ? [`${count} order(s) reference this product`] : [],
    dependencyCounts: { orderItems: count },
  };
}

export async function handleAdminStoreProducts(request, env, ctx, params) {
  const actor = await requireRole(request, env, 'admin');
  const url = new URL(request.url);
  const method = request.method;

  // ── Variants sub-resource ───────────────────────────────────────────────
  if (params?.id && url.pathname.endsWith('/variants') && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { name, size, colour, sku, priceOverride, stockQty, active, sortOrder } = body;
    if (!name) return Response.json({ message: 'name is required' }, { status: 400 });

    // Every variant needs its parent product's SKU as a base — generate and
    // persist one now if the product itself doesn't have one yet (e.g. it
    // was created before this SKU system existed, or before repair ran).
    let product = await queryOne(env, 'SELECT id, sku, category_id FROM store_products WHERE id = ?', [params.id]);
    if (!product) return Response.json({ message: 'Product not found' }, { status: 404 });
    if (!product.sku) {
      const category = product.category_id ? await queryOne(env, 'SELECT name FROM store_categories WHERE id = ?', [product.category_id]) : null;
      const productSku = await generateProductSku(env, category?.name);
      await execute(env, 'UPDATE store_products SET sku = ? WHERE id = ?', [productSku, params.id]);
      product = { ...product, sku: productSku };
    }

    const resolution = await resolveSkuForCreate({
      supplied: sku,
      checkExisting: async (candidate) => !!(await queryOne(env, 'SELECT id FROM store_product_variants WHERE sku = ?', [candidate])),
      generate: () => generateVariantSku(env, { productSku: product.sku, size, colour }),
    });
    if (resolution.conflict) return Response.json(SKU_CONFLICT, { status: 409 });

    const id = crypto.randomUUID();
    let finalSku;
    try {
      finalSku = await insertWithSkuRetry({
        sku: resolution.sku,
        wasGenerated: resolution.wasGenerated,
        regenerate: () => generateVariantSku(env, { productSku: product.sku, size, colour }),
        doInsert: (candidateSku) => execute(env,
          `INSERT INTO store_product_variants (id, product_id, name, size, colour, sku, price_override, stock_qty, active, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, params.id, name, size ?? null, colour ?? null, candidateSku, priceOverride ?? null, stockQty ?? 0, active === false ? 0 : 1, sortOrder ?? 0]
        ),
      });
    } catch (e) {
      if (isSkuUniqueViolation(e)) return Response.json(SKU_CONFLICT, { status: 409 });
      throw e;
    }

    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'create', recordType: 'store_product_variant', recordId: id, description: `Variant created: ${name} (${finalSku})` });
    const created = await queryOne(env, 'SELECT * FROM store_product_variants WHERE id = ?', [id]);
    return Response.json(toCamel(created), { status: 201 });
  }

  if (params?.id && params?.variantId && method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    const { name, size, colour, sku, priceOverride, stockQty, active, sortOrder } = body;

    // Stability rule: the SKU is only ever auto-generated at creation time.
    // A blank/omitted sku here means "leave it unchanged" (COALESCE with a
    // null param is a no-op) — name/size/colour changes never touch it.
    // Only an explicit, non-blank sku is treated as a deliberate admin
    // change, and it must be unique (excluding this row) or we 409 instead
    // of letting the raw UNIQUE constraint fail the request.
    const normalisedSku = normaliseSku(sku);
    if (normalisedSku) {
      const dup = await queryOne(env, 'SELECT id FROM store_product_variants WHERE sku = ? AND id != ?', [normalisedSku, params.variantId]);
      if (dup) return Response.json(SKU_CONFLICT, { status: 409 });
    }

    try {
      await execute(env,
        `UPDATE store_product_variants SET
           name = COALESCE(?, name), size = COALESCE(?, size), colour = COALESCE(?, colour),
           sku = COALESCE(?, sku), price_override = ?, stock_qty = COALESCE(?, stock_qty),
           active = COALESCE(?, active), sort_order = COALESCE(?, sort_order), updated_at = ?
         WHERE id = ? AND product_id = ?`,
        [name ?? null, size ?? null, colour ?? null, normalisedSku,
         priceOverride !== undefined ? priceOverride : (await queryOne(env, 'SELECT price_override FROM store_product_variants WHERE id = ?', [params.variantId]))?.price_override ?? null,
         stockQty ?? null, active != null ? (active ? 1 : 0) : null, sortOrder ?? null,
         new Date().toISOString(), params.variantId, params.id]
      );
    } catch (e) {
      if (isSkuUniqueViolation(e)) return Response.json(SKU_CONFLICT, { status: 409 });
      throw e;
    }
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'update', recordType: 'store_product_variant', recordId: params.variantId, description: `Variant updated: ${params.variantId}` });
    return Response.json({ message: 'Variant updated' });
  }

  if (params?.id && params?.variantId && method === 'DELETE') {
    const dependents = await queryOne(env, 'SELECT COUNT(*) as c FROM store_order_items WHERE variant_id = ?', [params.variantId]);
    if ((dependents?.c ?? 0) > 0) {
      return Response.json({ message: 'This variant has order history and cannot be deleted — deactivate it instead' }, { status: 409 });
    }
    await execute(env, 'DELETE FROM store_product_variants WHERE id = ? AND product_id = ?', [params.variantId, params.id]);
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'delete', recordType: 'store_product_variant', recordId: params.variantId, description: `Variant deleted: ${params.variantId}` });
    return Response.json({ message: 'Variant deleted' });
  }

  // ── Deletion eligibility / permanent delete ─────────────────────────────
  if (params?.id && url.pathname.endsWith('/deletion-eligibility') && method === 'GET') {
    return Response.json(await getProductDeletionEligibility(env, params.id));
  }

  if (params?.id && method === 'DELETE') {
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== 'DELETE') return Response.json({ message: 'Type DELETE to confirm permanent deletion' }, { status: 400 });

    const product = await queryOne(env, 'SELECT id, name FROM store_products WHERE id = ?', [params.id]);
    if (!product) return Response.json({ message: 'Product not found' }, { status: 404 });

    const eligibility = await getProductDeletionEligibility(env, params.id);
    if (!eligibility.eligible) return Response.json({ message: 'This product cannot be permanently deleted', ...eligibility }, { status: 409 });

    const images = await query(env, 'SELECT r2_key FROM store_product_images WHERE product_id = ?', [params.id]);
    for (const img of images) {
      try { await env.STORAGE.delete(img.r2_key); } catch (e) { console.error('R2 delete failed (non-fatal):', e.message); }
    }

    await batch(env, [
      { sql: 'UPDATE store_products SET primary_image_id = NULL WHERE id = ?', params: [params.id] },
      {
        sql: `INSERT INTO audit_log (id, actor_id, actor_name, action, record_type, record_id, description, previous_value, reason)
              VALUES (?, ?, ?, 'delete', 'store_product', ?, ?, ?, ?)`,
        params: [crypto.randomUUID(), actor.sub, `${actor.firstName} ${actor.lastName}`, params.id,
                 `Product permanently deleted: ${product.name}`, JSON.stringify({ id: product.id, name: product.name }), body.reason ?? null],
      },
      { sql: 'DELETE FROM store_products WHERE id = ?', params: [params.id] },
    ]);
    return Response.json({ message: 'Product permanently deleted' });
  }

  // ── One-time admin repair: back-fill any blank/NULL SKUs ────────────────
  // (registered on its own static path — checked before the generic
  // "POST with no :id" product-create branch below, which it would
  // otherwise fall into).
  if (method === 'POST' && !params?.id && url.pathname.endsWith('/repair-skus')) {
    const report = await repairBlankSkus(env);
    await audit(env, {
      actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`,
      action: 'update', recordType: 'store_product', recordId: 'bulk',
      description: `SKU repair: ${report.productsRepaired} product(s), ${report.variantsRepaired} variant(s) given generated SKUs`,
      newValue: report,
    });
    return Response.json(report);
  }

  // ── Create ───────────────────────────────────────────────────────────────
  if (method === 'POST' && !params?.id) {
    const body = await request.json().catch(() => ({}));
    const { name, categoryId, shortDescription, fullDescription, brand, basePrice, salePrice, status, featured, sku, trackStock, stockQty, sortOrder } = body;
    if (!name || basePrice == null) return Response.json({ message: 'name and basePrice are required' }, { status: 400 });
    if (status && !STATUSES.includes(status)) return Response.json({ message: 'Invalid status' }, { status: 400 });

    const slug = await uniqueSlug(body.slug || name, async (s) => !!(await queryOne(env, 'SELECT id FROM store_products WHERE slug = ?', [s])));
    const category = categoryId ? await queryOne(env, 'SELECT name FROM store_categories WHERE id = ?', [categoryId]) : null;

    const resolution = await resolveSkuForCreate({
      supplied: sku,
      checkExisting: async (candidate) => !!(await queryOne(env, 'SELECT id FROM store_products WHERE sku = ?', [candidate])),
      generate: () => generateProductSku(env, category?.name),
    });
    if (resolution.conflict) return Response.json(SKU_CONFLICT, { status: 409 });

    const id = crypto.randomUUID();
    let finalSku;
    try {
      finalSku = await insertWithSkuRetry({
        sku: resolution.sku,
        wasGenerated: resolution.wasGenerated,
        regenerate: () => generateProductSku(env, category?.name),
        doInsert: (candidateSku) => execute(env,
          `INSERT INTO store_products (id, category_id, name, slug, short_description, full_description, brand, base_price, sale_price, status, featured, sku, track_stock, stock_qty, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, categoryId ?? null, name, slug, shortDescription ?? null, fullDescription ?? null, brand ?? null,
           basePrice, salePrice ?? null, status || 'draft', featured ? 1 : 0, candidateSku,
           trackStock === false ? 0 : 1, stockQty ?? 0, sortOrder ?? 0]
        ),
      });
    } catch (e) {
      if (isSkuUniqueViolation(e)) return Response.json(SKU_CONFLICT, { status: 409 });
      throw e;
    }

    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'create', recordType: 'store_product', recordId: id, description: `Product created: ${name} (${finalSku})` });
    return Response.json({ id, slug, sku: finalSku }, { status: 201 });
  }

  // ── Update ───────────────────────────────────────────────────────────────
  if (method === 'PATCH' && params?.id) {
    const body = await request.json().catch(() => ({}));
    const { name, categoryId, shortDescription, fullDescription, brand, basePrice, salePrice, status, featured, sku, trackStock, stockQty, sortOrder, primaryImageId } = body;
    if (status && !STATUSES.includes(status)) return Response.json({ message: 'Invalid status' }, { status: 400 });

    let slug;
    if (body.slug || name) {
      slug = await uniqueSlug(body.slug || name, async (s) => {
        const row = await queryOne(env, 'SELECT id FROM store_products WHERE slug = ? AND id != ?', [s, params.id]);
        return !!row;
      });
    }

    // Stability rule: SKU is only auto-generated at creation. A blank/absent
    // sku here leaves the existing value untouched (COALESCE no-op); an
    // explicit non-blank sku must be unique (excluding this row) or 409.
    const normalisedSku = normaliseSku(sku);
    if (normalisedSku) {
      const dup = await queryOne(env, 'SELECT id FROM store_products WHERE sku = ? AND id != ?', [normalisedSku, params.id]);
      if (dup) return Response.json(SKU_CONFLICT, { status: 409 });
    }

    try {
    await execute(env,
      `UPDATE store_products SET
         category_id = COALESCE(?, category_id), name = COALESCE(?, name), slug = COALESCE(?, slug),
         short_description = COALESCE(?, short_description), full_description = COALESCE(?, full_description),
         brand = COALESCE(?, brand), base_price = COALESCE(?, base_price), sale_price = ?,
         status = COALESCE(?, status), featured = COALESCE(?, featured), sku = COALESCE(?, sku),
         track_stock = COALESCE(?, track_stock), stock_qty = COALESCE(?, stock_qty),
         sort_order = COALESCE(?, sort_order), primary_image_id = COALESCE(?, primary_image_id),
         updated_at = ?
       WHERE id = ?`,
      [categoryId ?? null, name ?? null, slug ?? null, shortDescription ?? null, fullDescription ?? null,
       brand ?? null, basePrice ?? null, salePrice !== undefined ? salePrice : (await queryOne(env, 'SELECT sale_price FROM store_products WHERE id = ?', [params.id]))?.sale_price ?? null,
       status ?? null, featured != null ? (featured ? 1 : 0) : null, normalisedSku,
       trackStock != null ? (trackStock ? 1 : 0) : null, stockQty ?? null, sortOrder ?? null,
       primaryImageId ?? null, new Date().toISOString(), params.id]
    );
    } catch (e) {
      if (isSkuUniqueViolation(e)) return Response.json(SKU_CONFLICT, { status: 409 });
      throw e;
    }
    await audit(env, { actorId: actor.sub, actorName: `${actor.firstName} ${actor.lastName}`, action: 'update', recordType: 'store_product', recordId: params.id, description: `Product updated: ${params.id}` });
    return Response.json({ message: 'Product updated' });
  }

  // ── Detail ───────────────────────────────────────────────────────────────
  if (method === 'GET' && params?.id) {
    const product = await queryOne(env, `SELECT s.*, c.name as category_name FROM store_products s LEFT JOIN store_categories c ON c.id = s.category_id WHERE s.id = ?`, [params.id]);
    if (!product) return Response.json({ message: 'Product not found' }, { status: 404 });
    const [variants, images] = await Promise.all([
      query(env, 'SELECT * FROM store_product_variants WHERE product_id = ? ORDER BY sort_order, name', [params.id]),
      query(env, 'SELECT * FROM store_product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order', [params.id]),
    ]);
    const camel = toCamel(product);
    camel.variants = toCamelArray(variants);
    camel.images = toCamelArray(images).map((img) => ({ ...img, url: `/api/store/images/${img.id}` }));
    return Response.json(camel);
  }

  // ── List ─────────────────────────────────────────────────────────────────
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';
  const categoryId = url.searchParams.get('categoryId') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  const conditions = ['(s.name LIKE ? OR s.sku LIKE ? OR s.brand LIKE ?)'];
  const bindings = [`%${search}%`, `%${search}%`, `%${search}%`];
  if (status) { conditions.push('s.status = ?'); bindings.push(status); }
  if (categoryId) { conditions.push('s.category_id = ?'); bindings.push(categoryId); }
  const where = conditions.join(' AND ');

  const [products, countRow] = await Promise.all([
    query(env,
      `SELECT s.*, c.name as category_name FROM store_products s LEFT JOIN store_categories c ON c.id = s.category_id
       WHERE ${where} ORDER BY s.sort_order, s.created_at DESC LIMIT ? OFFSET ?`,
      [...bindings, limit, offset]
    ),
    queryOne(env, `SELECT COUNT(*) as count FROM store_products s WHERE ${where}`, bindings),
  ]);

  const withImages = toCamelArray(products).map((p) => ({ ...p, imageUrl: p.primaryImageId ? `/api/store/images/${p.primaryImageId}` : null }));
  return Response.json({ products: withImages, total: countRow?.count ?? 0 });
}
