-- =============================================================================
-- Premier Performance GK — Migration 0004
-- Adds player_performance: coach/admin-recorded goalkeeper performance
-- evaluations for a player, optionally linked to a booking/session.
-- Run AFTER 0001_initial_schema.sql (players, users, bookings, sessions).
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_performance (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  player_id             TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  client_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id            TEXT REFERENCES bookings(id) ON DELETE SET NULL,
  session_id            TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  created_by            TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  evaluation_date       TEXT NOT NULL,
  overall_rating        INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  handling_rating       INTEGER NOT NULL CHECK (handling_rating BETWEEN 1 AND 5),
  diving_rating         INTEGER NOT NULL CHECK (diving_rating BETWEEN 1 AND 5),
  footwork_rating       INTEGER NOT NULL CHECK (footwork_rating BETWEEN 1 AND 5),
  distribution_rating   INTEGER NOT NULL CHECK (distribution_rating BETWEEN 1 AND 5),
  communication_rating  INTEGER NOT NULL CHECK (communication_rating BETWEEN 1 AND 5),
  attitude_rating       INTEGER NOT NULL CHECK (attitude_rating BETWEEN 1 AND 5),
  strengths             TEXT,
  areas_to_improve      TEXT,
  coach_notes           TEXT,
  recommended_focus     TEXT,
  is_visible_to_client  INTEGER NOT NULL DEFAULT 1,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_player_performance_player_id   ON player_performance(player_id);
CREATE INDEX IF NOT EXISTS idx_player_performance_client_id   ON player_performance(client_id);
CREATE INDEX IF NOT EXISTS idx_player_performance_eval_date   ON player_performance(evaluation_date);
CREATE INDEX IF NOT EXISTS idx_player_performance_created_by  ON player_performance(created_by);
CREATE INDEX IF NOT EXISTS idx_player_performance_booking_id  ON player_performance(booking_id);
CREATE INDEX IF NOT EXISTS idx_player_performance_session_id  ON player_performance(session_id);
