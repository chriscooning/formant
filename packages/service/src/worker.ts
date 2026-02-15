// ─── Cloudflare Worker Entry Point ───
// Injects D1Adapter into env so routes use the adapter interface.

import app from "./index";
import { D1Adapter } from "./db/d1-adapter";

export default {
  async fetch(
    request: Request,
    env: { DB: D1Database },
    ctx: ExecutionContext,
  ) {
    const envWithDb = {
      ...env,
      db: new D1Adapter(env.DB),
    };
    return app.fetch(request, envWithDb, ctx);
  },
};
