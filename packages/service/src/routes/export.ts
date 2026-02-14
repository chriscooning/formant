import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import {
  getFormById,
  getAllResponsesForExport,
} from "../db/queries";
import type { ResponseRow } from "../db/queries";
import { buildXlsx } from "../utils/xlsx";

const exportApp = new Hono<AppEnv>();

// ─── GET /api/responses/:formId/xlsx — Export as Excel (auth required) ───

exportApp.get("/api/responses/:formId/xlsx", requireAuth(), async (c) => {
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

  const responses: ResponseRow[] = await getAllResponsesForExport(
    c.env.DB,
    formId,
  );

  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(form.schema_json) as Record<string, unknown>;
  } catch {
    schema = { fields: [] };
  }

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

export { exportApp };
