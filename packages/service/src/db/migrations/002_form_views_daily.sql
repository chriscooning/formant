-- Migration: Add form_views_daily for analytics chart
-- Run: wrangler d1 execute formant-db --remote --file=src/db/migrations/002_form_views_daily.sql

CREATE TABLE IF NOT EXISTS form_views_daily (
  form_id TEXT NOT NULL,
  date TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (form_id, date),
  FOREIGN KEY (form_id) REFERENCES forms(id)
);
CREATE INDEX IF NOT EXISTS idx_form_views_daily_form_date ON form_views_daily(form_id, date);
