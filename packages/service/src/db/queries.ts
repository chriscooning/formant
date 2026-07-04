// ─── Database Row Types ───
// Re-export from interface for backward compatibility
import type { FormRow, FormStatus, FormSummaryRow, ResponseRow } from "./interface";
export type {
  FormRow,
  FormStatus,
  FormSummaryRow,
  ResponseRow,
  AnalyticsResult,
} from "./interface";

// ─── Form Queries ───

export async function insertForm(
  db: D1Database,
  params: {
    id: string;
    title: string | null;
    html: string;
    schemaJson: string;
    apiKeyHash: string | null;
    status?: FormStatus;
  },
): Promise<FormRow> {
  await db
    .prepare(
      `INSERT INTO forms (id, title, html, schema_json, api_key_hash, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      params.id,
      params.title,
      params.html,
      params.schemaJson,
      params.apiKeyHash,
      params.status ?? "published",
    )
    .run();

  const row = await db.prepare("SELECT * FROM forms WHERE id = ?").bind(params.id).first<FormRow>();

  if (!row) throw new Error("Failed to insert form");
  return row;
}

export async function getFormById(db: D1Database, id: string): Promise<FormRow | null> {
  return db.prepare("SELECT * FROM forms WHERE id = ?").bind(id).first<FormRow>();
}

export async function listFormsByApiKeyHash(
  db: D1Database,
  apiKeyHash: string,
): Promise<FormSummaryRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, title, created_at, updated_at, view_count, submit_count, status
       FROM forms WHERE api_key_hash = ? ORDER BY created_at DESC`,
    )
    .bind(apiKeyHash)
    .all<FormSummaryRow>();
  return results ?? [];
}

export async function updateForm(
  db: D1Database,
  params: {
    id: string;
    title?: string | null;
    html?: string;
    schemaJson?: string;
    status?: FormStatus;
  },
): Promise<FormRow | null> {
  const sets: string[] = [];
  const binds: (string | null)[] = [];
  if (params.status !== undefined) {
    sets.push("status = ?");
    binds.push(params.status);
  }
  if (params.title !== undefined) {
    sets.push("title = ?");
    binds.push(params.title);
  }
  if (params.html !== undefined) {
    sets.push("html = ?");
    binds.push(params.html);
  }
  if (params.schemaJson !== undefined) {
    sets.push("schema_json = ?");
    binds.push(params.schemaJson);
  }
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    await db
      .prepare(`UPDATE forms SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...binds, params.id)
      .run();
  }
  return getFormById(db, params.id);
}

export async function incrementViewCount(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      "UPDATE forms SET view_count = view_count + 1, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(id)
    .run();
}

export async function incrementViewCountDaily(db: D1Database, formId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO form_views_daily (form_id, date, views) VALUES (?, date('now'), 1)
       ON CONFLICT(form_id, date) DO UPDATE SET views = views + 1`,
    )
    .bind(formId)
    .run();
}

export async function incrementSubmitCount(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      "UPDATE forms SET submit_count = submit_count + 1, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(id)
    .run();
}

export async function deleteForm(db: D1Database, id: string): Promise<boolean> {
  // Delete responses first, then the form
  await db.prepare("DELETE FROM responses WHERE form_id = ?").bind(id).run();

  const result = await db.prepare("DELETE FROM forms WHERE id = ?").bind(id).run();

  return result.meta.changes > 0;
}

// ─── Response Queries ───

export async function insertResponse(
  db: D1Database,
  params: {
    id: string;
    formId: string;
    answersJson: string;
    metadataJson: string | null;
    status?: "in_progress" | "completed";
    sessionId?: string | null;
  },
): Promise<ResponseRow> {
  const status = params.status ?? "completed";
  const sessionId = params.sessionId ?? null;

  await db
    .prepare(
      `INSERT INTO responses (id, form_id, answers_json, metadata_json, status, session_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(params.id, params.formId, params.answersJson, params.metadataJson, status, sessionId)
    .run();

  const row = await db
    .prepare("SELECT * FROM responses WHERE id = ?")
    .bind(params.id)
    .first<ResponseRow>();

  if (!row) throw new Error("Failed to insert response");
  return row;
}

export async function updateResponse(
  db: D1Database,
  params: {
    id: string;
    formId: string;
    answersJson: string;
    metadataJson: string | null;
    status: "in_progress" | "completed";
  },
): Promise<{ updated: boolean }> {
  const existing = await db
    .prepare("SELECT status FROM responses WHERE id = ? AND form_id = ?")
    .bind(params.id, params.formId)
    .first<{ status: string }>();

  if (!existing) return { updated: false };
  if (existing.status === "completed") return { updated: false };

  await db
    .prepare(
      `UPDATE responses SET answers_json = ?, metadata_json = ?, status = ?, updated_at = datetime('now')
       WHERE id = ? AND form_id = ?`,
    )
    .bind(params.answersJson, params.metadataJson, params.status, params.id, params.formId)
    .run();

  return { updated: true };
}

export async function getResponsesByFormId(
  db: D1Database,
  formId: string,
  options: {
    limit?: number;
    offset?: number;
    since?: string;
    status?: "in_progress" | "completed" | "all";
  } = {},
): Promise<{ responses: ResponseRow[]; total: number }> {
  const limit = options.limit ?? 100;
  const offset = options.offset ?? 0;

  let query = "SELECT * FROM responses WHERE form_id = ?";
  let countQuery = "SELECT COUNT(*) as total FROM responses WHERE form_id = ?";
  const bindings: (string | number)[] = [formId];
  const countBindings: (string | number)[] = [formId];

  if (options.since) {
    query += " AND submitted_at >= ?";
    countQuery += " AND submitted_at >= ?";
    bindings.push(options.since);
    countBindings.push(options.since);
  }

  if (options.status && options.status !== "all") {
    query += " AND status = ?";
    countQuery += " AND status = ?";
    bindings.push(options.status);
    countBindings.push(options.status);
  }

  const orderBy =
    options.status === "in_progress"
      ? "ORDER BY updated_at DESC, submitted_at DESC"
      : "ORDER BY submitted_at DESC";
  query += ` ${orderBy} LIMIT ? OFFSET ?`;
  bindings.push(limit, offset);

  const [responsesResult, countResult] = await Promise.all([
    db
      .prepare(query)
      .bind(...bindings)
      .all<ResponseRow>(),
    db
      .prepare(countQuery)
      .bind(...countBindings)
      .first<{ total: number }>(),
  ]);

  return {
    responses: responsesResult.results,
    total: countResult?.total ?? 0,
  };
}

// ─── OAuth Sessions (Connect Google Sheet) ───

export async function insertOAuthSession(
  db: D1Database,
  params: {
    state: string;
    formId: string;
    schemaJson: string;
    redirectUri: string;
    codeVerifier: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO oauth_sessions (state, form_id, schema_json, redirect_uri, code_verifier)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(params.state, params.formId, params.schemaJson, params.redirectUri, params.codeVerifier)
    .run();
}

export async function getAndDeleteOAuthSession(
  db: D1Database,
  state: string,
): Promise<{
  formId: string;
  schemaJson: string;
  redirectUri: string;
  codeVerifier: string;
} | null> {
  const row = await db
    .prepare(
      "SELECT form_id, schema_json, redirect_uri, code_verifier FROM oauth_sessions WHERE state = ?",
    )
    .bind(state)
    .first<{
      form_id: string;
      schema_json: string;
      redirect_uri: string;
      code_verifier: string;
    }>();

  if (!row) return null;

  await db.prepare("DELETE FROM oauth_sessions WHERE state = ?").bind(state).run();

  return {
    formId: row.form_id,
    schemaJson: row.schema_json,
    redirectUri: row.redirect_uri,
    codeVerifier: row.code_verifier,
  };
}

export async function getResponseCount(db: D1Database, formId: string): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as total FROM responses WHERE form_id = ?")
    .bind(formId)
    .first<{ total: number }>();
  return result?.total ?? 0;
}

export async function getAllResponsesForExport(
  db: D1Database,
  formId: string,
  options?: { status?: "in_progress" | "completed" },
): Promise<ResponseRow[]> {
  const status = options?.status ?? "completed";
  const result = await db
    .prepare("SELECT * FROM responses WHERE form_id = ? AND status = ? ORDER BY submitted_at ASC")
    .bind(formId, status)
    .all<ResponseRow>();
  return result.results;
}

// ─── Analytics ───

import type { AnalyticsResult } from "./interface";

export async function getAnalytics(
  db: D1Database,
  formId: string,
  days: 7 | 14 | 30,
): Promise<AnalyticsResult> {
  const form = await getFormById(db, formId);
  if (!form) {
    throw new Error("Form not found");
  }

  const dateMod = `-${days} days`;
  const startDate = (
    await db.prepare("SELECT date('now', ?) as d").bind(dateMod).first<{ d: string }>()
  )?.d;

  if (!startDate) {
    throw new Error("Failed to compute start date");
  }

  const schema = (() => {
    try {
      return JSON.parse(form.schema_json) as { fields?: Array<{ id: string; title?: string }> };
    } catch {
      return { fields: [] };
    }
  })();

  const fieldTitleMap = new Map<string, string>();
  for (const f of schema.fields ?? []) {
    if (f?.id) fieldTitleMap.set(f.id, f.title ?? f.id);
  }

  // Totals: views from forms, submissions from submit_count
  const views = form.view_count;
  const submissions = form.submit_count;

  // Completed and partial counts in range
  const completedInRange = await db
    .prepare(
      `SELECT COUNT(*) as n FROM responses WHERE form_id = ? AND status = 'completed'
       AND date(submitted_at) >= ?`,
    )
    .bind(formId, startDate)
    .first<{ n: number }>();

  const partialsInRange = await db
    .prepare(
      `SELECT COUNT(*) as n FROM responses WHERE form_id = ? AND status = 'in_progress'
       AND date(COALESCE(updated_at, submitted_at)) >= ?`,
    )
    .bind(formId, startDate)
    .first<{ n: number }>();

  const completedCount = completedInRange?.n ?? 0;
  const partialCount = partialsInRange?.n ?? 0;
  const totalStarted = completedCount + partialCount;
  const completionRate = totalStarted > 0 ? (completedCount / totalStarted) * 100 : 0;

  // Avg duration from completed in range
  const durationRows = await db
    .prepare(
      `SELECT metadata_json FROM responses WHERE form_id = ? AND status = 'completed'
       AND date(submitted_at) >= ? AND metadata_json IS NOT NULL`,
    )
    .bind(formId, startDate)
    .all<{ metadata_json: string | null }>();

  let totalDuration = 0;
  let durationCount = 0;
  for (const row of durationRows.results) {
    if (!row.metadata_json) continue;
    try {
      const meta = JSON.parse(row.metadata_json) as { duration?: number };
      if (typeof meta.duration === "number") {
        totalDuration += meta.duration;
        durationCount++;
      }
    } catch {
      /* skip */
    }
  }
  const avgDurationSeconds = durationCount > 0 ? totalDuration / durationCount : 0;

  // Series: views and submissions per date
  const viewsByDate = await db
    .prepare(
      `SELECT date, views FROM form_views_daily WHERE form_id = ? AND date >= ? ORDER BY date`,
    )
    .bind(formId, startDate)
    .all<{ date: string; views: number }>();

  const submissionsByDate = await db
    .prepare(
      `SELECT date(submitted_at) as date, COUNT(*) as n FROM responses
       WHERE form_id = ? AND status = 'completed' AND date(submitted_at) >= ?
       GROUP BY date(submitted_at) ORDER BY date`,
    )
    .bind(formId, startDate)
    .all<{ date: string; n: number }>();

  const viewsMap = new Map<string, number>();
  for (const r of viewsByDate.results) viewsMap.set(r.date, r.views);
  const subsMap = new Map<string, number>();
  for (const r of submissionsByDate.results) subsMap.set(r.date, r.n);

  const series: { date: string; views: number; submissions: number }[] = [];
  const today = (await db.prepare("SELECT date('now') as d").first<{ d: string }>())?.d;
  if (today) {
    const start = new Date(startDate);
    const end = new Date(today);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      series.push({
        date: dateStr,
        views: viewsMap.get(dateStr) ?? 0,
        submissions: subsMap.get(dateStr) ?? 0,
      });
    }
  }

  // Highest dropoff: partials grouped by lastFieldId
  const dropoffRow = await db
    .prepare(
      `SELECT json_extract(metadata_json, '$.lastFieldId') as field_id, COUNT(*) as cnt
       FROM responses WHERE form_id = ? AND status = 'in_progress'
       AND date(COALESCE(updated_at, submitted_at)) >= ?
       AND json_extract(metadata_json, '$.lastFieldId') IS NOT NULL
       GROUP BY json_extract(metadata_json, '$.lastFieldId')
       ORDER BY cnt DESC LIMIT 1`,
    )
    .bind(formId, startDate)
    .first<{ field_id: string; cnt: number }>();

  let highestDropoff: AnalyticsResult["highestDropoff"] = null;
  if (dropoffRow?.field_id) {
    const fieldTitle = fieldTitleMap.get(dropoffRow.field_id) ?? dropoffRow.field_id;
    highestDropoff = {
      fieldId: dropoffRow.field_id,
      fieldTitle,
      count: dropoffRow.cnt,
    };
  }

  return {
    totals: {
      views,
      submissions,
      completionRate,
      avgDurationSeconds,
    },
    series,
    highestDropoff,
  };
}
