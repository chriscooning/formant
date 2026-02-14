// ─── Hono Environment Types ───
// Shared across index.ts, middleware, and routes

export type Bindings = {
  DB: D1Database;
};

export type Variables = {
  apiKeyHash: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
