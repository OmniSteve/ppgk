-- =============================================================================
-- Premier Performance GK — Migration 0003
-- Adds emergency_contact_relationship to players so the Relationship field
-- captured on the client Create/Edit Player forms is persisted.
-- Run AFTER 0001_initial_schema.sql and 0002_additions.sql
-- =============================================================================

ALTER TABLE players ADD COLUMN emergency_contact_relationship TEXT;