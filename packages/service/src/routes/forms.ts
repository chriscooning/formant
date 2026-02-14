import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import {
  insertForm,
  getFormById,
  incrementViewCount,
  deleteForm,
} from "../db/queries";
import { generateFormId } from "../utils/id";

const formsApp = new Hono<AppEnv>();

// ─── POST /api/forms — Create a form (auth required) ───

formsApp.post("/api/forms", requireAuth(), async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { html, schema } = body;

  if (!html || typeof html !== "string") {
    return c.json({ error: "html is required and must be a string" }, 400);
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return c.json({ error: "schema is required and must be an object" }, 400);
  }

  const id = generateFormId();
  const apiKeyHash = c.get("apiKeyHash");
  const schemaObj = schema as Record<string, unknown>;

  const form = await insertForm(c.env.DB, {
    id,
    title: typeof schemaObj.title === "string" ? schemaObj.title : null,
    html: html as string,
    schemaJson: JSON.stringify(schema),
    apiKeyHash,
  });

  return c.json(
    {
      id: form.id,
      url: `/f/${form.id}`,
      created_at: form.created_at,
    },
    201,
  );
});

// ─── GET /f/:id — Serve form HTML (public) ───

formsApp.get("/f/:id", async (c) => {
  const id = c.req.param("id");
  const form = await getFormById(c.env.DB, id);

  if (!form) {
    return c.text("Form not found", 404);
  }

  // Increment view count without blocking the response
  c.executionCtx.waitUntil(incrementViewCount(c.env.DB, id));

  return c.html(form.html, 200, {
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  });
});

// ─── DELETE /api/forms/:id — Delete a form (auth required) ───

formsApp.delete("/api/forms/:id", requireAuth(), async (c) => {
  const id = c.req.param("id");
  const apiKeyHash = c.get("apiKeyHash");

  const form = await getFormById(c.env.DB, id);
  if (!form) {
    return c.json({ error: "Form not found" }, 404);
  }

  // Verify the caller owns this form
  if (form.api_key_hash !== apiKeyHash) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await deleteForm(c.env.DB, id);
  return c.json({ success: true });
});

export { formsApp };
