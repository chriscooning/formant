import { SELF } from "cloudflare:test";
import { describe, it, expect, afterEach } from "vitest";
import app from "../src/index";
import type { DbAdapter } from "../src/db/interface";

const API_KEY = "test-api-key-12345";

const executionCtx: ExecutionContext = {
  waitUntil: (p: Promise<unknown>) => {
    p.catch(() => {});
  },
  passThroughOnException: () => {},
  props: {},
};

const VALID_SCHEMA = {
  id: "generated-form",
  title: "Customer feedback",
  fields: [
    { id: "welcome", type: "welcome", title: "Hi there!" },
    { id: "rating", type: "rating", title: "How did we do?", max: 5 },
    { id: "end", type: "ending", title: "Thanks!" },
  ],
  submit: { destinations: [] },
};

function anthropicResponse(text: string) {
  return new Response(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-opus-4-8",
      content: [{ type: "text", text }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 200 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function generateRequest(env: Record<string, unknown>) {
  return app.fetch(
    new Request("http://localhost/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ description: "a quick customer feedback form" }),
    }),
    { db: null as unknown as DbAdapter, ...env },
    executionCtx,
  );
}

// ─── GET /api/generate/status ───

describe("GET /api/generate/status", () => {
  it("reports not configured when no Anthropic key is set", async () => {
    const res = await SELF.fetch("http://localhost/api/generate/status");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false });
  });
});

// ─── POST /api/generate ───

describe("POST /api/generate", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "a form" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 503 when not configured", async () => {
    const res = await SELF.fetch("http://localhost/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ description: "a form" }),
    });
    expect(res.status).toBe(503);
  });

  it("returns a validated schema from the model output", async () => {
    globalThis.fetch = async () => anthropicResponse(JSON.stringify(VALID_SCHEMA));

    const res = await generateRequest({ ANTHROPIC_API_KEY: "sk-test" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { schema: typeof VALID_SCHEMA };
    expect(body.schema).toEqual(VALID_SCHEMA);
  });

  it("tolerates markdown fences around the JSON", async () => {
    globalThis.fetch = async () =>
      anthropicResponse("```json\n" + JSON.stringify(VALID_SCHEMA) + "\n```");

    const res = await generateRequest({ ANTHROPIC_API_KEY: "sk-test" });
    expect(res.status).toBe(200);
  });

  it("retries once with validation errors, then succeeds", async () => {
    const invalid = { id: "bad", title: "No fields", fields: [] };
    let calls = 0;
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      // Second call must carry the validation errors back to the model
      if (calls === 2) {
        expect(String(init?.body)).toContain("failed validation");
        return anthropicResponse(JSON.stringify(VALID_SCHEMA));
      }
      return anthropicResponse(JSON.stringify(invalid));
    };

    const res = await generateRequest({ ANTHROPIC_API_KEY: "sk-test" });
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });

  it("returns 422 when the model cannot produce a valid schema", async () => {
    const invalid = { id: "bad", title: "No fields", fields: [] };
    globalThis.fetch = async () => anthropicResponse(JSON.stringify(invalid));

    const res = await generateRequest({ ANTHROPIC_API_KEY: "sk-test" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Could not generate");
  });

  it("returns 400 for a missing description", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({}),
      }),
      { db: null as unknown as DbAdapter, ANTHROPIC_API_KEY: "sk-test" },
      executionCtx,
    );
    expect(res.status).toBe(400);
  });
});
