/**
 * Unit tests for the DbAdapter interface.
 * Uses a mock adapter to verify routes use the adapter interface rather than DB directly.
 */
import { describe, it, expect } from "vitest";
import app from "../src/index";
import type { DbAdapter, FormRow, ResponseRow, AnalyticsResult } from "../src/db/interface";
import { hashApiKey } from "../src/middleware/auth";

const MOCK_FORM: FormRow = {
  id: "mock-form-123",
  title: "Mock Form",
  html: "<html><body>Mock HTML</body></html>",
  schema_json: '{"fields":[]}',
  api_key_hash: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  view_count: 0,
  submit_count: 0,
};

const MOCK_RESPONSE: ResponseRow = {
  id: "resp-123",
  form_id: "mock-form-123",
  answers_json: '{"name":"Test"}',
  metadata_json: null,
  submitted_at: "2024-01-01T00:00:00Z",
  status: "completed",
  session_id: null,
  updated_at: null,
};

function createMockAdapter(overrides?: Partial<DbAdapter>): DbAdapter {
  return {
    insertForm: async () => MOCK_FORM,
    getFormById: async (id) => (id === MOCK_FORM.id ? MOCK_FORM : null),
    listFormsByApiKeyHash: async () => [],
    updateForm: async () => MOCK_FORM,
    incrementViewCount: async () => {},
    incrementViewCountDaily: async () => {},
    incrementSubmitCount: async () => {},
    deleteForm: async () => true,
    insertResponse: async () => MOCK_RESPONSE,
    updateResponse: async () => ({ updated: true }),
    getResponsesByFormId: async () => ({ responses: [MOCK_RESPONSE], total: 1 }),
    getAllResponsesForExport: async () => [MOCK_RESPONSE],
    getAnalytics: async (): Promise<AnalyticsResult> => ({
      totals: {
        views: 1,
        submissions: 1,
        completionRate: 100,
        avgDurationSeconds: 60,
      },
      series: [{ date: "2024-01-01", views: 1, submissions: 1 }],
      highestDropoff: null,
    }),
    insertOAuthSession: async () => {},
    getAndDeleteOAuthSession: async () => null,
    ...overrides,
  };
}

const executionCtx: ExecutionContext = {
  waitUntil: (p: Promise<unknown>) => {
    p.catch(() => {});
  },
  passThroughOnException: () => {},
  props: {},
};

describe("DbAdapter interface (mock)", () => {
  it("GET /f/:id uses adapter getFormById", async () => {
    const mockDb = createMockAdapter();
    const env = {
      DB: null as unknown as D1Database,
      db: mockDb,
    };

    const res = await app.fetch(
      new Request(`http://localhost/f/${MOCK_FORM.id}`),
      env,
      executionCtx,
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(MOCK_FORM.html);
  });

  it("GET /f/:id returns 404 when adapter returns null", async () => {
    const mockDb = createMockAdapter();
    const env = {
      DB: null as unknown as D1Database,
      db: mockDb,
    };

    const res = await app.fetch(new Request("http://localhost/f/nonexistent"), env, executionCtx);

    expect(res.status).toBe(404);
  });

  it("GET /api/health does not require db", async () => {
    const mockDb = createMockAdapter();
    const env = {
      DB: null as unknown as D1Database,
      db: mockDb,
    };

    const res = await app.fetch(new Request("http://localhost/api/health"), env, executionCtx);

    expect(res.status).toBe(200);
    expect((await res.json()) as { status: string }).toEqual({ status: "ok" });
  });

  it("POST /api/connect-sheets/init returns 503 when not configured", async () => {
    const mockDb = createMockAdapter();
    const env = {
      DB: null as unknown as D1Database,
      db: mockDb,
    };

    const res = await app.fetch(
      new Request("http://localhost/api/connect-sheets/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uri: "https://example.com/admin.html",
          form_id: "test",
          schema: { fields: [] },
        }),
      }),
      env,
      executionCtx,
    );

    expect(res.status).toBe(503);
    expect((await res.json()) as { error: string }).toEqual({
      error: "Connect Google Sheet is not configured",
    });
  });

  it("GET /api/responses/:formId uses adapter getFormById and getResponsesByFormId", async () => {
    const apiKeyHash = await hashApiKey("test-key");
    const formWithAuth = { ...MOCK_FORM, api_key_hash: apiKeyHash };
    const mockDb = createMockAdapter({
      getFormById: async () => formWithAuth,
    });
    const env = {
      DB: null as unknown as D1Database,
      db: mockDb,
    };

    const res = await app.fetch(
      new Request(`http://localhost/api/responses/${MOCK_FORM.id}`, {
        headers: { Authorization: "Bearer test-key" },
      }),
      env,
      executionCtx,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { responses: unknown[]; total: number };
    expect(body.total).toBe(1);
    expect(body.responses).toHaveLength(1);
  });
});
