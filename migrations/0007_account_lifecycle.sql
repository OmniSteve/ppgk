-- =============================================================================
-- Premier Performance GK — Account & Profile Lifecycle Management
-- Migration: 0007_account_lifecycle.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USERS — deactivate/reactivate audit trail (active flag already exists)
-- -----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN disabled_at TEXT;
ALTER TABLE users ADD COLUMN disabled_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN disabled_reason TEXT;
ALTER TABLE users ADD COLUMN reactivated_at TEXT;
ALTER TABLE users ADD COLUMN reactivated_by TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- -----------------------------------------------------------------------------
-- PLAYERS — deactivate/reactivate audit trail (status flag already exists)
-- -----------------------------------------------------------------------------
ALTER TABLE players ADD COLUMN inactive_at TEXT;
ALTER TABLE players ADD COLUMN inactive_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE players ADD COLUMN inactive_reason TEXT;
ALTER TABLE players ADD COLUMN reactivated_at TEXT;
ALTER TABLE players ADD COLUMN reactivated_by TEXT REFERENCES users(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- COACH PROFILES — deactivate/reactivate audit trail (active flag already exists)
-- -----------------------------------------------------------------------------
ALTER TABLE coach_profiles ADD COLUMN inactive_at TEXT;
ALTER TABLE coach_profiles ADD COLUMN inactive_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE coach_profiles ADD COLUMN inactive_reason TEXT;
ALTER TABLE coach_profiles ADD COLUMN reactivated_at TEXT;
ALTER TABLE coach_profiles ADD COLUMN reactivated_by TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coach_profiles_active ON coach_profiles(active);
