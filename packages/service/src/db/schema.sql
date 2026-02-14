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
  submitted_at TEXT DEFAULT (datetime('now'))
);

-- Index for fast response queries by form
CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);
CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON responses(submitted_at);
