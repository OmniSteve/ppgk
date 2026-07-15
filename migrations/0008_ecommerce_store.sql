-- =============================================================================
-- Premier Performance GK — E-Commerce Store (Phase 1)
-- Migration: 0008_ecommerce_store.sql
--
-- Adds a fully self-contained store schema (store_*) for physical-goods sales.
-- Deliberately does NOT share orders/order_items/payments/refunds with the
-- existing coaching-session/credit-package purchase flow: order_items is
-- coupled to the coaching domain (session_id/package_definition_id/credit_cost)
-- and client/bookings.js never populates it for session bookings, so it is not
-- a reliable "what's in this order" source to build a third purchase type on.
-- The store embeds its own Stripe/payment/refund-status columns directly on
-- store_orders instead. No existing table is altered by this migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CATEGORIES — admin-managed, not hardcoded
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_categories (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_store_categories_active ON store_categories(active);

-- -----------------------------------------------------------------------------
-- PRODUCTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_products (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  category_id        TEXT REFERENCES store_categories(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  slug               TEXT NOT NULL UNIQUE,
  short_description  TEXT,
  full_description   TEXT,
  brand              TEXT,
  base_price         REAL NOT NULL,
  sale_price         REAL,
  status             TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'active' | 'archived'
  featured           INTEGER NOT NULL DEFAULT 0,
  primary_image_id   TEXT REFERENCES store_product_images(id) ON DELETE SET NULL,
  sku                TEXT UNIQUE,
  track_stock        INTEGER NOT NULL DEFAULT 1,
  stock_qty          INTEGER NOT NULL DEFAULT 0,  -- product-level stock; ignored once variants exist
  reserved_qty       INTEGER NOT NULL DEFAULT 0,  -- mirrors variant reservation model for no-variant products
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_store_products_status_category ON store_products(status, category_id);
CREATE INDEX IF NOT EXISTS idx_store_products_featured ON store_products(featured);
CREATE INDEX IF NOT EXISTS idx_store_products_slug ON store_products(slug);

-- -----------------------------------------------------------------------------
-- PRODUCT VARIANTS — size/colour/stock combinations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_product_variants (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  product_id      TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,           -- e.g. "Size 8 / Black"
  size            TEXT,
  colour          TEXT,
  sku             TEXT UNIQUE,
  price_override  REAL,
  stock_qty       INTEGER NOT NULL DEFAULT 0,
  reserved_qty    INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_store_product_variants_product_id ON store_product_variants(product_id);

-- -----------------------------------------------------------------------------
-- PRODUCT IMAGES — R2 keys only, never binary data in D1
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_product_images (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  r2_key     TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_store_product_images_product_id ON store_product_images(product_id);

-- -----------------------------------------------------------------------------
-- ORDER NUMBER SEQUENCE — single-row atomic counter for human-readable numbers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_order_sequence (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  next_number INTEGER NOT NULL DEFAULT 1000
);
INSERT OR IGNORE INTO store_order_sequence (id, next_number) VALUES (1, 1000);

-- -----------------------------------------------------------------------------
-- ORDERS — fully self-contained; no FK to orders/payments/refunds
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_orders (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  order_number            TEXT NOT NULL UNIQUE,
  user_id                 TEXT REFERENCES users(id) ON DELETE SET NULL,
  guest_token             TEXT UNIQUE,  -- non-guessable; set for guest orders only

  customer_name           TEXT NOT NULL,
  customer_email          TEXT NOT NULL,
  customer_phone          TEXT NOT NULL,

  delivery_method         TEXT NOT NULL,  -- 'collection' | 'delivery'
  delivery_address_line1  TEXT,
  delivery_address_line2  TEXT,
  delivery_city           TEXT,
  delivery_post_code      TEXT,
  collection_snapshot     TEXT,  -- JSON snapshot of collection settings at order time
  notes                   TEXT,

  subtotal                REAL NOT NULL DEFAULT 0,
  delivery_fee            REAL NOT NULL DEFAULT 0,
  tax_amount              REAL NOT NULL DEFAULT 0,
  tax_mode_snapshot       TEXT,  -- 'inclusive' | 'added' | 'not_applicable'
  total                   REAL NOT NULL DEFAULT 0,
  currency                TEXT NOT NULL DEFAULT 'EUR',

  payment_status          TEXT NOT NULL DEFAULT 'pending',    -- 'pending' | 'paid' | 'failed'
  fulfilment_status       TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'processing' | 'ready_for_collection' | 'dispatched' | 'completed' | 'cancelled'

  stripe_session_id       TEXT,
  stripe_checkout_url     TEXT,  -- the real Stripe-returned URL, not reconstructed
  stripe_payment_intent   TEXT,
  stripe_charge_id        TEXT,

  refund_status           TEXT,   -- NULL | 'partial' | 'full'
  refund_amount           REAL,
  refunded_at             TEXT,

  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_store_orders_user_id ON store_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_order_number ON store_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_store_orders_guest_token ON store_orders(guest_token);
CREATE INDEX IF NOT EXISTS idx_store_orders_payment_status ON store_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_store_orders_fulfilment_status ON store_orders(fulfilment_status);
CREATE INDEX IF NOT EXISTS idx_store_orders_stripe_session_id ON store_orders(stripe_session_id);

-- -----------------------------------------------------------------------------
-- ORDER ITEMS — snapshot at purchase time; never re-derive from the live product
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_order_items (
  id                        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  order_id                  TEXT NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  product_id                TEXT REFERENCES store_products(id) ON DELETE SET NULL,
  variant_id                TEXT REFERENCES store_product_variants(id) ON DELETE SET NULL,
  product_name_snapshot     TEXT NOT NULL,
  variant_details_snapshot  TEXT,  -- e.g. "Size 8 / Black"
  sku_snapshot              TEXT,
  unit_price                REAL NOT NULL,
  quantity                  INTEGER NOT NULL,
  line_total                REAL NOT NULL,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_store_order_items_order_id ON store_order_items(order_id);

-- -----------------------------------------------------------------------------
-- ORDER STATUS HISTORY — timeline for the admin order detail screen
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_order_status_history (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  order_id    TEXT NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,  -- NULL = system-driven (e.g. webhook)
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_store_order_status_history_order_id ON store_order_status_history(order_id);

-- -----------------------------------------------------------------------------
-- INVENTORY ADJUSTMENTS — audit trail for every stock change
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_inventory_adjustments (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  product_id   TEXT REFERENCES store_products(id) ON DELETE SET NULL,
  variant_id   TEXT REFERENCES store_product_variants(id) ON DELETE SET NULL,
  delta        INTEGER NOT NULL,  -- positive = stock added, negative = stock removed
  reason       TEXT NOT NULL,     -- 'order_fulfilled' | 'manual_adjustment' | 'reservation_release'
  order_id     TEXT REFERENCES store_orders(id) ON DELETE SET NULL,
  performed_by TEXT REFERENCES users(id) ON DELETE SET NULL,  -- NULL = system-driven
  note         TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_store_inventory_adjustments_product_id ON store_inventory_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_adjustments_variant_id ON store_inventory_adjustments(variant_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_adjustments_order_id ON store_inventory_adjustments(order_id);

-- -----------------------------------------------------------------------------
-- INVENTORY RESERVATIONS — temporary holds while a Stripe Checkout is pending
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_inventory_reservations (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  product_id  TEXT REFERENCES store_products(id) ON DELETE CASCADE,
  variant_id  TEXT REFERENCES store_product_variants(id) ON DELETE CASCADE,
  order_id    TEXT NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL,
  expires_at  TEXT NOT NULL,
  released    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_store_inventory_reservations_expiry ON store_inventory_reservations(expires_at, released);
CREATE INDEX IF NOT EXISTS idx_store_inventory_reservations_order_id ON store_inventory_reservations(order_id);

-- -----------------------------------------------------------------------------
-- APPLICATION SETTINGS — additive; the settings UI/backend is fully generic
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO app_settings (key, value, data_type) VALUES
  ('store_enabled',                 'true',            'boolean'),
  ('store_currency',                'EUR',             'string'),
  ('delivery_enabled',              'true',            'boolean'),
  ('collection_enabled',            'true',            'boolean'),
  ('store_delivery_fee',            '5',               'number'),
  ('store_free_delivery_threshold', '75',              'number'),
  ('collection_location_name',      '',                'string'),
  ('collection_address',            '',                'string'),
  ('collection_map_link',           '',                'string'),
  ('collection_instructions',       '',                'string'),
  ('collection_hours',              '',                'string'),
  ('store_contact_email',           '',                'string'),
  ('store_contact_phone',           '',                'string'),
  ('store_low_stock_threshold',     '5',               'number'),
  ('store_tax_mode',                'not_applicable',  'string'),
  ('store_tax_rate',                '0',               'number');

-- -----------------------------------------------------------------------------
-- NOTIFICATION TEMPLATES — additive; follows the existing {{var}} placeholder convention
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO notification_templates (id, name, event_trigger, subject, body_html, active) VALUES
  (lower(hex(randomblob(16))), 'Store Order Confirmation', 'store_order_confirmation',
   'Order confirmed — {{order_number}}',
   '<p>Hi {{customer_name}},</p><p>Thanks for your order! Your order <strong>{{order_number}}</strong> has been confirmed.</p><p>{{items_summary}}</p><p>Total: {{total}}</p><p>{{fulfilment_note}}</p><p><a href="{{order_link}}">View your order</a></p><p>Questions? Contact us at {{store_contact_email}}.</p>', 1),

  (lower(hex(randomblob(16))), 'Store Payment Failed', 'store_payment_failed',
   'Payment issue with order {{order_number}}',
   '<p>Hi {{customer_name}},</p><p>Unfortunately we were unable to process payment for order <strong>{{order_number}}</strong>. Please try again or contact us at {{store_contact_email}}.</p>', 1),

  (lower(hex(randomblob(16))), 'Ready for Collection', 'store_ready_for_collection',
   'Your order {{order_number}} is ready for collection',
   '<p>Hi {{customer_name}},</p><p>Your order <strong>{{order_number}}</strong> is ready for collection.</p><p>{{collection_instructions}}</p>', 1),

  (lower(hex(randomblob(16))), 'Order Dispatched', 'store_dispatched',
   'Your order {{order_number}} has been dispatched',
   '<p>Hi {{customer_name}},</p><p>Your order <strong>{{order_number}}</strong> is on its way.</p>', 1),

  (lower(hex(randomblob(16))), 'Order Cancelled', 'store_order_cancelled',
   'Order {{order_number}} cancelled',
   '<p>Hi {{customer_name}},</p><p>Your order <strong>{{order_number}}</strong> has been cancelled. {{cancellation_note}}</p>', 1),

  (lower(hex(randomblob(16))), 'Refund Confirmed', 'store_refund_confirmed',
   'Refund confirmed for order {{order_number}}',
   '<p>Hi {{customer_name}},</p><p>A refund of {{refund_amount}} has been recorded for order <strong>{{order_number}}</strong>.</p>', 1),

  (lower(hex(randomblob(16))), 'New Store Order (Admin)', 'store_new_order_admin',
   'New store order — {{order_number}}',
   '<p>A new store order has been paid.</p><p>Order: <strong>{{order_number}}</strong></p><p>Customer: {{customer_name}} ({{customer_email}})</p><p>Total: {{total}}</p><p>{{items_summary}}</p>', 1),

  (lower(hex(randomblob(16))), 'Low Stock Alert (Admin)', 'store_low_stock_admin',
   'Low stock: {{product_name}}',
   '<p>Product <strong>{{product_name}}</strong> ({{variant_details}}) is low on stock: {{stock_qty}} remaining.</p>', 1);
