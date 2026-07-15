/**
 * Public storefront product catalogue.
 * GET /api/store/products         — active products only, filters + sort
 * GET /api/store/products/:slug   — active product detail with variants + images
 */
import { query, queryOne } from '../../lib/db.js';
import { toCamel, toCamelArray } from '../../lib/serializers.js';
import { ok, err } from '../../lib/validate.js';

const SORTS = {
  newest:     's.created_at DESC',
  price_asc:  'COALESCE(s.sale_price, s.base_price) ASC',
  price_desc: 'COALESCE(s.sale_price, s.base_price) DESC',
  featured:   's.featured DESC, s.sort_order ASC, s.created_at DESC',
};

export async function handleStoreProducts(request, env, ctx, params) {
  const url = new URL(request.url);

  if (params?.slug) {
    const product = await queryOne(env,
      `SELECT s.*, c.name as category_name, c.slug as category_slug
       FROM store_products s LEFT JOIN store_categories c ON c.id = s.category_id
       WHERE s.slug = ? AND s.status = 'active'`,
      [params.slug]
    );
    if (!product) return err('Product not found', 404);

    const [variants, images] = await Promise.all([
      query(env, 'SELECT * FROM store_product_variants WHERE product_id = ? AND active = 1 ORDER BY sort_order, name', [product.id]),
      query(env, 'SELECT * FROM store_product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order', [product.id]),
    ]);

    const camel = toCamel(product);
    camel.variants = toCamelArray(variants).map((v) => ({ ...v, inStock: v.stockQty - v.reservedQty > 0, available: v.stockQty - v.reservedQty }));
    camel.images = toCamelArray(images).map((img) => ({ ...img, url: `/api/store/images/${img.id}` }));
    camel.imageUrl = product.primary_image_id ? `/api/store/images/${product.primary_image_id}` : null;
    camel.inStock = product.track_stock ? (product.stock_qty - product.reserved_qty) > 0 || variants.length > 0 : true;
    return ok(camel);
  }

  const category = url.searchParams.get('category') || '';
  const inStockOnly = url.searchParams.get('inStock') === 'true';
  const featuredOnly = url.searchParams.get('featured') === 'true';
  const search = url.searchParams.get('search') || '';
  const sort = SORTS[url.searchParams.get('sort')] || SORTS.featured;
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '24'), 60);
  const offset = (page - 1) * limit;

  const conditions = ["s.status = 'active'"];
  const bindings = [];
  if (category) { conditions.push('c.slug = ?'); bindings.push(category); }
  if (featuredOnly) conditions.push('s.featured = 1');
  if (search) { conditions.push('(s.name LIKE ? OR s.brand LIKE ?)'); bindings.push(`%${search}%`, `%${search}%`); }
  // in-stock filter: true when the product has no tracked stock (unlimited), or
  // has available product-level stock, or has at least one active variant with
  // available stock.
  if (inStockOnly) {
    conditions.push(`(
      s.track_stock = 0
      OR (s.stock_qty - s.reserved_qty) > 0
      OR EXISTS (SELECT 1 FROM store_product_variants v WHERE v.product_id = s.id AND v.active = 1 AND (v.stock_qty - v.reserved_qty) > 0)
    )`);
  }
  const where = conditions.join(' AND ');

  const [products, countRow] = await Promise.all([
    query(env,
      `SELECT s.*, c.name as category_name, c.slug as category_slug
       FROM store_products s LEFT JOIN store_categories c ON c.id = s.category_id
       WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`,
      [...bindings, limit, offset]
    ),
    queryOne(env,
      `SELECT COUNT(*) as count FROM store_products s LEFT JOIN store_categories c ON c.id = s.category_id WHERE ${where}`,
      bindings
    ),
  ]);

  const withImages = toCamelArray(products).map((p) => ({ ...p, imageUrl: p.primaryImageId ? `/api/store/images/${p.primaryImageId}` : null }));
  return ok({ products: withImages, total: countRow?.count ?? 0 });
}

/** GET /api/store/categories — active categories for the shop filter bar. */
export async function handleStoreCategories(request, env) {
  const categories = await query(env, 'SELECT * FROM store_categories WHERE active = 1 ORDER BY sort_order, name', []);
  return ok({ categories: toCamelArray(categories) });
}
