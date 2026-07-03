-- =============================================================================
-- Premier Performance GK — Migration 0002
-- Adds: stripe_events idempotency table, sessions eligibility columns,
--       notifications idempotency_ref, sessions booking window columns,
--       sessions age_group / ability_level columns,
--       orders stripe_charge_id, additional indexes.
-- Run AFTER 0001_initial_schema.sql
-- =============================================================================

-- Stripe webhook idempotency table
CREATE TABLE IF NOT EXISTS stripe_events (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  processed_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(stripe_event_id);

-- Session eligibility / booking window columns
ALTER TABLE sessions ADD COLUMN age_group         TEXT;
ALTER TABLE sessions ADD COLUMN ability_level      TEXT;
ALTER TABLE sessions ADD COLUMN booking_open_at    TEXT;   -- ISO datetime; NULL = immediately
ALTER TABLE sessions ADD COLUMN booking_close_at   TEXT;   -- ISO datetime; NULL = no cutoff
ALTER TABLE sessions ADD COLUMN published          INTEGER NOT NULL DEFAULT 1;

-- Notification idempotency
ALTER TABLE notifications ADD COLUMN idempotency_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_notifications_idempotency ON notifications(idempotency_ref);

-- Charge ID on orders for refund matching
ALTER TABLE orders ADD COLUMN stripe_charge_id TEXT;

-- Credit ledger: link deduction to originating purchase ledger row (for FIFO tracking)
-- (package_purchase_id already exists — this adds index for FIFO queries)
CREATE INDEX IF NOT EXISTS idx_credit_ledger_booking_type
  ON credit_ledger(booking_id, type);

-- Package purchases: track per-purchase remaining credits in a denormalised column
-- (source of truth is still the ledger; this is a cache for fast queries)
ALTER TABLE package_purchases ADD COLUMN credits_remaining INTEGER;

-- Update existing rows to set credits_remaining = credits_granted
UPDATE package_purchases SET credits_remaining = credits_granted WHERE credits_remaining IS NULL;

-- Bookings: idempotency key per booking (used in admin creation path)
ALTER TABLE bookings ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency
  ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Sessions: add composite index for available sessions query
CREATE INDEX IF NOT EXISTS idx_sessions_date_status
  ON sessions(session_date, status, published);

-- Coach performance: index sessions by coach+date for dashboard queries
CREATE INDEX IF NOT EXISTS idx_sessions_coach_date
  ON sessions(coach_id, session_date);

-- Notification delivery log: composite for deduplication checks
CREATE INDEX IF NOT EXISTS idx_notifications_user_trigger
  ON notifications(user_id, idempotency_ref);

-- App settings: ensure data_type column exists (safety check)
-- (no-op if already exists — SQLite will reject duplicate column ALTER)
-- ALTER TABLE app_settings ADD COLUMN data_type TEXT NOT NULL DEFAULT 'string';
-- (already present in 0001 — commented out to avoid error)

-- Default notification templates
INSERT OR IGNORE INTO notification_templates (id, name, event_trigger, subject, body_html, active) VALUES
  (lower(hex(randomblob(16))), 'Booking Confirmed',       'booking_confirmed',    'Your booking is confirmed — {{session_title}}',
   '<p>Hi {{first_name}},</p><p>Your booking for <strong>{{session_title}}</strong> on {{session_date}} at {{session_time}} is confirmed.</p><p>See you on the pitch!</p>', 1),

  (lower(hex(randomblob(16))), 'Booking Cancelled',       'booking_cancelled',    'Booking cancelled — {{session_title}}',
   '<p>Hi {{first_name}},</p><p>Your booking for <strong>{{session_title}}</strong> on {{session_date}} has been cancelled.</p><p>{{refund_note}}</p>', 1),

  (lower(hex(randomblob(16))), 'Reschedule Confirmed',    'reschedule_confirmed', 'Booking rescheduled — {{new_session_title}}',
   '<p>Hi {{first_name}},</p><p>Your booking has been rescheduled to <strong>{{new_session_title}}</strong> on {{new_session_date}} at {{new_session_time}}.</p>', 1),

  (lower(hex(randomblob(16))), 'Session Reminder',        'session_reminder',     'Reminder: {{session_title}} tomorrow',
   '<p>Hi {{first_name}},</p><p>This is a reminder that <strong>{{player_name}}</strong> has a session: <strong>{{session_title}}</strong> on {{session_date}} at {{session_time}} at {{location}}.</p>', 1),

  (lower(hex(randomblob(16))), 'Payment Received',        'payment_received',     'Payment received — {{package_name}}',
   '<p>Hi {{first_name}},</p><p>Payment received for <strong>{{package_name}}</strong>. {{credits}} credits have been added to your account and expire on {{expires_at}}.</p>', 1),

  (lower(hex(randomblob(16))), 'Payment Failed',          'payment_failed',       'Payment failed',
   '<p>Hi {{first_name}},</p><p>Unfortunately your payment could not be processed. Please try again or contact us.</p>', 1),

  (lower(hex(randomblob(16))), 'Credit Expiry Reminder',  'credit_expiry',        '{{credits}} credits expiring on {{expires_at}}',
   '<p>Hi {{first_name}},</p><p>You have <strong>{{credits}} credits</strong> from your <strong>{{package_name}}</strong> package expiring on {{expires_at}}. Book a session to use them!</p>', 1),

  (lower(hex(randomblob(16))), 'Email Verification',      'verify_email',         'Please verify your email address',
   '<p>Hi {{first_name}},</p><p>Click the link below to verify your email address:</p><p><a href="{{verify_url}}">Verify Email</a></p><p>This link expires in 24 hours.</p>', 1),

  (lower(hex(randomblob(16))), 'Password Reset',          'password_reset',       'Reset your password',
   '<p>Hi,</p><p>Click the link below to reset your password:</p><p><a href="{{reset_url}}">Reset Password</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p>', 1),

  (lower(hex(randomblob(16))), 'Session Cancelled',       'session_cancelled',    'Session cancelled — {{session_title}}',
   '<p>Hi {{first_name}},</p><p>Unfortunately <strong>{{session_title}}</strong> on {{session_date}} has been cancelled. {{credit_note}}</p><p>We apologise for any inconvenience.</p>', 1);