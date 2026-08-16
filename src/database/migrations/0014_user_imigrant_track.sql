-- 0014_user_imigrant_track.sql
-- Add migration column to track users migrated from old database

ALTER TABLE users ADD COLUMN IF NOT EXISTS migration BOOLEAN NOT NULL DEFAULT FALSE;
