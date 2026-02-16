// ─── Vercel Edge /f/* Route ───
// Serves form HTML at /f/:id (same handler as API).

import handler from "../src/index";

export const config = {
  runtime: "edge",
};

export default handler;
