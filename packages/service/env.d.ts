/// <reference types="@cloudflare/vitest-pool-workers" />

declare module "cloudflare:test" {
  // ProvidedEnv controls the type of `env` when imported from "cloudflare:test".
  // Must match the bindings in wrangler.toml.
  interface ProvidedEnv {
    DB: D1Database;
  }
}
