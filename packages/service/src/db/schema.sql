-- Formant D1 Database Schema
-- Phase 3A: Forms and responses tables

-- Forms table: stores the HTML and metadata
CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,                     -- nanoid, 12 chars
  title TEXT,
  html TEXT NOT NULL,                      -- The complete HTML string
  schema_json TEXT NOT NULL,               -- The FormSchema JSON (for export/inspection)
  api_key_hash TEXT,                       -- SHA-256 of creator's API key (for management)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  view_count INTEGER DEFAULT 0,
  submit_count INTEGER DEFAULT 0
);

-- Responses table: stores individual form submissions
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,                     -- nanoid, 16 chars
  form_id TEXT NOT NULL REFERENCES forms(id),
  answers_json TEXT NOT NULL,              -- The answers object as JSON
  metadata_json TEXT,                      -- User agent, duration, etc.
  submitted_at TEXT DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'completed', -- 'in_progress' | 'completed'
  session_id TEXT,                         -- For partials (session-based upsert)
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for fast response queries by form
CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);
CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON responses(submitted_at);
CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(status);
CREATE INDEX IF NOT EXISTS idx_responses_session_id ON responses(session_id);

-- Daily view counts for analytics chart (Phase 7)
CREATE TABLE IF NOT EXISTS form_views_daily (
  form_id TEXT NOT NULL,
  date TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (form_id, date),
  FOREIGN KEY (form_id) REFERENCES forms(id)
);
CREATE INDEX IF NOT EXISTS idx_form_views_daily_form_date ON form_views_daily(form_id, date);
