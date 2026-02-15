import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { buildXlsx } from "../utils/xlsx";
import { buildCsv } from "../utils/csv";

const exportApp = new Hono<AppEnv>();

async function getFormAndResponses(c: Context<AppEnv>) {
  const formId = c.req.param("formId");
  const apiKeyHash = c.get("apiKeyHash");

  const form = await c.env.db.getFormById(formId);
  if (!form) return { error: "not_found" as const };
  if (form.api_key_hash !== apiKeyHash) return { error: "forbidden" as const };

  const responses = await c.env.db.getAllResponsesForExport(formId);
  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(form.schema_json) as Record<string, unknown>;
  } catch {
    schema = { fields: [] };
  }

  return { form, schema, responses };
}

// ─── GET /api/responses/:formId/xlsx — Export as Excel (auth required) ───

exportApp.get("/api/responses/:formId/xlsx", requireAuth(), async (c) => {
  const result = await getFormAndResponses(c);
  if (result.error === "not_found") return c.json({ error: "Form not found" }, 404);
  if (result.error === "forbidden") return c.json({ error: "Forbidden" }, 403);

  const { form, schema, responses } = result;
  const xlsxBuffer = buildXlsx(schema, responses);
  const safeTitle = (form.title ?? "formant").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${safeTitle}-responses.xlsx`;

  return new Response(xlsxBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

// ─── GET /api/responses/:formId/csv — Export as CSV (auth required) ───

exportApp.get("/api/responses/:formId/csv", requireAuth(), async (c) => {
  const result = await getFormAndResponses(c);
  if (result.error === "not_found") return c.json({ error: "Form not found" }, 404);
  if (result.error === "forbidden") return c.json({ error: "Forbidden" }, 403);

  const { form, schema, responses } = result;
  const csv = buildCsv(schema, responses);
  const safeTitle = (form.title ?? "formant").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${safeTitle}-responses.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

export { exportApp };
