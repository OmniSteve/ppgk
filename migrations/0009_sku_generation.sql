-- =============================================================================
-- Premier Performance GK — Automatic SKU generation + blank-SKU repair
-- Migration: 0009_sku_generation.sql
--
-- Fixes the root cause of "UNIQUE constraint failed: store_product_variants.sku":
-- the admin variant form had no SKU field, so every variant was created with
-- sku = '' (an empty string is a real, non-NULL value to a UNIQUE column —
-- only NULL is exempt from uniqueness), so the second blank variant always
-- collided with the first. See worker/src/lib/sku.js for the full fix
-- (normalisation + generation) and worker/src/routes/admin/store/products.js
-- for the corrected create/update handlers.
--
-- store_products.sku and store_product_variants.sku already exist as
-- `TEXT UNIQUE` (nullable) from migration 0008 — that is the correct target
-- shape (see task notes: do not add NOT NULL until all data is repaired), so
-- no column changes are needed here.
-- =============================================================================

-- Atomic counter backing generateProductSku() in worker/src/lib/sku.js —
-- same pattern as store_order_sequence from migration 0008.
CREATE TABLE IF NOT EXISTS store_sku_sequence (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  next_number INTEGER NOT NULL DEFAULT 100
);
INSERT OR IGNORE INTO store_sku_sequence (id, next_number) VALUES (1, 100);

-- Repair: blank-string SKUs must never have been stored as such. Convert any
-- that already slipped through the old buggy code path to NULL so they (a)
-- stop violating the UNIQUE constraint and (b) become eligible for proper
-- generation via POST /api/admin/store/repair-skus (worker/src/lib/sku.js
-- repairBlankSkus) — generating real SKU *values* needs category lookups and
-- collision-safe suffixing, which is application logic, not pure SQL, per
-- the task's own guidance not to rely on SQLite string functions for that.
UPDATE store_products SET sku = NULL WHERE sku IS NOT NULL AND TRIM(sku) = '';
UPDATE store_product_variants SET sku = NULL WHERE sku IS NOT NULL AND TRIM(sku) = '';
