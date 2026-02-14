import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import {
  insertForm,
  getFormById,
  incrementViewCount,
  incrementSubmitCount,
  deleteForm,
  insertResponse,
  getResponsesByFormId,
  getResponseCount,
  getAllResponsesForExport,
} from "../src/db/queries";
import { generateFormId, generateResponseId } from "../src/utils/id";
import { hashApiKey } from "../src/middleware/auth";

// ─── D1 Schema ───

describe("D1 Schema", () => {
  it("creates the forms table", async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='forms'",
    ).first<{ name: string }>();
    expect(result?.name).toBe("forms");
  });

  it("creates the responses table", async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='responses'",
    ).first<{ name: string }>();
    expect(result?.name).toBe("responses");
  });

  it("creates indexes on responses", async () => {
    const results = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='responses'",
    ).all<{ name: string }>();
    const indexNames = results.results.map((r) => r.name);
    expect(indexNames).toContain("idx_responses_form_id");
    expect(indexNames).toContain("idx_responses_submitted_at");
  });
});

// ─── ID Generation ───

describe("ID generation", () => {
  it("generates form IDs of length 12", () => {
    const id = generateFormId();
    expect(id).toHaveLength(12);
  });

  it("generates response IDs of length 16", () => {
    const id = generateResponseId();
    expect(id).toHaveLength(16);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateFormId()));
    expect(ids.size).toBe(100);
  });
});

// ─── Auth Helpers ───

describe("Auth helpers", () => {
  it("hashes API key to a 64-char hex string", async () => {
    const hash = await hashApiKey("my-secret-key");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces consistent hashes", async () => {
    const hash1 = await hashApiKey("test-key");
    const hash2 = await hashApiKey("test-key");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different keys", async () => {
    const hash1 = await hashApiKey("key-1");
    const hash2 = await hashApiKey("key-2");
    expect(hash1).not.toBe(hash2);
  });
});

// ─── Form Queries ───

describe("Form queries", () => {
  it("inserts and retrieves a form", async () => {
    const apiKeyHash = await hashApiKey("test-api-key");
    const form = await insertForm(env.DB, {
      id: generateFormId(),
      title: "Test Form",
      html: "<html><body>test</body></html>",
      schemaJson: JSON.stringify({ id: "test", fields: [] }),
      apiKeyHash,
    });

    expect(form.id).toBeTruthy();
    expect(form.title).toBe("Test Form");
    expect(form.view_count).toBe(0);
    expect(form.submit_count).toBe(0);
    expect(form.api_key_hash).toBe(apiKeyHash);

    const retrieved = await getFormById(env.DB, form.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe("Test Form");
    expect(retrieved!.html).toBe("<html><body>test</body></html>");
  });

  it("returns null for nonexistent form", async () => {
    const result = await getFormById(env.DB, "nonexistent");
    expect(result).toBeNull();
  });

  it("increments view and submit counts", async () => {
    const form = await insertForm(env.DB, {
      id: generateFormId(),
      title: "Count Test",
      html: "<html>test</html>",
      schemaJson: "{}",
      apiKeyHash: null,
    });

    await incrementViewCount(env.DB, form.id);
    await incrementViewCount(env.DB, form.id);
    await incrementSubmitCount(env.DB, form.id);

    const updated = await getFormById(env.DB, form.id);
    expect(updated!.view_count).toBe(2);
    expect(updated!.submit_count).toBe(1);
  });

  it("deletes a form and its responses", async () => {
    const form = await insertForm(env.DB, {
      id: generateFormId(),
      title: "Delete Test",
      html: "<html>test</html>",
      schemaJson: "{}",
      apiKeyHash: null,
    });

    await insertResponse(env.DB, {
      id: generateResponseId(),
      formId: form.id,
      answersJson: JSON.stringify({ name: "Test" }),
      metadataJson: null,
    });

    const deleted = await deleteForm(env.DB, form.id);
    expect(deleted).toBe(true);

    const retrieved = await getFormById(env.DB, form.id);
    expect(retrieved).toBeNull();

    const count = await getResponseCount(env.DB, form.id);
    expect(count).toBe(0);
  });

  it("returns false when deleting nonexistent form", async () => {
    const deleted = await deleteForm(env.DB, "nonexistent");
    expect(deleted).toBe(false);
  });
});

// ─── Response Queries ───

describe("Response queries", () => {
  async function createTestForm(): Promise<string> {
    const form = await insertForm(env.DB, {
      id: generateFormId(),
      title: "Response Test",
      html: "<html>test</html>",
      schemaJson: "{}",
      apiKeyHash: null,
    });
    return form.id;
  }

  it("inserts and retrieves a response", async () => {
    const formId = await createTestForm();
    const response = await insertResponse(env.DB, {
      id: generateResponseId(),
      formId,
      answersJson: JSON.stringify({ name: "John", rating: 5 }),
      metadataJson: JSON.stringify({ userAgent: "test" }),
    });

    expect(response.form_id).toBe(formId);
    expect(response.answers_json).toBe(
      JSON.stringify({ name: "John", rating: 5 }),
    );

    const { responses, total } = await getResponsesByFormId(env.DB, formId);
    expect(total).toBe(1);
    expect(responses).toHaveLength(1);
    expect(responses[0]!.id).toBe(response.id);
  });

  it("paginates responses", async () => {
    const formId = await createTestForm();

    // Insert 5 responses
    for (let i = 0; i < 5; i++) {
      await insertResponse(env.DB, {
        id: generateResponseId(),
        formId,
        answersJson: JSON.stringify({ index: i }),
        metadataJson: null,
      });
    }

    const page1 = await getResponsesByFormId(env.DB, formId, {
      limit: 2,
      offset: 0,
    });
    expect(page1.responses).toHaveLength(2);
    expect(page1.total).toBe(5);

    const page2 = await getResponsesByFormId(env.DB, formId, {
      limit: 2,
      offset: 2,
    });
    expect(page2.responses).toHaveLength(2);
    expect(page2.total).toBe(5);

    const page3 = await getResponsesByFormId(env.DB, formId, {
      limit: 2,
      offset: 4,
    });
    expect(page3.responses).toHaveLength(1);
    expect(page3.total).toBe(5);
  });

  it("returns all responses for export", async () => {
    const formId = await createTestForm();

    for (let i = 0; i < 3; i++) {
      await insertResponse(env.DB, {
        id: generateResponseId(),
        formId,
        answersJson: JSON.stringify({ index: i }),
        metadataJson: null,
      });
    }

    const all = await getAllResponsesForExport(env.DB, formId);
    expect(all).toHaveLength(3);
  });

  it("counts responses", async () => {
    const formId = await createTestForm();
    expect(await getResponseCount(env.DB, formId)).toBe(0);

    await insertResponse(env.DB, {
      id: generateResponseId(),
      formId,
      answersJson: "{}",
      metadataJson: null,
    });
    expect(await getResponseCount(env.DB, formId)).toBe(1);
  });
});
