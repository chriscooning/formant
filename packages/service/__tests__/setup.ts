import { env } from "cloudflare:test";
import { beforeAll } from "vitest";

/**
 * Apply the D1 schema before all tests.
 * With isolatedStorage (default: true), each test gets a fresh copy
 * of the database state after this beforeAll — tables exist but are empty.
 *
 * Note: D1's exec() can have issues with multiple statements in the test
 * environment, so we use batch() with individual prepared statements.
 */
beforeAll(async () => {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS forms (
        id TEXT PRIMARY KEY,
        title TEXT,
        html TEXT NOT NULL,
        schema_json TEXT NOT NULL,
        api_key_hash TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        view_count INTEGER DEFAULT 0,
        submit_count INTEGER DEFAULT 0
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS responses (
        id TEXT PRIMARY KEY,
        form_id TEXT NOT NULL REFERENCES forms(id),
        answers_json TEXT NOT NULL,
        metadata_json TEXT,
        submitted_at TEXT DEFAULT (datetime('now'))
      )
    `),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id)",
    ),
    env.DB.prepare(
      "CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON responses(submitted_at)",
    ),
  ]);
});
