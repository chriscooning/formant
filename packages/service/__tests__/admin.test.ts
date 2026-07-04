import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

// ─── GET /admin — Workspace UI ───

describe("GET /admin", () => {
  it("serves the workspace page without auth", async () => {
    const res = await SELF.fetch("http://localhost/admin");

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("is not cached (workspace ships updates immediately)", async () => {
    const res = await SELF.fetch("http://localhost/admin");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("contains the login and workspace views", async () => {
    const res = await SELF.fetch("http://localhost/admin");
    const html = await res.text();

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('id="view-login"');
    expect(html).toContain('id="view-workspace"');
    expect(html).toContain('id="form-list"');
    // Talks to the W1 list endpoint with a Bearer token
    expect(html).toContain('fetch("/api/forms"');
    expect(html).toContain("Bearer ");
  });
});
