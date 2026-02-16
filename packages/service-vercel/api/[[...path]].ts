// ─── Vercel Edge API Catch-All ───
// Routes all /api/* requests to the Formant Hono app with Postgres backend.

import handler from "../src/index";

export const config = {
  runtime: "edge",
};

export default handler;
