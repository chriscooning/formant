import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { assembleHostedFormHTML } from "../utils/assemble-form";

const previewApp = new Hono<AppEnv>();

// ─── POST /api/preview — Assemble form HTML from a schema (auth required) ───
// Nothing is persisted: the workspace editor posts the in-progress schema
// and renders the returned HTML in its preview iframe.

previewApp.post("/api/preview", requireAuth(), async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { schema } = body;
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return c.json({ error: "schema is required and must be an object" }, 400);
  }

  let html: string;
  try {
    html = assembleHostedFormHTML(schema);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Invalid schema" }, 400);
  }

  return c.html(html, 200, { "Cache-Control": "no-store" });
});

export { previewApp };
