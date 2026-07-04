import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { generateFormId } from "../utils/id";
import { assembleHostedFormHTML, withServiceDestination } from "../utils/assemble-form";
import { qrSvg } from "../utils/qr-svg";
import type { FormStatus } from "../db/interface";

const formsApp = new Hono<AppEnv>();

const FORM_STATUSES: FormStatus[] = ["draft", "published", "closed"];

function parseStatus(value: unknown): FormStatus | null | undefined {
  if (value === undefined) return undefined;
  return FORM_STATUSES.includes(value as FormStatus) ? (value as FormStatus) : null;
}

/** Minimal self-contained page served in place of a closed form. */
function closedFormHTML(title: string | null): string {
  const safe = (title ?? "This form").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safe}</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0a0a0c; color:#e0e0e0; text-align:center; padding:24px; }
  @media (prefers-color-scheme: light) { body { background:#fafafa; color:#1a1a1a; } }
  h1 { font-size:22px; margin:0 0 10px; } p { color:#888; font-size:15px; margin:0; }
</style></head>
<body><div><h1>${safe} is closed</h1><p>This form is no longer accepting responses.</p></div></body></html>`;
}

// ─── POST /api/forms — Create a form (auth required) ───
// Two modes:
//   { html, schema }  — prebuilt HTML (CLI/deploy scripts; schema stored as-is)
//   { schema }        — server-side assembly: the service patches in its own
//                       submit destination and builds the HTML itself

formsApp.post("/api/forms", requireAuth(), async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { html, schema, id: clientId } = body;

  if (html !== undefined && typeof html !== "string") {
    return c.json({ error: "html must be a string" }, 400);
  }
  const createStatus = parseStatus(body.status);
  if (createStatus === null) {
    return c.json({ error: "status must be draft, published, or closed" }, 400);
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

  let htmlToStore: string;
  let schemaToStore: Record<string, unknown>;
  if (typeof html === "string") {
    htmlToStore = html;
    schemaToStore = schema as Record<string, unknown>;
  } else {
    schemaToStore = withServiceDestination(schema as Record<string, unknown>, id);
    try {
      htmlToStore = assembleHostedFormHTML(schemaToStore);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Invalid schema" }, 400);
    }
  }

  const form = await c.env.db.insertForm({
    id,
    title: typeof schemaToStore.title === "string" ? (schemaToStore.title as string) : null,
    html: htmlToStore,
    schemaJson: JSON.stringify(schemaToStore),
    apiKeyHash,
    status: createStatus,
  });

  return c.json(
    {
      id: form.id,
      url: `/f/${form.id}`,
      status: form.status,
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
      status: f.status,
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
    status: form.status,
    schema,
    created_at: form.created_at,
    updated_at: form.updated_at,
    view_count: form.view_count,
    submit_count: form.submit_count,
  });
});

// ─── GET /api/forms/:id/qr — QR code SVG for the form's public URL (auth required) ───

formsApp.get("/api/forms/:id/qr", requireAuth(), async (c) => {
  const id = c.req.param("id");
  const apiKeyHash = c.get("apiKeyHash");

  const form = await c.env.db.getFormById(id);
  if (!form) {
    return c.json({ error: "Form not found" }, 404);
  }
  if (form.api_key_hash !== apiKeyHash) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const origin = new URL(c.req.url).origin;
  const svg = qrSvg(`${origin}/f/${id}`);
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "no-store",
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
  const putStatus = parseStatus(body.status);
  if (putStatus === null) {
    return c.json({ error: "status must be draft, published, or closed" }, 400);
  }
  if (html === undefined && schema === undefined && putStatus === undefined) {
    return c.json({ error: "Provide html, schema, and/or status to update" }, 400);
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

  // Schema without prebuilt HTML → server-side assembly, so the stored HTML
  // can never go stale relative to the schema.
  let schemaObj = schema as Record<string, unknown> | undefined;
  let htmlToStore = html as string | undefined;
  if (schemaObj !== undefined && htmlToStore === undefined) {
    schemaObj = withServiceDestination(schemaObj, id);
    try {
      htmlToStore = assembleHostedFormHTML(schemaObj);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Invalid schema" }, 400);
    }
  }

  const form = await c.env.db.updateForm({
    id,
    html: htmlToStore,
    schemaJson: schemaObj !== undefined ? JSON.stringify(schemaObj) : undefined,
    status: putStatus,
    title:
      schemaObj !== undefined
        ? typeof schemaObj.title === "string"
          ? (schemaObj.title as string)
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
    status: form.status,
    updated_at: form.updated_at,
  });
});

// ─── GET /f/:id — Serve form HTML (public) ───

formsApp.get("/f/:id", async (c) => {
  const id = c.req.param("id");
  const form = await c.env.db.getFormById(id);

  if (!form || form.status === "draft") {
    return c.text("Form not found", 404);
  }

  if (form.status === "closed") {
    return c.html(closedFormHTML(form.title), 200, { "Cache-Control": "no-store" });
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
