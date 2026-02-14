import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import {
  getFormById,
  incrementSubmitCount,
  insertResponse,
  getResponsesByFormId,
} from "../db/queries";
import { generateResponseId } from "../utils/id";

const responsesApp = new Hono<AppEnv>();

// ─── POST /api/responses/:formId — Submit a response (public, no auth) ───

responsesApp.post("/api/responses/:formId", async (c) => {
  const formId = c.req.param("formId");

  // Verify the form exists
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

  const response = await insertResponse(c.env.DB, {
    id,
    formId,
    answersJson: JSON.stringify(body.answers ?? {}),
    metadataJson: body.metadata ? JSON.stringify(body.metadata) : null,
  });

  // Increment submit count without blocking the response
  c.executionCtx.waitUntil(incrementSubmitCount(c.env.DB, formId));

  return c.json(
    {
      id: response.id,
      submitted_at: response.submitted_at,
    },
    201,
  );
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

  const { responses: rows, total } = await getResponsesByFormId(
    c.env.DB,
    formId,
    {
      limit,
      offset,
      since: since ?? undefined,
    },
  );

  const formattedResponses = rows.map((row) => ({
    id: row.id,
    formId: row.form_id,
    answers: JSON.parse(row.answers_json),
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    submittedAt: row.submitted_at,
  }));

  return c.json({ responses: formattedResponses, total });
});

export { responsesApp };
