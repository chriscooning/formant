-- Formant Postgres Schema (mirrors D1)
-- Run via: vercel postgres db execute < schema.sql
-- Or: psql $POSTGRES_URL -f schema.sql

CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  title TEXT,
  html TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  api_key_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INTEGER DEFAULT 0,
  submit_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published'
);

CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  answers_json TEXT NOT NULL,
  metadata_json TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed',
  session_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);
CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON responses(submitted_at);
CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(status);
CREATE INDEX IF NOT EXISTS idx_responses_session_id ON responses(session_id);

CREATE TABLE IF NOT EXISTS form_views_daily (
  form_id TEXT NOT NULL,
  date DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (form_id, date),
  FOREIGN KEY (form_id) REFERENCES forms(id)
);
CREATE INDEX IF NOT EXISTS idx_form_views_daily_form_date ON form_views_daily(form_id, date);

CREATE TABLE IF NOT EXISTS oauth_sessions (
  state TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_created_at ON oauth_sessions(created_at);
