-- =============================================================================
-- Premier Performance GK — Store Refunds, Order Archive/Delete
-- Migration: 0010_store_refunds.sql
--
-- Fixes the "refund doesn't actually refund" bug: the old admin refund action
-- (worker/src/routes/admin/store/orders.js) only wrote store_orders.refund_status
-- locally and never called Stripe. This migration adds a real refund ledger
-- (store_refunds) that becomes the single source of truth for refund state,
-- adds order archive/test-order support, and repairs any existing order whose
-- refund_status was set by the old bug with no matching Stripe refund.
--
-- store_orders.refund_status/refund_amount/refunded_at (from 0008) are left in
-- place but are no longer written by new code — refund state is now always
-- computed live from store_refunds.
-- =============================================================================

ALTER TABLE store_orders ADD COLUMN archived_at TEXT;
ALTER TABLE store_orders ADD COLUMN archived_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE store_orders ADD COLUMN is_test_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE store_orders ADD COLUMN stripe_livemode INTEGER;
ALTER TABLE store_orders ADD COLUMN amount_refunded_cents INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_store_orders_archived_at ON store_orders(archived_at);
CREATE INDEX IF NOT EXISTS idx_store_orders_is_test_order ON store_orders(is_test_order);

-- -----------------------------------------------------------------------------
-- REFUNDS — real Stripe refund ledger. Amounts in integer cents (Stripe's own
-- unit) to avoid float drift across multiple partial refunds on one order.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_refunds (
  id                        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  order_id                  TEXT NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  stripe_refund_id          TEXT UNIQUE,
  stripe_payment_intent_id  TEXT,
  amount_cents              INTEGER NOT NULL,
  currency                  TEXT NOT NULL DEFAULT 'EUR',
  status                    TEXT NOT NULL,   -- 'pending' | 'succeeded' | 'failed'
  reason                    TEXT,            -- Stripe reason: requested_by_customer | duplicate | fraudulent
  admin_note                TEXT,
  restore_inventory         INTEGER NOT NULL DEFAULT 0,
  created_by                TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_store_refunds_order_id ON store_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_store_refunds_stripe_refund_id ON store_refunds(stripe_refund_id);

-- -----------------------------------------------------------------------------
-- DATA REPAIR — the old "record refund" action set refund_status directly with
-- zero Stripe interaction. Any order in that state has no real refund behind
-- it, so its refund flag is factually wrong. Reset it and leave a paper trail;
-- store_refunds (empty for these orders) is now authoritative.
-- -----------------------------------------------------------------------------
INSERT INTO store_order_status_history (id, order_id, from_status, to_status, note)
SELECT lower(hex(randomblob(16))), id, fulfilment_status, fulfilment_status,
  'System correction: refund_status (' || refund_status || ', amount ' || COALESCE(refund_amount, 0) ||
  ') was set by the old manual-record refund action with no matching Stripe refund and has been reset. See store_refunds for real refund history.'
FROM store_orders WHERE refund_status IS NOT NULL;

UPDATE store_orders SET refund_status = NULL, refund_amount = NULL, refunded_at = NULL
WHERE refund_status IS NOT NULL;
