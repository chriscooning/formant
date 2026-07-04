import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
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

  const { html, schema, id: clientId } = body;

  if (!html || typeof html !== "string") {
    return c.json({ error: "html is required and must be a string" }, 400);
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return c.json({ error: "schema is required and must be an object" }, 400);
  }

  // Optional client-provided id (for deploy scripts that need to patch schema before upload)
  const id =
    typeof clientId === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(clientId)
      ? clientId
      : generateFormId();
  const apiKeyHash = c.get("apiKeyHash");
  const schemaObj = schema as Record<string, unknown>;

  const form = await c.env.db.insertForm({
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

// ─── GET /api/forms — List caller's forms (auth required) ───

formsApp.get("/api/forms", requireAuth(), async (c) => {
  const apiKeyHash = c.get("apiKeyHash");
  const forms = await c.env.db.listFormsByApiKeyHash(apiKeyHash);
  return c.json({
    forms: forms.map((f) => ({
      id: f.id,
      title: f.title,
      url: `/f/${f.id}`,
      created_at: f.created_at,
      updated_at: f.updated_at,
      view_count: f.view_count,
      submit_count: f.submit_count,
    })),
  });
});

// ─── GET /api/forms/:id — Fetch a form's schema + metadata (auth required) ───

formsApp.get("/api/forms/:id", requireAuth(), async (c) => {
  const id = c.req.param("id");
  const apiKeyHash = c.get("apiKeyHash");

  const form = await c.env.db.getFormById(id);
  if (!form) {
    return c.json({ error: "Form not found" }, 404);
  }
  if (form.api_key_hash !== apiKeyHash) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let schema: unknown;
  try {
    schema = JSON.parse(form.schema_json);
  } catch {
    schema = null;
  }

  return c.json({
    id: form.id,
    title: form.title,
    url: `/f/${form.id}`,
    schema,
    created_at: form.created_at,
    updated_at: form.updated_at,
    view_count: form.view_count,
    submit_count: form.submit_count,
  });
});

// ─── PUT /api/forms/:id — Update a form's schema and/or html (auth required) ───

formsApp.put("/api/forms/:id", requireAuth(), async (c) => {
  const id = c.req.param("id");
  const apiKeyHash = c.get("apiKeyHash");

  const existing = await c.env.db.getFormById(id);
  if (!existing) {
    return c.json({ error: "Form not found" }, 404);
  }
  if (existing.api_key_hash !== apiKeyHash) {
    return c.json({ error: "Forbidden" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { html, schema } = body;
  if (html === undefined && schema === undefined) {
    return c.json({ error: "Provide html and/or schema to update" }, 400);
  }
  if (html !== undefined && typeof html !== "string") {
    return c.json({ error: "html must be a string" }, 400);
  }
  if (
    schema !== undefined &&
    (typeof schema !== "object" || schema === null || Array.isArray(schema))
  ) {
    return c.json({ error: "schema must be an object" }, 400);
  }

  const schemaObj = schema as Record<string, unknown> | undefined;
  const form = await c.env.db.updateForm({
    id,
    html: html as string | undefined,
    schemaJson: schema !== undefined ? JSON.stringify(schema) : undefined,
    title:
      schemaObj !== undefined
        ? typeof schemaObj.title === "string"
          ? schemaObj.title
          : null
        : undefined,
  });

  if (!form) {
    return c.json({ error: "Form not found" }, 404);
  }

  return c.json({
    id: form.id,
    title: form.title,
    url: `/f/${form.id}`,
    updated_at: form.updated_at,
  });
});

// ─── GET /f/:id — Serve form HTML (public) ───

formsApp.get("/f/:id", async (c) => {
  const id = c.req.param("id");
  const form = await c.env.db.getFormById(id);

  if (!form) {
    return c.text("Form not found", 404);
  }

  // Increment view count (total + daily) without blocking the response
  c.executionCtx.waitUntil(
    Promise.all([c.env.db.incrementViewCount(id), c.env.db.incrementViewCountDaily(id)]),
  );

  return c.html(form.html, 200, {
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  });
});

// ─── DELETE /api/forms/:id — Delete a form (auth required) ───

formsApp.delete("/api/forms/:id", requireAuth(), async (c) => {
  const id = c.req.param("id");
  const apiKeyHash = c.get("apiKeyHash");

  const form = await c.env.db.getFormById(id);
  if (!form) {
    return c.json({ error: "Form not found" }, 404);
  }

  // Verify the caller owns this form
  if (form.api_key_hash !== apiKeyHash) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await c.env.db.deleteForm(id);
  return c.json({ success: true });
});

export { formsApp };
