// ─── Hono Environment Types ───
// Shared by index.ts, middleware, and routes to avoid circular dependencies.

export type AppEnv = {
  Bindings: {
    DB: D1Database;
  };
  Variables: {
    /** SHA-256 hex hash of the authenticated API key */
    apiKeyHash: string;
  };
};
