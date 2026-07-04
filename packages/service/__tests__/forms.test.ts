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
  clientId?: string,
) {
  const body: Record<string, unknown> = { html, schema };
  if (clientId !== undefined) body.id = clientId;
  const res = await SELF.fetch("http://localhost/api/forms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
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

  it("assembles HTML server-side when only a schema is sent", async () => {
    const res = await SELF.fetch("http://localhost/api/forms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ schema: TEST_SCHEMA }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    const formId = body.id as string;

    // Stored HTML is a real assembled form
    const row = await getFormById(env.DB, formId);
    expect(row!.html).toContain("<!DOCTYPE html>");
    expect(row!.html).toContain("var __FORMANT_SCHEMA__");
    expect(row!.html).toContain("<title>Test Form</title>");

    // Stored schema gained a service destination pointing at this form
    const storedSchema = JSON.parse(row!.schema_json) as {
      submit: { destinations: { type: string; formId?: string }[] };
    };
    const service = storedSchema.submit.destinations.find((d) => d.type === "service");
    expect(service).toBeDefined();
    expect(service!.formId).toBe(formId);
    // Original destinations are preserved
    expect(storedSchema.submit.destinations.some((d) => d.type === "excel")).toBe(true);

    // And the public route serves it
    const page = await SELF.fetch(`http://localhost/f/${formId}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("var __FORMANT_SCHEMA__");
  });

  it("returns 400 for schema-only create with an invalid schema", async () => {
    const res = await SELF.fetch("http://localhost/api/forms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ schema: { id: "bad", title: "No fields" } }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(String(body.error)).toContain("Invalid schema");
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

  it("accepts client-provided id when valid (for deploy scripts)", async () => {
    const { res, body } = await createForm(API_KEY, TEST_SCHEMA, TEST_HTML, "my-form-1234");

    expect(res.status).toBe(201);
    expect(body.id).toBe("my-form-1234");
    expect(body.url).toBe("/f/my-form-1234");

    const row = await getFormById(env.DB, "my-form-1234");
    expect(row).not.toBeNull();
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

    expect(res.headers.get("Cache-Control")).toContain("stale-while-revalidate");
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

// ─── GET /api/forms/:id/qr ───

describe("GET /api/forms/:id/qr", () => {
  it("returns an SVG QR code for the form URL", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    const res = await SELF.fetch(`http://localhost/api/forms/${formId}/qr`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("image/svg+xml");
    const svg = await res.text();
    expect(svg).toContain("<svg");
    expect(svg).toContain("crispEdges");
    expect(svg).toContain("<rect");
  });

  it("returns 403 with wrong API key", async () => {
    const { body: createBody } = await createForm(API_KEY);
    const res = await SELF.fetch(`http://localhost/api/forms/${createBody.id}/qr`, {
      headers: { Authorization: `Bearer ${OTHER_API_KEY}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent form and 401 without auth", async () => {
    const missing = await SELF.fetch("http://localhost/api/forms/nonexistent1/qr", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(missing.status).toBe(404);

    const { body: createBody } = await createForm();
    const noAuth = await SELF.fetch(`http://localhost/api/forms/${createBody.id}/qr`);
    expect(noAuth.status).toBe(401);
  });
});

// ─── GET /api/forms (list) ───

describe("GET /api/forms", () => {
  it("lists only the caller's forms, newest first, without html/schema", async () => {
    const { body: a } = await createForm(API_KEY);
    const { body: b } = await createForm(API_KEY);
    await createForm(OTHER_API_KEY);

    const res = await SELF.fetch("http://localhost/api/forms", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { forms: Record<string, unknown>[] };
    expect(body.forms).toHaveLength(2);
    const ids = body.forms.map((f) => f.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);

    const form = body.forms[0]!;
    expect(form.title).toBe("Test Form");
    expect(form.url).toBe(`/f/${form.id}`);
    expect(form.view_count).toBe(0);
    expect(form.submit_count).toBe(0);
    expect(form.html).toBeUndefined();
    expect(form.schema).toBeUndefined();
  });

  it("returns an empty list for a key with no forms", async () => {
    const res = await SELF.fetch("http://localhost/api/forms", {
      headers: { Authorization: `Bearer ${OTHER_API_KEY}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { forms: unknown[] };
    expect(body.forms).toEqual([]);
  });

  it("returns 401 without auth", async () => {
    const res = await SELF.fetch("http://localhost/api/forms");
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/forms/:id ───

describe("GET /api/forms/:id", () => {
  it("returns schema and metadata for an owned form", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    const res = await SELF.fetch(`http://localhost/api/forms/${formId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(formId);
    expect(body.title).toBe("Test Form");
    expect(body.url).toBe(`/f/${formId}`);
    expect(body.schema).toEqual(TEST_SCHEMA);
    expect(body.created_at).toBeDefined();
    expect(body.html).toBeUndefined();
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await SELF.fetch("http://localhost/api/forms/nonexistent1", {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 with wrong API key", async () => {
    const { body: createBody } = await createForm(API_KEY);
    const res = await SELF.fetch(`http://localhost/api/forms/${createBody.id}`, {
      headers: { Authorization: `Bearer ${OTHER_API_KEY}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 401 without auth", async () => {
    const { body: createBody } = await createForm();
    const res = await SELF.fetch(`http://localhost/api/forms/${createBody.id}`);
    expect(res.status).toBe(401);
  });
});

// ─── PUT /api/forms/:id ───

describe("PUT /api/forms/:id", () => {
  const UPDATED_SCHEMA = {
    ...TEST_SCHEMA,
    title: "Updated Form",
  };

  function putForm(formId: string, body: unknown, apiKey: string = API_KEY) {
    return SELF.fetch(`http://localhost/api/forms/${formId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  }

  it("updates schema and html, refreshes title and updated_at", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    const res = await putForm(formId, {
      schema: UPDATED_SCHEMA,
      html: "<html><body>v2</body></html>",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(formId);
    expect(body.title).toBe("Updated Form");
    expect(body.url).toBe(`/f/${formId}`);

    const row = await getFormById(env.DB, formId);
    expect(row!.title).toBe("Updated Form");
    expect(row!.html).toBe("<html><body>v2</body></html>");
    expect(JSON.parse(row!.schema_json)).toEqual(UPDATED_SCHEMA);
  });

  it("updates html only, leaving schema untouched", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    const res = await putForm(formId, { html: "<html><body>v3</body></html>" });
    expect(res.status).toBe(200);

    const row = await getFormById(env.DB, formId);
    expect(row!.html).toBe("<html><body>v3</body></html>");
    expect(JSON.parse(row!.schema_json)).toEqual(TEST_SCHEMA);
    expect(row!.title).toBe("Test Form");
  });

  it("reassembles html server-side when only a schema is sent", async () => {
    const { body: createBody } = await createForm();
    const formId = createBody.id as string;

    const res = await putForm(formId, { schema: UPDATED_SCHEMA });
    expect(res.status).toBe(200);

    const row = await getFormById(env.DB, formId);
    expect(row!.title).toBe("Updated Form");
    expect(row!.html).toContain("<!DOCTYPE html>");
    expect(row!.html).toContain("<title>Updated Form</title>");

    const storedSchema = JSON.parse(row!.schema_json) as {
      submit: { destinations: { type: string; formId?: string }[] };
    };
    const service = storedSchema.submit.destinations.find((d) => d.type === "service");
    expect(service!.formId).toBe(formId);
  });

  it("returns 400 for schema-only update with an invalid schema", async () => {
    const { body: createBody } = await createForm();
    const res = await putForm(createBody.id as string, {
      schema: { id: "bad", title: "No fields" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when neither html nor schema is provided", async () => {
    const { body: createBody } = await createForm();
    const res = await putForm(createBody.id as string, {});
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-object schema", async () => {
    const { body: createBody } = await createForm();
    const res = await putForm(createBody.id as string, { schema: [1, 2] });
    expect(res.status).toBe(400);
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await putForm("nonexistent1", { html: "<html></html>" });
    expect(res.status).toBe(404);
  });

  it("returns 403 with wrong API key", async () => {
    const { body: createBody } = await createForm(API_KEY);
    const res = await putForm(createBody.id as string, { html: "<html></html>" }, OTHER_API_KEY);
    expect(res.status).toBe(403);
  });

  it("returns 401 without auth", async () => {
    const { body: createBody } = await createForm();
    const res = await SELF.fetch(`http://localhost/api/forms/${createBody.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: "<html></html>" }),
    });
    expect(res.status).toBe(401);
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
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
  });
});
