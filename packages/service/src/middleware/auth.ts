import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";

/**
 * Hash an API key with SHA-256 using the Web Crypto API.
 * Returns a lowercase hex string (64 chars).
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Extract a Bearer token from the Authorization header.
 * Returns null if no valid Bearer token is found.
 */
export function extractBearerToken(c: Context<AppEnv>): string | null {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

/**
 * Middleware that requires a Bearer token in the Authorization header.
 * Hashes the token with SHA-256 and stores it in context variables
 * for downstream handlers to compare against the form's stored hash.
 *
 * Returns 401 if no valid token is present.
 */
export function requireAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = extractBearerToken(c);
    if (!token) {
      return c.json({ error: "Authorization required" }, 401);
    }
    const hash = await hashApiKey(token);
    c.set("apiKeyHash", hash);
    await next();
  };
}
