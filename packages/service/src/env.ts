// ─── Hono Environment Types ───
// Shared by index.ts, middleware, and routes to avoid circular dependencies.

import type { DbAdapter } from "./db/interface";

export type AppEnv = {
  Bindings: {
    DB: D1Database;
    db: DbAdapter;
  };
  Variables: {
    /** SHA-256 hex hash of the authenticated API key */
    apiKeyHash: string;
  };
};
