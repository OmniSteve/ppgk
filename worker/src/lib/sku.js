/**
 * SKU normalisation and automatic generation for store products/variants.
 *
 * Root cause this module fixes: the previous code used `sku ?? null`, which
 * only substitutes on null/undefined — an empty string ('') sails straight
 * through and gets stored as a literal value in a UNIQUE column, so the
 * *second* blank-SKU row collides with the first ("UNIQUE constraint
 * failed: store_product_variants.sku"). normaliseSku() below is the single
 * place blank-vs-real is decided; every create/update path must run its
 * input through it before binding to SQL.
 */
import { query, queryOne, execute } from './db.js';

/** '', '   ', null, undefined -> null. Anything else -> trimmed, uppercased. */
export function normaliseSku(input) {
  return typeof input === 'string' && input.trim().length > 0 ? input.trim().toUpperCase() : null;
}

const CATEGORY_CODES = {
  gloves: 'GLV',
  clothing: 'CLO',
  'training wear': 'CLO',
  accessories: 'ACC',
  equipment: 'EQP',
  merchandise: 'MER',
  'ppgk merchandise': 'MER',
};

/** Category name -> 3-letter code. Falls back to letters derived from the name, then PRD. */
export function categoryCode(categoryName) {
  if (!categoryName) return 'PRD';
  const key = categoryName.trim().toLowerCase();
  if (CATEGORY_CODES[key]) return CATEGORY_CODES[key];
  const letters = categoryName.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return letters.length >= 3 ? letters.slice(0, 3) : (letters + 'XXX').slice(0, 3) || 'PRD';
}

const COLOUR_CODES = {
  black: 'BLK', white: 'WHT', red: 'RED', blue: 'BLU', yellow: 'YEL',
  green: 'GRN', orange: 'ORG', purple: 'PUR', grey: 'GRY', gray: 'GRY',
  pink: 'PNK', navy: 'NVY', silver: 'SLV', gold: 'GLD', brown: 'BRN',
};

function colourCode(colour) {
  if (!colour || !colour.trim()) return null;
  const key = colour.trim().toLowerCase();
  if (COLOUR_CODES[key]) return COLOUR_CODES[key];
  const letters = colour.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return letters.slice(0, 3) || null;
}

const SIZE_WORD_CODES = {
  'extra small': 'XS', xs: 'XS',
  small: 'S', s: 'S',
  medium: 'M', m: 'M',
  large: 'L', l: 'L',
  'extra large': 'XL', xl: 'XL',
  'extra extra large': 'XXL', xxl: 'XXL',
};

function sizeCode(size) {
  if (!size || !size.trim()) return null;
  const trimmed = size.trim();
  const key = trimmed.toLowerCase();
  if (SIZE_WORD_CODES[key]) return SIZE_WORD_CODES[key];
  const numMatch = trimmed.match(/(\d+)/); // "Size 4", "4", "UK 4.5" -> "04"
  if (numMatch) return numMatch[1].padStart(2, '0');
  const letters = trimmed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return letters.slice(0, 3) || null;
}

async function nextSkuSequenceNumber(env) {
  await execute(env, 'UPDATE store_sku_sequence SET next_number = next_number + 1 WHERE id = 1');
  const row = await queryOne(env, 'SELECT next_number FROM store_sku_sequence WHERE id = 1');
  return row.next_number - 1;
}

/** PPGK-{CATEGORY_CODE}-{SEQUENCE}, e.g. PPGK-GLV-000123. Always unique. */
export async function generateProductSku(env, categoryName) {
  const code = categoryCode(categoryName);
  for (let attempt = 0; attempt < 20; attempt++) {
    const seq = await nextSkuSequenceNumber(env);
    const candidate = `PPGK-${code}-${String(seq).padStart(6, '0')}`;
    const exists = await queryOne(env, 'SELECT 1 FROM store_products WHERE sku = ?', [candidate]);
    if (!exists) return candidate;
  }
  throw Object.assign(new Error('Unable to generate a unique product SKU after multiple attempts'), { status: 500 });
}

/**
 * {PRODUCT_SKU}-{COLOUR}-{SIZE}, e.g. PPGK-GLV-000123-BLK-06. When both size
 * and colour are missing, falls back to a sequential {PRODUCT_SKU}-V001,
 * -V002, ... suffix instead. On any collision, appends -2, -3, ... until a
 * free SKU is found.
 */
export async function generateVariantSku(env, { productSku, size, colour }) {
  const exists = async (sku) => !!(await queryOne(env, 'SELECT 1 FROM store_product_variants WHERE sku = ?', [sku]));
  const c = colourCode(colour);
  const s = sizeCode(size);

  if (!c && !s) {
    for (let i = 1; i <= 999; i++) {
      const candidate = `${productSku}-V${String(i).padStart(3, '0')}`;
      if (!(await exists(candidate))) return candidate;
    }
    throw Object.assign(new Error('Unable to generate a unique variant SKU after multiple attempts'), { status: 500 });
  }

  const base = [productSku, c, s].filter(Boolean).join('-');
  if (!(await exists(base))) return base;
  for (let i = 2; i <= 999; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw Object.assign(new Error('Unable to generate a unique variant SKU after multiple attempts'), { status: 500 });
}

/** True if a D1 error is specifically a UNIQUE-constraint failure on a `sku` column. */
export function isSkuUniqueViolation(error) {
  const msg = error?.message;
  return typeof msg === 'string' && /UNIQUE constraint failed/i.test(msg) && /\.sku\b/i.test(msg);
}

/**
 * One-time administrative repair (idempotent — safe to run more than once):
 *  1. Belt-and-braces blank-string -> NULL normalisation (the migration
 *     already does this at the DB level; repeated here so this function is
 *     self-sufficient if ever run against a DB that hasn't had the migration
 *     applied in exactly this order).
 *  2. Reports pre-existing duplicate non-empty SKUs WITHOUT touching them —
 *     these need a human decision, not a silent overwrite.
 *  3. Generates and saves real SKUs for every product/variant that has NULL,
 *     using the exact same generation logic as live create requests.
 */
export async function repairBlankSkus(env) {
  await execute(env, "UPDATE store_products SET sku = NULL WHERE sku IS NOT NULL AND TRIM(sku) = ''");
  await execute(env, "UPDATE store_product_variants SET sku = NULL WHERE sku IS NOT NULL AND TRIM(sku) = ''");

  const dupProducts = await query(env, 'SELECT sku, COUNT(*) as c FROM store_products WHERE sku IS NOT NULL GROUP BY sku HAVING c > 1');
  const dupVariants = await query(env, 'SELECT sku, COUNT(*) as c FROM store_product_variants WHERE sku IS NOT NULL GROUP BY sku HAVING c > 1');

  const products = await query(env,
    `SELECT p.id, c.name as category_name FROM store_products p
     LEFT JOIN store_categories c ON c.id = p.category_id WHERE p.sku IS NULL`);
  const generatedProductSku = {};
  for (const p of products) {
    const sku = await generateProductSku(env, p.category_name);
    await execute(env, 'UPDATE store_products SET sku = ? WHERE id = ?', [sku, p.id]);
    generatedProductSku[p.id] = sku;
  }

  const variants = await query(env,
    `SELECT v.id, v.product_id, v.size, v.colour, p.sku as product_sku
     FROM store_product_variants v JOIN store_products p ON p.id = v.product_id WHERE v.sku IS NULL`);
  const repairedVariants = [];
  for (const v of variants) {
    const productSku = v.product_sku || generatedProductSku[v.product_id];
    const sku = await generateVariantSku(env, { productSku, size: v.size, colour: v.colour });
    await execute(env, 'UPDATE store_product_variants SET sku = ? WHERE id = ?', [sku, v.id]);
    repairedVariants.push({ id: v.id, sku });
  }

  return {
    productsRepaired: Object.keys(generatedProductSku).length,
    variantsRepaired: repairedVariants.length,
    duplicateProductSkus: dupProducts.map((d) => d.sku),
    duplicateVariantSkus: dupVariants.map((d) => d.sku),
  };
}
