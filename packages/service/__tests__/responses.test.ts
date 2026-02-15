import { SELF, env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getFormById } from "../src/db/queries";

const API_KEY = "test-api-key-responses";
const OTHER_API_KEY = "other-api-key-wrong";

const TEST_SCHEMA = {
  id: "resp-test",
  title: "Response Test",
  fields: [
    { id: "welcome", type: "welcome", title: "Welcome" },
    { id: "name", type: "text", title: "Your Name", required: true },
    { id: "rating", type: "rating", title: "Rating", max: 5 },
    { id: "end", type: "ending", title: "Thanks!" },
  ],
  submit: { destinations: [{ type: "excel" }] },
};

const TEST_HTML = "<html><body>test</body></html>";

/** Helper: create a form via the API. */
async function createForm(apiKey: string = API_KEY) {
  const res = await SELF.fetch("http://localhost/api/forms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ html: TEST_HTML, schema: TEST_SCHEMA }),
  });
  return (await res.json()) as { id: string; url: string; created_at: string };
}

/** Helper: submit a response to a form. */
async function submitResponse(
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

  const res = await SELF.fetch(
    `http://localhost/api/responses/${formId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return {
    res,
    body: (await res.json()) as Record<string, unknown>,
  };
}

// ─── POST /api/responses/:formId ───

describe("POST /api/responses/:formId", () => {
  it("submits a response and returns 201", async () => {
    const form = await createForm();
    const { res, body } = await submitResponse(form.id, {
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
    const form = await createForm();

    await submitResponse(form.id, { name: "Alice" });
    await submitResponse(form.id, { name: "Bob" });

    // Give waitUntil a moment to complete
    await new Promise((r) => setTimeout(r, 100));

    const row = await getFormById(env.DB, form.id);
    expect(row!.submit_count).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for nonexistent form", async () => {
    const { res } = await submitResponse("nonexistent123", { name: "test" });
    expect(res.status).toBe(404);
  });

  it("does not require authentication", async () => {
    const form = await createForm();
    // No auth header in submitResponse
    const { res } = await submitResponse(form.id, { name: "Public" });
    expect(res.status).toBe(201);
  });

  it("stores answers and metadata correctly", async () => {
    const form = await createForm();
    const answers = { name: "Alice", rating: 5 };
    const metadata = { userAgent: "test-agent", duration: 42 };

    const { body } = await submitResponse(form.id, answers, metadata);
    const responseId = body.id as string;

    // Verify via GET endpoint
    const getRes = await SELF.fetch(
      `http://localhost/api/responses/${form.id}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
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
    const form = await createForm();
    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "null", // Local file origin
        },
        body: JSON.stringify({
          formId: form.id,
          answers: { name: "test" },
          status: "completed",
          submittedAt: new Date().toISOString(),
        }),
      },
    );

    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

// ─── PUT /api/responses/:formId/:responseId ───

describe("PUT /api/responses/:formId/:responseId", () => {
  it("updates an in_progress response", async () => {
    const form = await createForm();
    const { body: postBody } = await submitResponse(form.id, { name: "Alice" }, undefined, "in_progress");
    const responseId = postBody.responseId ?? postBody.id;

    const res = await SELF.fetch(
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
    );

    expect(res.status).toBe(200);

    const getRes = await SELF.fetch(
      `http://localhost/api/responses/${form.id}?status=in_progress`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );
    const getBody = (await getRes.json()) as { responses: Array<{ answers: Record<string, unknown> }> };
    expect(getBody.responses[0]?.answers).toEqual({ name: "Alice Updated", rating: 4 });
  });

  it("returns 409 when updating a completed response", async () => {
    const form = await createForm();
    const { body: postBody } = await submitResponse(form.id, { name: "Bob" });
    const responseId = postBody.responseId ?? postBody.id;

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/${responseId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: { name: "Bob Updated" },
          status: "in_progress",
        }),
      },
    );

    expect(res.status).toBe(409);
  });
});

// ─── GET /api/responses/:formId ───

describe("GET /api/responses/:formId", () => {
  it("returns responses for the form", async () => {
    const form = await createForm();
    await submitResponse(form.id, { name: "Alice", rating: 5 });
    await submitResponse(form.id, { name: "Bob", rating: 3 });

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
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
    const form = await createForm();

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
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
    const form = await createForm();

    for (let i = 0; i < 5; i++) {
      await submitResponse(form.id, { name: `User ${i}` });
    }

    // Page 1: limit 2
    const res1 = await SELF.fetch(
      `http://localhost/api/responses/${form.id}?limit=2&offset=0`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
    );
    const body1 = (await res1.json()) as {
      responses: unknown[];
      total: number;
    };
    expect(body1.responses).toHaveLength(2);
    expect(body1.total).toBe(5);

    // Page 3: offset 4
    const res3 = await SELF.fetch(
      `http://localhost/api/responses/${form.id}?limit=2&offset=4`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
    );
    const body3 = (await res3.json()) as {
      responses: unknown[];
      total: number;
    };
    expect(body3.responses).toHaveLength(1);
    expect(body3.total).toBe(5);
  });

  it("returns 401 without auth", async () => {
    const form = await createForm();

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}`,
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 with wrong API key", async () => {
    const form = await createForm(API_KEY);

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}`,
      {
        headers: { Authorization: `Bearer ${OTHER_API_KEY}` },
      },
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/responses/nonexistent1",
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
    );

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/responses/:formId/xlsx ───

describe("GET /api/responses/:formId/xlsx", () => {
  it("returns an xlsx file with correct content type", async () => {
    const form = await createForm();
    await submitResponse(form.id, { name: "Alice", rating: 5 });

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/xlsx`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(".xlsx");

    // Verify the response body is non-empty
    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("returns xlsx even with no responses", async () => {
    const form = await createForm();

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/xlsx`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
    );

    expect(res.status).toBe(200);
    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("returns 401 without auth", async () => {
    const form = await createForm();

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/xlsx`,
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 with wrong API key", async () => {
    const form = await createForm(API_KEY);

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/xlsx`,
      {
        headers: { Authorization: `Bearer ${OTHER_API_KEY}` },
      },
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/responses/nonexistent1/xlsx",
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
    );

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/responses/:formId/csv ───

describe("GET /api/responses/:formId/csv", () => {
  it("returns a csv file with correct content type and parseable content", async () => {
    const form = await createForm();
    await submitResponse(form.id, { name: "Alice", rating: 5 });

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/csv`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Type")).toContain("charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain(".csv");

    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2); // header + at least one row

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
    const form = await createForm();

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/csv`,
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Submitted At");
  });

  it("returns 401 without auth", async () => {
    const form = await createForm();

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/csv`,
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 with wrong API key", async () => {
    const form = await createForm(API_KEY);

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/csv`,
      {
        headers: { Authorization: `Bearer ${OTHER_API_KEY}` },
      },
    );

    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/responses/nonexistent1/csv",
      {
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
    );

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/responses/:formId/analytics ───

describe("GET /api/responses/:formId/analytics", () => {
  it("returns analytics with totals, series, and highestDropoff", async () => {
    const form = await createForm();
    await submitResponse(form.id, { name: "Alice", rating: 5 }, {
      userAgent: "test",
      duration: 120,
    });
    await submitResponse(form.id, { name: "Bob", rating: 4 }, {
      userAgent: "test",
      duration: 90,
    });

    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/analytics?days=7`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      totals: { views: number; submissions: number; completionRate: number; avgDurationSeconds: number };
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
    const form = await createForm();
    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/analytics?days=7`,
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 with wrong API key", async () => {
    const form = await createForm(API_KEY);
    const res = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/analytics?days=7`,
      { headers: { Authorization: `Bearer ${OTHER_API_KEY}` } },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for nonexistent form", async () => {
    const res = await SELF.fetch(
      "http://localhost/api/responses/nonexistent1/analytics?days=7",
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );
    expect(res.status).toBe(404);
  });

  it("accepts days=14 and days=30", async () => {
    const form = await createForm();
    const res7 = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/analytics?days=7`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );
    const res14 = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/analytics?days=14`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );
    const res30 = await SELF.fetch(
      `http://localhost/api/responses/${form.id}/analytics?days=30`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
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
