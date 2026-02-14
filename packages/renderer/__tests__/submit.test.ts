import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { submitResponses } from "../src/submit/handler";
import type { FormSchema } from "@formant/core";

// ─── Mock fetch globally ───

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
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
});
