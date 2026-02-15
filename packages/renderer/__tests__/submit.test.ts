import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { submitResponses } from "../src/submit/handler";
import { submitToWebhook } from "../src/submit/webhook";
import { flattenForSheets } from "../src/submit/sheets";
import { saveToLocal } from "../src/submit/local";
import type { FormSchema, FormResponse } from "@formant/core";

vi.mock("../src/submit/local", () => ({
  saveToLocal: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock fetch globally ───

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
  vi.mocked(saveToLocal).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Test Data ───

const baseSchema: FormSchema = {
  id: "test-form",
  title: "Test Form",
  fields: [
    { id: "name", type: "text", title: "Name" },
    { id: "ending", type: "ending", title: "Done" },
  ],
};

const answers = { name: "Alice" };
const metadata = { userAgent: "test-agent", duration: 60, completionRate: 100 };

// ─── Tests ───

describe("submitResponses", () => {
  it("with single webhook destination calls correct handler", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const schema: FormSchema = {
      ...baseSchema,
      submit: {
        destinations: [
          {
            type: "webhook",
            url: "https://example.com/hook",
          },
        ],
      },
    };

    const results = await submitResponses(schema, answers, metadata);

    expect(results).toHaveLength(1);
    expect(results[0]?.destination).toBe("webhook");
    expect(results[0]?.success).toBe(true);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/hook");
    expect(opts.method).toBe("POST");
  });

  it("with single service destination calls service handler", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const schema: FormSchema = {
      ...baseSchema,
      submit: {
        destinations: [
          {
            type: "service",
            formId: "test-form",
            endpoint: "https://api.example.com",
          },
        ],
      },
    };

    const results = await submitResponses(schema, answers, metadata);

    expect(results).toHaveLength(1);
    expect(results[0]?.destination).toBe("service");
    expect(results[0]?.success).toBe(true);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/responses/test-form");
  });

  it("with multiple destinations fires all in parallel", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const schema: FormSchema = {
      ...baseSchema,
      submit: {
        destinations: [
          { type: "webhook", url: "https://hook1.example.com" },
          { type: "webhook", url: "https://hook2.example.com" },
          {
            type: "service",
            formId: "test-form",
            endpoint: "https://api.example.com",
          },
        ],
      },
    };

    const results = await submitResponses(schema, answers, metadata);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
    // fetch should have been called 3 times
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("one destination fails while others still succeed (Promise.allSettled)", async () => {
    // First call succeeds, second fails, third succeeds
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      )
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

    const schema: FormSchema = {
      ...baseSchema,
      submit: {
        destinations: [
          { type: "webhook", url: "https://hook1.example.com" },
          { type: "webhook", url: "https://hook2.example.com" },
          {
            type: "service",
            formId: "test-form",
            endpoint: "https://api.example.com",
          },
        ],
      },
    };

    const results = await submitResponses(schema, answers, metadata);

    expect(results).toHaveLength(3);
    // First succeeded
    expect(results[0]?.success).toBe(true);
    // Second failed
    expect(results[1]?.success).toBe(false);
    expect(results[1]?.error).toBe("Network error");
    // Third succeeded
    expect(results[2]?.success).toBe(true);
  });

  it("excel download triggers blob download (mocked)", async () => {
    // Mock DOM APIs for download
    const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
    const mockRevokeObjectURL = vi.fn();
    const mockClick = vi.fn();
    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();

    vi.stubGlobal("URL", {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    // Mock document.createElement to return a mock anchor
    const origCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        if (tag === "a") {
          const anchor = origCreateElement("a");
          anchor.click = mockClick;
          return anchor;
        }
        return origCreateElement(tag);
      });

    vi.spyOn(document.body, "appendChild").mockImplementation(mockAppendChild);
    vi.spyOn(document.body, "removeChild").mockImplementation(mockRemoveChild);

    const schema: FormSchema = {
      ...baseSchema,
      submit: {
        destinations: [
          {
            type: "excel",
            filename: "test-export.xlsx",
          },
        ],
      },
    };

    const results = await submitResponses(schema, answers, metadata);

    expect(results).toHaveLength(1);
    expect(results[0]?.destination).toBe("excel");
    expect(results[0]?.success).toBe(true);

    // CSV fallback should have triggered (XLSX is not available)
    expect(mockCreateObjectURL).toHaveBeenCalledOnce();
    expect(mockClick).toHaveBeenCalledOnce();

    createElementSpy.mockRestore();
  });

  it("with local destination calls saveToLocal and returns success (no Excel download)", async () => {
    const schema: FormSchema = {
      ...baseSchema,
      submit: {
        destinations: [{ type: "local" }],
      },
    };

    const results = await submitResponses(schema, answers, metadata);

    expect(results).toHaveLength(1);
    expect(results[0]?.destination).toBe("local");
    expect(results[0]?.success).toBe(true);

    expect(saveToLocal).toHaveBeenCalledOnce();
    expect(saveToLocal).toHaveBeenCalledWith(
      "test-form",
      expect.objectContaining({
        formId: "test-form",
        status: "completed",
        submittedAt: expect.any(String),
        answers: { name: "Alice" },
      })
    );

    // No fetch, no Excel download
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty array when no destinations configured", async () => {
    const schema: FormSchema = {
      ...baseSchema,
      submit: {
        destinations: [],
      },
    };

    const results = await submitResponses(schema, answers, metadata);
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sheets destination uses text/plain content type", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const schema: FormSchema = {
      ...baseSchema,
      submit: {
        destinations: [
          {
            type: "sheets",
            url: "https://script.google.com/macros/s/xxx/exec",
          },
        ],
      },
    };

    const results = await submitResponses(schema, answers, metadata);

    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(true);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(opts.headers).toEqual(
      expect.objectContaining({ "Content-Type": "text/plain" })
    );
  });

  it("sheets destination sends flattened body with field titles as keys", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const schema: FormSchema = {
      ...baseSchema,
      submit: {
        destinations: [
          {
            type: "sheets",
            url: "https://script.google.com/macros/s/xxx/exec",
          },
        ],
      },
    };

    await submitResponses(schema, answers, metadata);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);

    // Should use field title "Name" not field id "name"
    expect(body).toHaveProperty("Name", "Alice");
    // Should include metadata
    expect(body).toHaveProperty("_formId", "test-form");
    expect(body).toHaveProperty("_submittedAt");
  });

  it("sheets destination falls back to no-cors on CORS failure", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("CORS error"))
      .mockResolvedValueOnce(new Response(null, { status: 0 }));

    const schema: FormSchema = {
      ...baseSchema,
      submit: {
        destinations: [
          {
            type: "sheets",
            url: "https://script.google.com/macros/s/xxx/exec",
          },
        ],
      },
    };

    const results = await submitResponses(schema, answers, metadata);

    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(true);
    // Should have been called twice: once with cors, once with no-cors
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [, opts2] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(opts2.mode).toBe("no-cors");
  });
});

// ─── Webhook Handler Tests ───

describe("submitToWebhook", () => {
  const response: FormResponse = {
    formId: "test-form",
    status: "completed",
    submittedAt: "2026-02-14T12:00:00.000Z",
    answers: { name: "Alice" },
  };

  it("sends POST with JSON body and custom headers", async () => {
    mockFetch.mockResolvedValue(
      new Response("{}", { status: 200 })
    );

    await submitToWebhook(
      "https://hooks.example.com/abc",
      response,
      { Authorization: "Bearer test-token", "X-Custom": "value" }
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/abc");
    expect(opts.method).toBe("POST");

    const headers = opts.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer test-token");
    expect(headers["X-Custom"]).toBe("value");

    const body = JSON.parse(opts.body as string);
    expect(body.formId).toBe("test-form");
    expect(body.answers).toEqual({ name: "Alice" });
  });

  it("retries once on 5xx error", async () => {
    // First attempt: 500, second attempt: 200
    mockFetch
      .mockResolvedValueOnce(new Response("Server Error", { status: 500 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await submitToWebhook("https://hooks.example.com/abc", response);

    // fetch called twice: initial + 1 retry
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after retry still fails", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("Server Error", { status: 500 }))
      .mockResolvedValueOnce(new Response("Still Broken", { status: 503 }));

    await expect(
      submitToWebhook("https://hooks.example.com/abc", response)
    ).rejects.toThrow("Webhook submission failed: 503");
  });

  it("does not retry on 4xx error", async () => {
    mockFetch.mockResolvedValue(
      new Response("Bad Request", { status: 400, statusText: "Bad Request" })
    );

    await expect(
      submitToWebhook("https://hooks.example.com/abc", response)
    ).rejects.toThrow("Webhook submission failed: 400 Bad Request");

    // Only 1 call — no retry for client errors
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("times out after 10 seconds", async () => {
    vi.useFakeTimers();

    // fetch never resolves
    mockFetch.mockImplementation(
      (_url: string, opts: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        })
    );

    const promise = submitToWebhook("https://hooks.example.com/abc", response);

    // Advance past the timeout
    vi.advanceTimersByTime(10_001);

    await expect(promise).rejects.toThrow();

    vi.useRealTimers();
  });

  it("succeeds on first attempt with 2xx response", async () => {
    mockFetch.mockResolvedValue(
      new Response("{}", { status: 201 })
    );

    await submitToWebhook("https://hooks.example.com/abc", response);

    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

// ─── flattenForSheets Tests ───

describe("flattenForSheets", () => {
  const sheetsSchema: FormSchema = {
    id: "test-form",
    title: "Test Form",
    fields: [
      { id: "welcome", type: "welcome", title: "Welcome" },
      { id: "name", type: "text", title: "Your Name" },
      { id: "email", type: "email", title: "Email Address" },
      { id: "age", type: "number", title: "Your Age" },
      {
        id: "topics",
        type: "multi_choice",
        title: "Topics of Interest",
        options: ["Design", "Engineering", "Marketing"],
      },
      { id: "rating", type: "rating", title: "Overall Rating", max: 5 },
      {
        id: "recommend",
        type: "yes_no",
        title: "Would You Recommend?",
      },
      { id: "date", type: "date", title: "Preferred Date" },
      { id: "statement", type: "statement", title: "Thanks for answering" },
      { id: "ending", type: "ending", title: "All Done" },
    ],
  };

  const sheetsResponse: FormResponse = {
    formId: "test-form",
    status: "completed",
    submittedAt: "2026-02-14T12:00:00.000Z",
    answers: {
      name: "Alice",
      email: "alice@example.com",
      age: 30,
      topics: ["Design", "Engineering"],
      rating: 4,
      recommend: true,
      date: "2026-03-15",
    },
    metadata: {
      duration: 120,
      completionRate: 100,
    },
  };

  it("uses field titles as keys, not field IDs", () => {
    const row = flattenForSheets(sheetsSchema, sheetsResponse);

    expect(row).toHaveProperty("Your Name", "Alice");
    expect(row).toHaveProperty("Email Address", "alice@example.com");
    expect(row).not.toHaveProperty("name");
    expect(row).not.toHaveProperty("email");
  });

  it("keeps numbers as numbers", () => {
    const row = flattenForSheets(sheetsSchema, sheetsResponse);

    expect(row["Your Age"]).toBe(30);
    expect(typeof row["Your Age"]).toBe("number");
    expect(row["Overall Rating"]).toBe(4);
    expect(typeof row["Overall Rating"]).toBe("number");
  });

  it("joins multi-choice arrays with comma separator", () => {
    const row = flattenForSheets(sheetsSchema, sheetsResponse);

    expect(row["Topics of Interest"]).toBe("Design, Engineering");
  });

  it("converts booleans to Yes/No strings", () => {
    const row = flattenForSheets(sheetsSchema, sheetsResponse);

    expect(row["Would You Recommend?"]).toBe("Yes");
  });

  it("converts false booleans to No", () => {
    const responseWithNo: FormResponse = {
      ...sheetsResponse,
      answers: { ...sheetsResponse.answers, recommend: false },
    };
    const row = flattenForSheets(sheetsSchema, responseWithNo);

    expect(row["Would You Recommend?"]).toBe("No");
  });

  it("skips welcome, statement, and ending fields", () => {
    const row = flattenForSheets(sheetsSchema, sheetsResponse);

    expect(row).not.toHaveProperty("Welcome");
    expect(row).not.toHaveProperty("Thanks for answering");
    expect(row).not.toHaveProperty("All Done");
  });

  it("includes metadata with _ prefix", () => {
    const row = flattenForSheets(sheetsSchema, sheetsResponse);

    expect(row["_formId"]).toBe("test-form");
    expect(row["_submittedAt"]).toBe("2026-02-14T12:00:00.000Z");
    expect(row["_duration"]).toBe(120);
    expect(row["_completionRate"]).toBe(100);
  });

  it("omits metadata fields when not present", () => {
    const responseNoMeta: FormResponse = {
      ...sheetsResponse,
      metadata: undefined,
    };
    const row = flattenForSheets(sheetsSchema, responseNoMeta);

    expect(row).toHaveProperty("_formId");
    expect(row).toHaveProperty("_submittedAt");
    expect(row).not.toHaveProperty("_duration");
    expect(row).not.toHaveProperty("_completionRate");
  });

  it("handles null and undefined answer values as empty strings", () => {
    const responseWithNull: FormResponse = {
      ...sheetsResponse,
      answers: { name: null as unknown, email: undefined },
    };
    const row = flattenForSheets(sheetsSchema, responseWithNull);

    expect(row["Your Name"]).toBe("");
    expect(row["Email Address"]).toBe("");
  });

  it("handles date strings as-is", () => {
    const row = flattenForSheets(sheetsSchema, sheetsResponse);

    expect(row["Preferred Date"]).toBe("2026-03-15");
  });

  it("handles special characters in answers", () => {
    const responseWithSpecial: FormResponse = {
      ...sheetsResponse,
      answers: {
        ...sheetsResponse.answers,
        name: 'Alice "The Great" O\'Brien & Co.',
      },
    };
    const row = flattenForSheets(sheetsSchema, responseWithSpecial);

    expect(row["Your Name"]).toBe('Alice "The Great" O\'Brien & Co.');
  });

  it("truncates strings exceeding Google Sheets cell limit (50,000 chars)", () => {
    const longString = "x".repeat(60_000);
    const responseWithLong: FormResponse = {
      ...sheetsResponse,
      answers: { ...sheetsResponse.answers, name: longString },
    };
    const row = flattenForSheets(sheetsSchema, responseWithLong);

    const value = row["Your Name"] as string;
    expect(value.length).toBeLessThanOrEqual(50_000);
    expect(value.endsWith("...")).toBe(true);
  });

  it("does not truncate strings within the limit", () => {
    const normalString = "x".repeat(49_000);
    const responseWithNormal: FormResponse = {
      ...sheetsResponse,
      answers: { ...sheetsResponse.answers, name: normalString },
    };
    const row = flattenForSheets(sheetsSchema, responseWithNormal);

    expect(row["Your Name"]).toBe(normalString);
  });

  it("falls back to field ID when title is missing", () => {
    const schemaNoTitle: FormSchema = {
      id: "test-form",
      fields: [
        // title is required per BaseField but can be empty string
        { id: "q1", type: "text", title: "" },
        { id: "ending", type: "ending", title: "Done" },
      ],
    };
    const resp: FormResponse = {
      formId: "test-form",
      status: "completed",
      submittedAt: "2026-02-14T12:00:00.000Z",
      answers: { q1: "hello" },
    };
    const row = flattenForSheets(schemaNoTitle, resp);

    // Empty title falls back to id
    expect(row).toHaveProperty("q1", "hello");
  });
});
