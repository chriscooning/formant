-- Migration: Add status and session_id to responses for partial fills
-- Run: wrangler d1 execute formant-db --remote --file=src/db/migrations/001_add_status_session.sql

-- Add status column (SQLite applies DEFAULT to existing rows when adding)
ALTER TABLE responses ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';

-- Add session_id for partials (nullable for legacy)
ALTER TABLE responses ADD COLUMN session_id TEXT;

-- Add updated_at for last activity
ALTER TABLE responses ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(status);
CREATE INDEX IF NOT EXISTS idx_responses_session_id ON responses(session_id);
