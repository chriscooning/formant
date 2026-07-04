/**
 * Shared API tests for service-vercel.
 * Runs against the Hono app with MemoryAdapter to achieve parity with Cloudflare test matrix.
 * Tests: auth, forms, responses, analytics, xlsx, csv, CORS, DELETE.
 */
import { describe, it, expect, beforeEach } from "vitest";
import app, { hashApiKey } from "@formant/service";
import { MemoryAdapter } from "./memory-adapter";

const API_KEY = "test-api-key-12345";
const OTHER_API_KEY = "other-api-key-99999";

const TEST_SCHEMA = {
  id: "test-form",
  title: "Test Form",
  fields: [
    { id: "welcome", type: "welcome", title: "Welcome" },
    { id: "name", type: "text", title: "Your Name", required: true },
    { id: "rating", type: "rating", title: "Rating", max: 5 },
    { id: "end", type: "ending", title: "Thanks!" },
  ],
  submit: { destinations: [{ type: "excel" }] },
};

const TEST_HTML = "<html><body><div id='root'></div></body></html>";

const executionCtx: ExecutionContext = {
  waitUntil: (p: Promise<unknown>) => {
    p.catch(() => {});
  },
  passThroughOnException: () => {},
  props: {},
};

function createEnv(db: MemoryAdapter) {
  return {
    db,
    GOOGLE_CLIENT_ID: undefined as string | undefined,
    GOOGLE_CLIENT_SECRET: undefined as string | undefined,
  };
}

async function fetchApp(
  url: string,
  options: RequestInit = {},
  db: MemoryAdapter,
): Promise<Response> {
  return app.fetch(new Request(url, options), createEnv(db), executionCtx);
}

// ─── Helpers ───

async function createForm(
  db: MemoryAdapter,
  apiKey: string = API_KEY,
  schema: object = TEST_SCHEMA,
  html: string = TEST_HTML,
  clientId?: string,
) {
  const body: Record<string, unknown> = { html, schema };
  if (clientId !== undefined) body.id = clientId;
  const res = await fetchApp(
    "http://localhost/api/forms",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    db,
  );
  return { res, body: (await res.json()) as Record<string, unknown> };
}

async function submitResponse(
  db: MemoryAdapter,
  formId: string,
  answers: Record<string, unknown> = {},
  metadata?: Record<string, unknown>,
  status: "in_progress" | "completed" = "completed",
) {
  const body: Record<string, unknown> = {
    formId,
    submittedAt: new Date().toISOString(),
    answers,
    status,
  };
  if (metadata) body.metadata = metadata;

  const res = await fetchApp(
    `http://localhost/api/responses/${formId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    db,
  );
  return {
    res,
    body: (await res.json()) as Record<string, unknown>,
  };
}

// ─── Auth ───

describe("Auth (hash, verify)", () => {
  it("hashes API key to 64-char hex", async () => {
    const hash = await hashApiKey("my-secret-key");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces consistent hashes", async () => {
    const h1 = await hashApiKey("test-key");
    const h2 = await hashApiKey("test-key");
    expect(h1).toBe(h2);
  });
});

// ─── POST /api/forms ───

describe("POST /api/forms", () => {
  let db: MemoryAdapter;

  beforeEach(() => {
    db = new MemoryAdapter();
  });

  it("creates a form and returns id + url", async () => {
    const { res, body } = await createForm(db);

    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe("string");
    expect((body.id as string).length).toBe(12);
    expect(body.url).toBe(`/f/${body.id}`);
    expect(body.created_at).toBeDefined();
  });

  it("stores the form with correct data", async () => {
    const { body } = await createForm(db);
    const formId = body.id as string;

    const form = await db.getFormById(formId);
    expect(form).not.toBeNull();
    expect(form!.title).toBe("Test Form");
    expect(form!.html).toBe(TEST_HTML);
    expect(JSON.parse(form!.schema_json)).toEqual(TEST_SCHEMA);

    const expectedHash = await hashApiKey(API_KEY);
    expect(form!.api_key_hash).toBe(expectedHash);
  });

  it("returns 401 without Authorization header", async () => {
    const res = await fetchApp(
      "http://localhost/api/forms",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: TEST_HTML, schema: TEST_SCHEMA }),
      },
      db,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBeDefined();
  });

  it("assembles HTML server-side when only a schema is sent", async () => {
    const res = await fetchApp(
      "http://localhost/api/forms",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ schema: TEST_SCHEMA }),
      },
      db,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    const stored = await db.getFormById(body.id as string);
    expect(stored!.html).toContain("<!DOCTYPE html>");
    expect(stored!.html).toContain("var __FORMANT_SCHEMA__");
    const storedSchema = JSON.parse(stored!.schema_json) as {
      submit: { destinations: { type: string; formId?: string }[] };
    };
    expect(storedSchema.submit.destinations.find((d) => d.type === "service")?.formId).toBe(
      body.id,
    );
  });

  it("returns 400 for missing schema", async () => {
    const res = await fetchApp(
      "http://localhost/api/forms",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ html: TEST_HTML }),
      },
      db,
    );

    expect(res.status).toBe(400);
  });

  it("accepts client-provided id when valid", async () => {
    const { res, body } = await createForm(db, API_KEY, TEST_SCHEMA, TEST_HTML, "my-form-1234");

    expect(res.status).toBe(201);
    expect(body.id).toBe("my-form-1234");
    expect(body.url).toBe("/f/my-form-1234");

    const form = await db.getFormById("my-form-1234");
    expect(form).not.toBeNull();
  });

  it("returns 400 for invalid JSON body", async () => {
    const res = await fetchApp(
      "http://localhost/api/forms",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: "not json",
      },
      db,
    );

    expect(res.status).toBe(400);
  });
});

// ─── GET /f/:id ───

describe("GET /f/:id", () => {
  let db: MemoryAdapter;

  beforeEach(() => {
    db = new MemoryAdapter();
  });

  it("serves form HTML with correct content type", async () => {
    const { body: createBody } = await createForm(db);
    const formId = createBody.id as string;

    const res = await fetchApp(`http://localhost/f/${formId}`, {}, db);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toBe(TEST_HTML);
  });

  it("returns cache-control headers", async () => {
    const { body: createBody } = await createForm(db);
    const formId = createBody.id as string;

    const res = await fetchApp(`http://localhost/f/${formId}`, {}, db);

    expect(res.headers.get("Cache-Control")).toContain("stale-while-revalidate");
  });

  it("increments view count", async () => {
    const { body: createBody } = await createForm(db);
    const formId = createBody.id as string;

    await fetchApp(`http://localhost/f/${formId}`, {}, db);
    await fetchApp(`http://localhost/f/${formId}`, {}, db);

    await new Promise((r) => setTimeout(r, 50));

    const form = await db.getFormById(formId);
    expect(form!.view_count).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await fetchApp("http://localhost/f/nonexistent1", {}, db);

    expect(res.status).toBe(404);
  });

  it("does not require authentication", async () => {
    const { body: createBody } = await createForm(db);
    const formId = createBody.id as string;

    const res = await fetchApp(`http://localhost/f/${formId}`, {}, db);
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/responses/:formId ───

describe("POST /api/responses/:formId", () => {
  let db: MemoryAdapter;

  beforeEach(() => {
    db = new MemoryAdapter();
  });

  it("submits a response and returns 201", async () => {
    const { body: form } = await createForm(db);
    const { res, body } = await submitResponse(db, form.id as string, {
      name: "Alice",
      rating: 5,
    });

    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe("string");
    expect((body.id as string).length).toBe(16);
    expect(body.submitted_at).toBeDefined();
  });

  it("increments submit_count on the form", async () => {
    const { body: form } = await createForm(db);

    await submitResponse(db, form.id as string, { name: "Alice" });
    await submitResponse(db, form.id as string, { name: "Bob" });

    await new Promise((r) => setTimeout(r, 50));

    const f = await db.getFormById(form.id as string);
    expect(f!.submit_count).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for nonexistent form", async () => {
    const { res } = await submitResponse(db, "nonexistent123", { name: "test" });
    expect(res.status).toBe(404);
  });

  it("does not require authentication", async () => {
    const { body: form } = await createForm(db);
    const { res } = await submitResponse(db, form.id as string, { name: "Public" });
    expect(res.status).toBe(201);
  });

  it("stores answers and metadata correctly", async () => {
    const { body: form } = await createForm(db);
    const answers = { name: "Alice", rating: 5 };
    const metadata = { userAgent: "test-agent", duration: 42 };

    const { body } = await submitResponse(db, form.id as string, answers, metadata);
    const responseId = body.id as string;

    const getRes = await fetchApp(
      `http://localhost/api/responses/${form.id}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
      db,
    );
    const getBody = (await getRes.json()) as {
      responses: Array<{
        id: string;
        answers: Record<string, unknown>;
        metadata: Record<string, unknown>;
      }>;
      total: number;
    };

    const stored = getBody.responses.find((r) => r.id === responseId);
    expect(stored).toBeDefined();
    expect(stored!.answers).toEqual(answers);
    expect(stored!.metadata).toMatchObject(metadata);
  });

  it("includes CORS headers for cross-origin submissions", async () => {
    const { body: form } = await createForm(db);
    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "null",
        },
        body: JSON.stringify({
          formId: form.id,
          answers: { name: "test" },
          status: "completed",
          submittedAt: new Date().toISOString(),
        }),
      },
      db,
    );

    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ─── PUT /api/responses/:formId/:responseId ───

describe("PUT /api/responses/:formId/:responseId", () => {
  let db: MemoryAdapter;

  beforeEach(() => {
    db = new MemoryAdapter();
  });

  it("updates an in_progress response", async () => {
    const { body: form } = await createForm(db);
    const { body: postBody } = await submitResponse(
      db,
      form.id as string,
      { name: "Alice" },
      undefined,
      "in_progress",
    );
    const responseId = (postBody.responseId ?? postBody.id) as string;

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}/${responseId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: { name: "Alice Updated", rating: 4 },
          metadata: { lastFieldId: "rating" },
          status: "in_progress",
        }),
      },
      db,
    );

    expect(res.status).toBe(200);

    const getRes = await fetchApp(
      `http://localhost/api/responses/${form.id}?status=in_progress`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );
    const getBody = (await getRes.json()) as {
      responses: Array<{ answers: Record<string, unknown> }>;
    };
    expect(getBody.responses[0]?.answers).toEqual({
      name: "Alice Updated",
      rating: 4,
    });
  });

  it("returns 409 when updating a completed response", async () => {
    const { body: form } = await createForm(db);
    const { body: postBody } = await submitResponse(db, form.id as string, {
      name: "Bob",
    });
    const responseId = (postBody.responseId ?? postBody.id) as string;

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}/${responseId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: { name: "Bob Updated" },
          status: "in_progress",
        }),
      },
      db,
    );

    expect(res.status).toBe(409);
  });
});

// ─── GET /api/responses/:formId ───

describe("GET /api/responses/:formId", () => {
  let db: MemoryAdapter;

  beforeEach(() => {
    db = new MemoryAdapter();
  });

  it("returns responses for the form", async () => {
    const { body: form } = await createForm(db);
    await submitResponse(db, form.id as string, { name: "Alice", rating: 5 });
    await submitResponse(db, form.id as string, { name: "Bob", rating: 3 });

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      responses: unknown[];
      total: number;
    };
    expect(body.total).toBe(2);
    expect(body.responses).toHaveLength(2);
  });

  it("returns empty array for form with no responses", async () => {
    const { body: form } = await createForm(db);

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      responses: unknown[];
      total: number;
    };
    expect(body.total).toBe(0);
    expect(body.responses).toHaveLength(0);
  });

  it("supports pagination with limit and offset", async () => {
    const { body: form } = await createForm(db);

    for (let i = 0; i < 5; i++) {
      await submitResponse(db, form.id as string, { name: `User ${i}` });
    }

    const res1 = await fetchApp(
      `http://localhost/api/responses/${form.id}?limit=2&offset=0`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );
    const body1 = (await res1.json()) as {
      responses: unknown[];
      total: number;
    };
    expect(body1.responses).toHaveLength(2);
    expect(body1.total).toBe(5);

    const res3 = await fetchApp(
      `http://localhost/api/responses/${form.id}?limit=2&offset=4`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );
    const body3 = (await res3.json()) as {
      responses: unknown[];
      total: number;
    };
    expect(body3.responses).toHaveLength(1);
    expect(body3.total).toBe(5);
  });

  it("returns 401 without auth", async () => {
    const { body: form } = await createForm(db);

    const res = await fetchApp(`http://localhost/api/responses/${form.id}`, {}, db);

    expect(res.status).toBe(401);
  });

  it("returns 403 with wrong API key", async () => {
    const { body: form } = await createForm(db, API_KEY);

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}`,
      { headers: { Authorization: `Bearer ${OTHER_API_KEY}` } },
      db,
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await fetchApp(
      "http://localhost/api/responses/nonexistent1",
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/responses/:formId/analytics ───

describe("GET /api/responses/:formId/analytics", () => {
  let db: MemoryAdapter;

  beforeEach(() => {
    db = new MemoryAdapter();
  });

  it("returns analytics with totals, series, and highestDropoff", async () => {
    const { body: form } = await createForm(db);
    await submitResponse(
      db,
      form.id as string,
      { name: "Alice", rating: 5 },
      {
        userAgent: "test",
        duration: 120,
      },
    );
    await submitResponse(
      db,
      form.id as string,
      { name: "Bob", rating: 4 },
      {
        userAgent: "test",
        duration: 90,
      },
    );

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}/analytics?days=7`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      totals: {
        views: number;
        submissions: number;
        completionRate: number;
        avgDurationSeconds: number;
      };
      series: { date: string; views: number; submissions: number }[];
      highestDropoff: { fieldId: string; fieldTitle: string; count: number } | null;
    };
    expect(data.totals).toBeDefined();
    expect(typeof data.totals.submissions).toBe("number");
    expect(typeof data.totals.completionRate).toBe("number");
    expect(typeof data.totals.avgDurationSeconds).toBe("number");
    expect(Array.isArray(data.series)).toBe(true);
    expect(data.series.length).toBeGreaterThan(0);
    expect(data.series[0]).toHaveProperty("date");
    expect(data.series[0]).toHaveProperty("views");
    expect(data.series[0]).toHaveProperty("submissions");
  });

  it("returns 401 without API key", async () => {
    const { body: form } = await createForm(db);
    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}/analytics?days=7`,
      {},
      db,
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 with wrong API key", async () => {
    const { body: form } = await createForm(db, API_KEY);
    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}/analytics?days=7`,
      { headers: { Authorization: `Bearer ${OTHER_API_KEY}` } },
      db,
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await fetchApp(
      "http://localhost/api/responses/nonexistent1/analytics?days=7",
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );
    expect(res.status).toBe(404);
  });

  it("accepts days=14 and days=30", async () => {
    const { body: form } = await createForm(db);
    const res7 = await fetchApp(
      `http://localhost/api/responses/${form.id}/analytics?days=7`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );
    const res14 = await fetchApp(
      `http://localhost/api/responses/${form.id}/analytics?days=14`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );
    const res30 = await fetchApp(
      `http://localhost/api/responses/${form.id}/analytics?days=30`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );
    expect(res7.status).toBe(200);
    expect(res14.status).toBe(200);
    expect(res30.status).toBe(200);
    const d7 = (await res7.json()) as { series: unknown[] };
    const d14 = (await res14.json()) as { series: unknown[] };
    const d30 = (await res30.json()) as { series: unknown[] };
    expect(d14.series.length).toBeGreaterThanOrEqual(d7.series.length);
    expect(d30.series.length).toBeGreaterThanOrEqual(d14.series.length);
  });
});

// ─── GET /api/responses/:formId/xlsx ───

describe("GET /api/responses/:formId/xlsx", () => {
  let db: MemoryAdapter;

  beforeEach(() => {
    db = new MemoryAdapter();
  });

  it("returns an xlsx file with correct content type", async () => {
    const { body: form } = await createForm(db);
    await submitResponse(db, form.id as string, { name: "Alice", rating: 5 });

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}/xlsx`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(".xlsx");

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("returns xlsx even with no responses", async () => {
    const { body: form } = await createForm(db);

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}/xlsx`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );

    expect(res.status).toBe(200);
    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("returns 401 without auth", async () => {
    const { body: form } = await createForm(db);

    const res = await fetchApp(`http://localhost/api/responses/${form.id}/xlsx`, {}, db);

    expect(res.status).toBe(401);
  });

  it("returns 403 with wrong API key", async () => {
    const { body: form } = await createForm(db, API_KEY);

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}/xlsx`,
      { headers: { Authorization: `Bearer ${OTHER_API_KEY}` } },
      db,
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await fetchApp(
      "http://localhost/api/responses/nonexistent1/xlsx",
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/responses/:formId/csv ───

describe("GET /api/responses/:formId/csv", () => {
  let db: MemoryAdapter;

  beforeEach(() => {
    db = new MemoryAdapter();
  });

  it("returns a csv file with correct content type and parseable content", async () => {
    const { body: form } = await createForm(db);
    await submitResponse(db, form.id as string, { name: "Alice", rating: 5 });

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}/csv`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Type")).toContain("charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(".csv");

    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);

    const parseCsvLine = (line: string) =>
      line.split(",").map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"'));
    const headerLine = lines[0];
    const dataLine = lines[1];
    expect(headerLine).toBeDefined();
    expect(dataLine).toBeDefined();
    const headers = parseCsvLine(headerLine!);
    expect(headers).toContain("Your Name");
    expect(headers).toContain("Rating");
    expect(headers).toContain("Submitted At");

    const dataRow = parseCsvLine(dataLine!);
    const nameIdx = headers.indexOf("Your Name");
    const ratingIdx = headers.indexOf("Rating");
    expect(nameIdx).toBeGreaterThanOrEqual(0);
    expect(ratingIdx).toBeGreaterThanOrEqual(0);
    expect(dataRow[nameIdx] ?? "").toBe("Alice");
    expect(dataRow[ratingIdx] ?? "").toBe("5");
  });

  it("returns csv even with no responses", async () => {
    const { body: form } = await createForm(db);

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}/csv`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Submitted At");
  });

  it("returns 401 without auth", async () => {
    const { body: form } = await createForm(db);

    const res = await fetchApp(`http://localhost/api/responses/${form.id}/csv`, {}, db);

    expect(res.status).toBe(401);
  });

  it("returns 403 with wrong API key", async () => {
    const { body: form } = await createForm(db, API_KEY);

    const res = await fetchApp(
      `http://localhost/api/responses/${form.id}/csv`,
      { headers: { Authorization: `Bearer ${OTHER_API_KEY}` } },
      db,
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await fetchApp(
      "http://localhost/api/responses/nonexistent1/csv",
      { headers: { Authorization: `Bearer ${API_KEY}` } },
      db,
    );

    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/forms/:id ───

describe("DELETE /api/forms/:id", () => {
  let db: MemoryAdapter;

  beforeEach(() => {
    db = new MemoryAdapter();
  });

  it("deletes a form and returns success", async () => {
    const { body: createBody } = await createForm(db);
    const formId = createBody.id as string;

    const res = await fetchApp(
      `http://localhost/api/forms/${formId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
      db,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(true);

    const form = await db.getFormById(formId);
    expect(form).toBeNull();
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await fetchApp(
      "http://localhost/api/forms/nonexistent1",
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
      db,
    );

    expect(res.status).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const { body: createBody } = await createForm(db);
    const formId = createBody.id as string;

    const res = await fetchApp(`http://localhost/api/forms/${formId}`, { method: "DELETE" }, db);

    expect(res.status).toBe(401);
  });

  it("returns 403 with wrong API key", async () => {
    const { body: createBody } = await createForm(db, API_KEY);
    const formId = createBody.id as string;

    const res = await fetchApp(
      `http://localhost/api/forms/${formId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${OTHER_API_KEY}` },
      },
      db,
    );

    expect(res.status).toBe(403);
  });

  it("GET /f/:id returns 404 after deletion", async () => {
    const { body: createBody } = await createForm(db);
    const formId = createBody.id as string;

    await fetchApp(
      `http://localhost/api/forms/${formId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
      db,
    );

    const res = await fetchApp(`http://localhost/f/${formId}`, {}, db);
    expect(res.status).toBe(404);
  });
});

// ─── CORS ───

describe("CORS headers", () => {
  let db: MemoryAdapter;

  beforeEach(() => {
    db = new MemoryAdapter();
  });

  it("includes CORS headers on API responses", async () => {
    const res = await fetchApp("http://localhost/api/health", {}, db);

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("handles OPTIONS preflight", async () => {
    const res = await fetchApp(
      "http://localhost/api/forms",
      {
        method: "OPTIONS",
        headers: {
          Origin: "http://example.com",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      },
      db,
    );

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
  });
});
