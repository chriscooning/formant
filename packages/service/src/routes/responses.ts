import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import {
  getFormById,
  incrementSubmitCount,
  insertResponse,
  updateResponse,
  getResponsesByFormId,
} from "../db/queries";
import { generateResponseId } from "../utils/id";

const responsesApp = new Hono<AppEnv>();

// ─── POST /api/responses/:formId — Submit a response (public, no auth) ───

responsesApp.post("/api/responses/:formId", async (c) => {
  const formId = c.req.param("formId");

  const form = await getFormById(c.env.DB, formId);
  if (!form) {
    return c.json({ error: "Form not found" }, 404);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const id = generateResponseId();
  const status = (body.status as string) === "in_progress" ? "in_progress" : "completed";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;

  const response = await insertResponse(c.env.DB, {
    id,
    formId,
    answersJson: JSON.stringify(body.answers ?? {}),
    metadataJson: body.metadata ? JSON.stringify(body.metadata) : null,
    status,
    sessionId,
  });

  if (status === "completed") {
    c.executionCtx.waitUntil(incrementSubmitCount(c.env.DB, formId));
  }

  return c.json(
    {
      responseId: response.id,
      id: response.id,
      submitted_at: response.submitted_at,
    },
    201,
  );
});

// ─── PUT /api/responses/:formId/:responseId — Update a response (public, auto-save) ───

responsesApp.put("/api/responses/:formId/:responseId", async (c) => {
  const formId = c.req.param("formId");
  const responseId = c.req.param("responseId");

  const form = await getFormById(c.env.DB, formId);
  if (!form) {
    return c.json({ error: "Form not found" }, 404);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const status = (body.status as string) === "completed" ? "completed" : "in_progress";

  const { updated } = await updateResponse(c.env.DB, {
    id: responseId,
    formId,
    answersJson: JSON.stringify(body.answers ?? {}),
    metadataJson: body.metadata ? JSON.stringify(body.metadata) : null,
    status,
  });

  if (!updated) {
    return c.json({ error: "Response not found or already completed" }, 409);
  }

  if (status === "completed") {
    c.executionCtx.waitUntil(incrementSubmitCount(c.env.DB, formId));
  }

  return c.json({ ok: true }, 200);
});

// ─── GET /api/responses/:formId — List responses (auth required) ───

responsesApp.get("/api/responses/:formId", requireAuth(), async (c) => {
  const formId = c.req.param("formId");
  const apiKeyHash = c.get("apiKeyHash");

  // Verify the form exists and belongs to this API key
  const form = await getFormById(c.env.DB, formId);
  if (!form) {
    return c.json({ error: "Form not found" }, 404);
  }
  if (form.api_key_hash !== apiKeyHash) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const limit = parseInt(c.req.query("limit") ?? "100", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  const since = c.req.query("since");
  const status = c.req.query("status") as "in_progress" | "completed" | "all" | undefined;

  const { responses: rows, total } = await getResponsesByFormId(
    c.env.DB,
    formId,
    {
      limit,
      offset,
      since: since ?? undefined,
      status: status ?? "all",
    },
  );

  const formattedResponses = rows.map((row) => {
    const metadata = row.metadata_json ? JSON.parse(row.metadata_json) : null;
    if (row.updated_at && metadata && typeof metadata === "object") {
      (metadata as Record<string, unknown>).updatedAt = row.updated_at;
    }
    return {
      id: row.id,
      formId: row.form_id,
      status: row.status,
      answers: JSON.parse(row.answers_json),
      metadata,
      submittedAt: row.submitted_at,
    };
  });

  return c.json({ responses: formattedResponses, total });
});

export { responsesApp };
