-- Migration: OAuth sessions for Connect Google Sheet flow
-- Run: wrangler d1 execute formant-db --remote --file=src/db/migrations/003_oauth_sessions.sql

CREATE TABLE IF NOT EXISTS oauth_sessions (
  state TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_created_at ON oauth_sessions(created_at);
