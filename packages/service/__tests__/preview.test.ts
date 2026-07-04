import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const API_KEY = "test-api-key-12345";

const TEST_SCHEMA = {
  id: "preview-form",
  title: "Preview Form",
  fields: [
    { id: "welcome", type: "welcome", title: "Welcome" },
    { id: "name", type: "text", title: "Your name", required: true },
    { id: "end", type: "ending", title: "Thanks!" },
  ],
  submit: { destinations: [{ type: "excel" }] },
};

function postPreview(body: unknown, apiKey: string | null = API_KEY) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return SELF.fetch("http://localhost/api/preview", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// ─── POST /api/preview ───

describe("POST /api/preview", () => {
  it("assembles form HTML from a schema without persisting anything", async () => {
    const res = await postPreview({ schema: TEST_SCHEMA });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const html = await res.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("var __FORMANT_SCHEMA__");
    expect(html).toContain("<title>Preview Form</title>");
    expect(html).toContain('"preview-form"');
  });

  it("returns 400 with validation messages for an invalid schema", async () => {
    const res = await postPreview({ schema: { id: "bad", title: "Bad" } });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(String(body.error)).toContain("Invalid schema");
  });

  it("returns 400 when schema is missing", async () => {
    const res = await postPreview({});
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await postPreview({ schema: TEST_SCHEMA }, null);
    expect(res.status).toBe(401);
  });
});
