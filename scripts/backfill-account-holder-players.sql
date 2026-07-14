-- =============================================================================
-- Premier Performance GK — one-time backfill
-- Creates an account-holder player profile for existing client users who
-- currently have zero player records (accounts created before migration
-- 0005_player_account_holder.sql introduced automatic player creation).
--
-- Safe to run multiple times: a client is only touched while they have
-- zero players, so once backfilled (or once they create/have any player
-- themselves) this becomes a no-op. Existing player rows are never modified.
--
-- Run AFTER migrations/0005_player_account_holder.sql has been applied.
--
-- Usage (dev):
--   npx wrangler d1 execute ppgk-dev --remote --file=scripts/backfill-account-holder-players.sql
-- Usage (production):
--   npx wrangler d1 execute ppgk --remote --file=scripts/backfill-account-holder-players.sql
-- (drop --remote to dry-run against the local/dev-only D1 shadow copy first)
-- =============================================================================

INSERT INTO players (id, client_id, first_name, last_name, status, is_account_holder)
SELECT lower(hex(randomblob(16))), u.id, u.first_name, u.last_name, 'active', 1
FROM users u
WHERE u.role = 'client'
  AND u.active = 1
  AND NOT EXISTS (SELECT 1 FROM players p WHERE p.client_id = u.id);
