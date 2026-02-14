import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getFormById } from "../src/db/queries";
import { hashApiKey } from "../src/middleware/auth";

const API_KEY = "test-api-key-12345";
const OTHER_API_KEY = "other-api-key-99999";

const TEST_SCHEMA = {
  id: "test-form",
  title: "Test Form",
  fields: [
    { id: "welcome", type: "welcome", title: "Welcome" },
    { id: "name", type: "text", title: "Your name", required: true },
    { id: "end", type: "ending", title: "Thanks!" },
  ],
  submit: { destinations: [{ type: "excel" }] },
};

const TEST_HTML = "<html><body><div id='root'></div></body></html>";

/** Helper: create a form via the API and return the parsed response body. */
async function createForm(
  apiKey: string = API_KEY,
  schema: object = TEST_SCHEMA,
  html: string = TEST_HTML,
) {
  const res = await SELF.fetch("http://localhost/api/forms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ html, schema }),
  });
  return { res, body: (await res.json()) as Record<string, unknown> };
}

// ─── POST /api/forms ───

describe("POST /api/forms", () => {
  it("creates a form and returns id + url", async () => {
    const { res, body } = await createForm();

    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe("string");
    expect((body.id as string).length).toBe(12);
    expect(body.url).toBe(`/f/${body.id}`);
    expect(body.created_at).toBeDefined();
  });

  it("stores the form in D1 with correct data", async () => {
    const { body } = await createForm();
    const formId = body.id as string;

    const row = await getFormById(env.DB, formId);
    expect(row).not.toBeNull();
    expect(row!.title).toBe("Test Form");
    expect(row!.html).toBe(TEST_HTML);
    expect(JSON.parse(row!.schema_json)).toEqual(TEST_SCHEMA);

    // Verify API key hash was stored
    const expectedHash = await hashApiKey(API_KEY);
    expect(row!.api_key_hash).toBe(expectedHash);
  });

  it("returns 401 without Authorization header", async () => {
    const res = await SELF.fetch("http://localhost/api/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: TEST_HTML, schema: TEST_SCHEMA }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
  });

  it("returns 400 for missing html", async () => {
    const res = await SELF.fetch("http://localhost/api/forms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ schema: TEST_SCHEMA }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for missing schema", async () => {
    const res = await SELF.fetch("http://localhost/api/forms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ html: TEST_HTML }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await SELF.fetch("http://localhost/api/forms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: "not json",
    });

    expect(res.status).toBe(400);
  });
});

// ─── GET /f/:id ───

describe("GET /f/:id", () => {
  it("serves form HTML with correct content type", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    const res = await SELF.fetch(`http://localhost/f/${formId}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toBe(TEST_HTML);
  });

  it("returns cache-control headers", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    const res = await SELF.fetch(`http://localhost/f/${formId}`);

    expect(res.headers.get("Cache-Control")).toContain(
      "stale-while-revalidate",
    );
  });

  it("increments view count", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    // Fetch the form twice
    await SELF.fetch(`http://localhost/f/${formId}`);
    await SELF.fetch(`http://localhost/f/${formId}`);

    // Give waitUntil a moment to complete
    await new Promise((r) => setTimeout(r, 100));

    const row = await getFormById(env.DB, formId);
    expect(row!.view_count).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await SELF.fetch("http://localhost/f/nonexistent1");

    expect(res.status).toBe(404);
  });

  it("does not require authentication", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    // No auth header
    const res = await SELF.fetch(`http://localhost/f/${formId}`);
    expect(res.status).toBe(200);
  });
});

// ─── DELETE /api/forms/:id ───

describe("DELETE /api/forms/:id", () => {
  it("deletes a form and returns success", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    const res = await SELF.fetch(`http://localhost/api/forms/${formId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);

    // Verify it's gone
    const row = await getFormById(env.DB, formId);
    expect(row).toBeNull();
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await SELF.fetch("http://localhost/api/forms/nonexistent1", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    const res = await SELF.fetch(`http://localhost/api/forms/${formId}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(401);
  });

  it("returns 403 with wrong API key", async () => {
    const { body: createBody } = await createForm(API_KEY);
    const formId = createBody.id as string;

    const res = await SELF.fetch(`http://localhost/api/forms/${formId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${OTHER_API_KEY}` },
    });

    expect(res.status).toBe(403);
  });

  it("GET /f/:id returns 404 after deletion", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    // Delete
    await SELF.fetch(`http://localhost/api/forms/${formId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    // Try to fetch
    const res = await SELF.fetch(`http://localhost/f/${formId}`);
    expect(res.status).toBe(404);
  });
});

// ─── CORS ───

describe("CORS headers", () => {
  it("includes CORS headers on API responses", async () => {
    const res = await SELF.fetch("http://localhost/api/health");

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("handles OPTIONS preflight", async () => {
    const res = await SELF.fetch("http://localhost/api/forms", {
      method: "OPTIONS",
      headers: {
        Origin: "http://example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
      "Content-Type",
    );
  });
});
