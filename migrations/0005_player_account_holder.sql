-- =============================================================================
-- Premier Performance GK — Migration 0005
-- Adds is_account_holder to players: marks the player profile that is
-- automatically created for a client at registration time (the client's own
-- profile, as opposed to profiles they add for children/other players).
--
-- A partial unique index enforces at most one account-holder player per
-- client_id, preventing duplicates from registration retries or races.
--
-- Run AFTER 0001_initial_schema.sql through 0004_player_performance.sql.
-- =============================================================================

ALTER TABLE players ADD COLUMN is_account_holder INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_one_account_holder_per_client
  ON players(client_id) WHERE is_account_holder = 1;
