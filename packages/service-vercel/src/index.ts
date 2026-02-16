// ─── Vercel Edge Entry ───
// Creates the Hono app with PostgresAdapter and exports for Vercel.

import app from "@formant/service";
import { PostgresAdapter } from "./db/postgres";

const db = new PostgresAdapter();

export function createHandler() {
  return async (
    req: Request,
    ctx?: { waitUntil?: (p: Promise<unknown>) => void },
  ) => {
    const env = {
      db,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    };
    const executionCtx: ExecutionContext = ctx
      ? {
          waitUntil: ctx.waitUntil ?? ((_p: Promise<unknown>) => {}),
          passThroughOnException: () => {},
          props: {},
        }
      : {
          waitUntil: (_p: Promise<unknown>) => {},
          passThroughOnException: () => {},
          props: {},
        };
    return app.fetch(req, env, executionCtx);
  };
}

export default createHandler();
