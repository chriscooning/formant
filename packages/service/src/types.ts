// ─── Hono Environment Types ───
// Shared across index.ts, middleware, and routes

import type { DbAdapter } from "./db/interface";

export type Bindings = {
  /** D1 database (Cloudflare only; used to construct D1Adapter) */
  DB?: D1Database;
  db: DbAdapter;
  /** Google OAuth for Connect Google Sheet (optional) */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Anthropic API key for Create with AI in the workspace (optional) */
  ANTHROPIC_API_KEY?: string;
  /** Override the Claude model used for form generation (optional) */
  ANTHROPIC_MODEL?: string;
};

export type Variables = {
  apiKeyHash: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
