import { cors } from "hono/cors";
import type { MiddlewareHandler } from "hono";

/**
 * CORS middleware that allows all origins including null.
 *
 * Forms can be opened from:
 * - A hosted URL (normal origin)
 * - A local HTML file (Origin: null)
 * - An email client's preview (varies)
 * - Claude's artifact preview (varies)
 *
 * Public endpoints (POST /api/responses/:formId) must allow any origin.
 * Management endpoints use API key auth instead of origin restriction.
 */
export function corsMiddleware(): MiddlewareHandler {
  return cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24 hours
  });
}
