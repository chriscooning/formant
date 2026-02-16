/**
 * Smoke tests for the Vercel Edge handler.
 * Verifies the handler can serve requests without a real Postgres (health check doesn't use DB).
 */
import { describe, it, expect } from "vitest";
import handler from "../src/index";

describe("Vercel Edge handler", () => {
  it("GET /api/health returns 200", async () => {
    const res = await handler(
      new Request("http://localhost/api/health"),
      { waitUntil: async () => {} },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});
