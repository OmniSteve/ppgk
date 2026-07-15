-- =============================================================================
-- Premier Performance GK — Migration 0006
-- Session booking → coach roster selection workflow.
--
-- Adds an opt-in per-session booking mode: 'instant' (default, current
-- behaviour — unchanged) vs 'request' (players request a place; a coach
-- selects up to capacity; the rest sit in a backup pool).
--
-- No new booking-status column: bookings.status gains three new values used
-- only by request-mode sessions — 'pending' (awaiting coach decision,
-- distinct from the existing 'pending_payment' which means "Stripe not
-- completed yet"), 'backup', and 'declined'. Cancellation keeps using the
-- existing cancelled_by_client / cancelled_by_admin split.
--
-- attendance stays in its own table (already correctly separated) — this
-- migration also cleans up a bug where coach/attendance.js used to mirror
-- attendance marks onto bookings.status ('attended'/'absent'), overloading
-- it. That code path is being removed; this is the one-time data fix for
-- rows it already wrote. Narrow WHERE, safe to run more than once.
--
-- Run AFTER 0001_initial_schema.sql through 0005_player_account_holder.sql.
-- =============================================================================

ALTER TABLE sessions ADD COLUMN booking_mode TEXT NOT NULL DEFAULT 'instant';

UPDATE bookings SET status = 'confirmed', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE status IN ('attended', 'absent');

-- Notification templates for the new roster workflow (booking_confirmed and
-- booking_cancelled are reused as-is for promotion / roster removal).
INSERT OR IGNORE INTO notification_templates (id, name, event_trigger, subject, body_html, active) VALUES
  (lower(hex(randomblob(16))), 'Booking Request Received', 'booking_pending', 'Request received — {{session_title}}',
   '<p>Hi {{first_name}},</p><p>Your booking request for <strong>{{session_title}}</strong> on {{session_date}} at {{session_time}} has been received and is awaiting coach confirmation.</p><p>We will let you know as soon as a decision is made.</p>', 1),

  (lower(hex(randomblob(16))), 'Added to Backup List', 'booking_backup', 'You are on the backup list — {{session_title}}',
   '<p>Hi {{first_name}},</p><p><strong>{{session_title}}</strong> on {{session_date}} is currently full. You have been added to the backup list and may be contacted if a place becomes available.</p>', 1),

  (lower(hex(randomblob(16))), 'Booking Request Declined', 'booking_declined', 'Request update — {{session_title}}',
   '<p>Hi {{first_name}},</p><p>Unfortunately we were unable to offer you a place for <strong>{{session_title}}</strong> on {{session_date}}.</p><p>{{refund_note}}</p>', 1);
