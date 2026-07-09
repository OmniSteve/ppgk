-- =============================================================================
-- Premier Performance GK — Cloudflare D1 Initial Schema
-- Migration: 0001_initial_schema.sql
-- =============================================================================


-- -----------------------------------------------------------------------------
-- ROLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL UNIQUE,           -- 'admin', 'head_coach', 'coach', 'client'
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO roles (id, name, description) VALUES
  (lower(hex(randomblob(16))), 'admin',      'Full system access'),
  (lower(hex(randomblob(16))), 'head_coach', 'Senior coaching staff'),
  (lower(hex(randomblob(16))), 'coach',      'Coaching staff'),
  (lower(hex(randomblob(16))), 'client',     'Parent / client account');

-- -----------------------------------------------------------------------------
-- USERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  phone               TEXT,
  role                TEXT NOT NULL DEFAULT 'client' REFERENCES roles(name),
  email_verified      INTEGER NOT NULL DEFAULT 0,   -- 0 | 1 (boolean)
  email_verify_token  TEXT,
  reset_token         TEXT,
  reset_token_expires TEXT,
  refresh_token       TEXT,
  last_login_at       TEXT,
  active              INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role        ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

-- -----------------------------------------------------------------------------
-- CLIENT PROFILES
-- extended data linked to a user with role='client'
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_profiles (
  id                        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id                   TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  address_line1             TEXT,
  address_line2             TEXT,
  city                      TEXT,
  post_code                 TEXT,
  country                   TEXT DEFAULT 'MT',
  emergency_contact_name    TEXT,
  emergency_contact_phone   TEXT,
  emergency_contact_relation TEXT,
  gdpr_consent              INTEGER NOT NULL DEFAULT 0,
  gdpr_consent_at           TEXT,
  marketing_consent         INTEGER NOT NULL DEFAULT 0,
  notes                     TEXT,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- COACH PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coach_profiles (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  bio              TEXT,
  specialisations  TEXT,   -- comma-separated or JSON array
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_coach_profiles_user_id ON coach_profiles(user_id);

-- -----------------------------------------------------------------------------
-- PLAYERS (goalkeeper profiles linked to a client)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  date_of_birth     TEXT,
  age_group         TEXT,
  experience_level  TEXT,
  current_club      TEXT,
  school            TEXT,
  medical_info      TEXT,
  allergies         TEXT,
  emergency_contact_name   TEXT,
  emergency_contact_phone  TEXT,
  photo_url         TEXT,
  status            TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'inactive' | 'archived'
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_players_client_id ON players(client_id);
CREATE INDEX IF NOT EXISTS idx_players_status    ON players(status);

-- -----------------------------------------------------------------------------
-- LOCATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name          TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city          TEXT,
  post_code     TEXT,
  map_url       TEXT,
  notes         TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- SESSION TYPES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_types (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name             TEXT NOT NULL,
  description      TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  default_capacity INTEGER NOT NULL DEFAULT 10,
  credit_cost      INTEGER NOT NULL DEFAULT 1,
  price            REAL,    -- drop-in price; NULL = credits only
  colour           TEXT DEFAULT '#2563EB',
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- TRAINING SESSIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_type_id  TEXT REFERENCES session_types(id) ON DELETE SET NULL,
  location_id      TEXT REFERENCES locations(id) ON DELETE SET NULL,
  coach_id         TEXT REFERENCES coach_profiles(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  session_date     TEXT NOT NULL,   -- ISO date YYYY-MM-DD
  start_time       TEXT NOT NULL,   -- HH:MM
  end_time         TEXT NOT NULL,   -- HH:MM
  capacity         INTEGER NOT NULL DEFAULT 10,
  booked_count     INTEGER NOT NULL DEFAULT 0,   -- denormalised for fast queries
  credit_cost      INTEGER NOT NULL DEFAULT 1,
  price            REAL,
  status           TEXT NOT NULL DEFAULT 'scheduled',  -- 'scheduled'|'cancelled'|'completed'
  notes            TEXT,
  is_recurring     INTEGER NOT NULL DEFAULT 0,
  recurrence_rule  TEXT,   -- iCal RRULE string if recurring
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_date        ON sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_coach_id    ON sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_location_id ON sessions(location_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status      ON sessions(status);

-- -----------------------------------------------------------------------------
-- PACKAGE DEFINITIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS package_definitions (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name                    TEXT NOT NULL,
  description             TEXT,
  credits                 INTEGER NOT NULL,
  price                   REAL NOT NULL,
  validity_months         INTEGER NOT NULL DEFAULT 3,
  eligible_session_types  TEXT,   -- JSON array of session_type_id, NULL = all
  eligible_locations      TEXT,   -- JSON array of location_id, NULL = all
  stripe_price_id         TEXT,
  active                  INTEGER NOT NULL DEFAULT 1,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- ORDERS  (parent record grouping one payment / purchase intent)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id             TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key       TEXT NOT NULL UNIQUE,  -- prevents duplicate submissions
  status                TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'paid'|'failed'|'cancelled'|'refunded'
  total_amount          REAL NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'EUR',
  stripe_session_id     TEXT,
  stripe_payment_intent TEXT,
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_client_id       ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session  ON orders(stripe_session_id);

-- -----------------------------------------------------------------------------
-- ORDER ITEMS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  order_id             TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type            TEXT NOT NULL,  -- 'session_booking' | 'package_purchase'
  session_id           TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  package_definition_id TEXT REFERENCES package_definitions(id) ON DELETE SET NULL,
  player_id            TEXT REFERENCES players(id) ON DELETE SET NULL,
  quantity             INTEGER NOT NULL DEFAULT 1,
  unit_price           REAL NOT NULL DEFAULT 0,
  credit_cost          INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_session_id ON order_items(session_id);

-- -----------------------------------------------------------------------------
-- BOOKINGS  (one per player per session)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  order_id         TEXT REFERENCES orders(id) ON DELETE SET NULL,
  client_id        TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  player_id        TEXT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  session_id       TEXT NOT NULL REFERENCES sessions(id) ON DELETE RESTRICT,
  status           TEXT NOT NULL DEFAULT 'pending_payment',
  -- 'pending_payment'|'confirmed'|'cancelled_by_client'|'cancelled_by_admin'
  -- |'attended'|'absent'|'rescheduled'|'payment_failed'
  payment_method   TEXT,   -- 'card' | 'credits'
  credits_used     INTEGER DEFAULT 0,
  amount_charged   REAL DEFAULT 0,
  booked_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  confirmed_at     TEXT,
  cancelled_at     TEXT,
  cancellation_reason TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (player_id, session_id)  -- no duplicate bookings for same player+session
);

CREATE INDEX IF NOT EXISTS idx_bookings_client_id  ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_player_id  ON bookings(player_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session_id ON bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_order_id   ON bookings(order_id);

-- -----------------------------------------------------------------------------
-- BOOKING AMENDMENTS  (immutable history of changes)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_amendments (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  booking_id       TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amended_by       TEXT NOT NULL REFERENCES users(id),
  amendment_type   TEXT NOT NULL,   -- 'reschedule' | 'cancel' | 'status_change' | 'note'
  previous_value   TEXT,            -- JSON snapshot of changed fields
  new_value        TEXT,            -- JSON snapshot of new values
  reason           TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_booking_amendments_booking_id ON booking_amendments(booking_id);

-- -----------------------------------------------------------------------------
-- ATTENDANCE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  booking_id  TEXT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'present',  -- 'present'|'absent'|'late'|'excused'
  recorded_by TEXT REFERENCES users(id),
  notes       TEXT,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_player_id  ON attendance(player_id);

-- -----------------------------------------------------------------------------
-- PACKAGE PURCHASES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS package_purchases (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id             TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id              TEXT REFERENCES orders(id) ON DELETE SET NULL,
  package_definition_id TEXT NOT NULL REFERENCES package_definitions(id),
  credits_granted       INTEGER NOT NULL,
  price_paid            REAL NOT NULL,
  valid_from            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at            TEXT NOT NULL,   -- calculated: valid_from + validity_months
  status                TEXT NOT NULL DEFAULT 'active',   -- 'active'|'exhausted'|'expired'|'refunded'
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_package_purchases_client_id ON package_purchases(client_id);
CREATE INDEX IF NOT EXISTS idx_package_purchases_expires   ON package_purchases(expires_at);

-- -----------------------------------------------------------------------------
-- CREDIT LEDGER  (immutable double-entry log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS credit_ledger (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id            TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type                 TEXT NOT NULL,
  -- 'purchase'|'usage'|'refund'|'expiry'|'admin_grant'|'admin_deduct'
  amount               INTEGER NOT NULL,   -- positive = credit in, negative = credit out
  balance_after        INTEGER NOT NULL,   -- snapshot of balance after this entry
  booking_id           TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  package_purchase_id  TEXT REFERENCES package_purchases(id) ON DELETE SET NULL,
  description          TEXT NOT NULL,
  expires_at           TEXT,              -- non-null for purchase entries
  performed_by         TEXT REFERENCES users(id),  -- for admin_grant / admin_deduct
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  -- NOTE: no updated_at — ledger rows are immutable by design
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_client_id ON credit_ledger(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_type      ON credit_ledger(type);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_expires   ON credit_ledger(expires_at);

-- -----------------------------------------------------------------------------
-- PAYMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  order_id                TEXT REFERENCES orders(id) ON DELETE SET NULL,
  client_id               TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount                  REAL NOT NULL,
  currency                TEXT NOT NULL DEFAULT 'EUR',
  status                  TEXT NOT NULL DEFAULT 'pending',
  -- 'pending'|'paid'|'failed'|'refunded'|'partial_refund'|'cancelled'
  stripe_payment_intent   TEXT,
  stripe_charge_id        TEXT,
  description             TEXT,
  reference               TEXT UNIQUE,   -- human-readable reference
  metadata                TEXT,          -- JSON
  paid_at                 TEXT,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_client_id      ON payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id       ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi      ON payments(stripe_payment_intent);
CREATE INDEX IF NOT EXISTS idx_payments_status         ON payments(status);

-- -----------------------------------------------------------------------------
-- REFUNDS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  payment_id            TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  amount                REAL NOT NULL,
  stripe_refund_id      TEXT,
  reason                TEXT,
  status                TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'succeeded'|'failed'
  performed_by          TEXT REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);

-- -----------------------------------------------------------------------------
-- NOTIFICATION TEMPLATES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_templates (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name          TEXT NOT NULL,
  event_trigger TEXT NOT NULL UNIQUE,
  -- 'booking_confirmed'|'booking_cancelled'|'session_reminder'|'payment_received'
  -- |'credit_expiry'|'password_reset'|'welcome'|'reschedule_confirmed'|'coach_assigned'
  subject       TEXT NOT NULL,
  body_html     TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS  (outbox / sent log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  template_id      TEXT REFERENCES notification_templates(id) ON DELETE SET NULL,
  channel          TEXT NOT NULL DEFAULT 'email',   -- 'email' | 'sms' | 'push'
  recipient_email  TEXT,
  subject          TEXT,
  body_html        TEXT,
  status           TEXT NOT NULL DEFAULT 'queued',  -- 'queued'|'sent'|'failed'
  error_message    TEXT,
  sent_at          TEXT,
  booking_id       TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  session_id       TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status  ON notifications(status);

-- -----------------------------------------------------------------------------
-- CONSENT RECORDS  (immutable GDPR/media consent log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consent_records (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  player_id    TEXT REFERENCES players(id) ON DELETE SET NULL,
  consent_type TEXT NOT NULL,   -- 'gdpr' | 'media' | 'medical' | 'marketing'
  granted      INTEGER NOT NULL DEFAULT 1,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  -- immutable — no updated_at
);

CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON consent_records(user_id);

-- -----------------------------------------------------------------------------
-- APPLICATION SETTINGS  (key/value store)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  data_type  TEXT NOT NULL DEFAULT 'string',   -- 'string'|'number'|'boolean'|'json'
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO app_settings (key, value, data_type) VALUES
  ('advance_booking_weeks',          '4',            'number'),
  ('package_validity_months',        '3',            'number'),
  ('cancellation_deadline_hours',    '24',           'number'),
  ('reschedule_deadline_hours',      '24',           'number'),
  ('credit_refund_on_cancellation',  'true',         'boolean'),
  ('currency',                       'EUR',          'string'),
  ('default_timezone',               'Europe/Malta', 'string'),
  ('default_session_capacity',       '10',           'number'),
  ('company_name',                   'Premier Performance GK', 'string'),
  ('contact_email',                  '',             'string'),
  ('contact_phone',                  '',             'string'),
  ('session_reminder_hours',         '24',           'number'),
  ('credit_expiry_reminder_days',    '14',           'number'),
  ('send_booking_confirmation',      'true',         'boolean'),
  ('send_session_reminders',         'true',         'boolean'),
  ('send_credit_expiry_reminders',   'true',         'boolean'),
  ('send_cancellation_emails',       'true',         'boolean');

-- -----------------------------------------------------------------------------
-- AUDIT LOG
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  actor_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_name     TEXT,
  action         TEXT NOT NULL,
  -- 'create'|'update'|'delete'|'cancel'|'override'|'payment'|'credit'|'login'|'logout'
  record_type    TEXT NOT NULL,   -- 'booking'|'session'|'user'|'payment'|'credit'|...
  record_id      TEXT,
  description    TEXT NOT NULL,
  previous_value TEXT,            -- JSON
  new_value      TEXT,            -- JSON
  reason         TEXT,
  ip_address     TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  -- immutable — no updated_at
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id    ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_type ON audit_log(record_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id   ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at  ON audit_log(created_at);
