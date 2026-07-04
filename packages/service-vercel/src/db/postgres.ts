// ─── Postgres Adapter ───
// Implements DbAdapter using @vercel/postgres (Vercel Postgres / Neon).

import { sql } from "@vercel/postgres";
import type {
  DbAdapter,
  FormRow,
  FormStatus,
  FormSummaryRow,
  ResponseRow,
  AnalyticsResult,
} from "@formant/service";

function rowToFormRow(r: Record<string, unknown>): FormRow {
  return {
    id: String(r.id),
    title: r.title != null ? String(r.title) : null,
    html: String(r.html),
    schema_json: String(r.schema_json),
    api_key_hash: r.api_key_hash != null ? String(r.api_key_hash) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    view_count: Number(r.view_count) || 0,
    submit_count: Number(r.submit_count) || 0,
    status: (r.status as FormStatus) ?? "published",
  };
}

function rowToResponseRow(r: Record<string, unknown>): ResponseRow {
  return {
    id: String(r.id),
    form_id: String(r.form_id),
    answers_json: String(r.answers_json),
    metadata_json: r.metadata_json != null ? String(r.metadata_json) : null,
    submitted_at: String(r.submitted_at),
    status: String(r.status),
    session_id: r.session_id != null ? String(r.session_id) : null,
    updated_at: r.updated_at != null ? String(r.updated_at) : null,
  };
}

export class PostgresAdapter implements DbAdapter {
  async insertForm(params: {
    id: string;
    title: string | null;
    html: string;
    schemaJson: string;
    apiKeyHash: string | null;
    status?: FormStatus;
  }): Promise<FormRow> {
    await sql`
      INSERT INTO forms (id, title, html, schema_json, api_key_hash, status)
      VALUES (${params.id}, ${params.title}, ${params.html}, ${params.schemaJson}, ${params.apiKeyHash}, ${params.status ?? "published"})
    `;
    const { rows } = await sql`SELECT * FROM forms WHERE id = ${params.id}`;
    const r = rows[0];
    if (!r) throw new Error("Failed to insert form");
    return rowToFormRow(r as Record<string, unknown>);
  }

  async getFormById(id: string): Promise<FormRow | null> {
    const { rows } = await sql`SELECT * FROM forms WHERE id = ${id}`;
    const r = rows[0];
    if (!r) return null;
    return rowToFormRow(r as Record<string, unknown>);
  }

  async listFormsByApiKeyHash(apiKeyHash: string): Promise<FormSummaryRow[]> {
    const { rows } = await sql`
      SELECT id, title, created_at, updated_at, view_count, submit_count, status
      FROM forms WHERE api_key_hash = ${apiKeyHash} ORDER BY created_at DESC
    `;
    return rows.map((r) => ({
      id: String(r.id),
      title: r.title != null ? String(r.title) : null,
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      view_count: Number(r.view_count) || 0,
      submit_count: Number(r.submit_count) || 0,
      status: (r.status as FormStatus) ?? "published",
    }));
  }

  async updateForm(params: {
    id: string;
    title?: string | null;
    html?: string;
    schemaJson?: string;
    status?: FormStatus;
  }): Promise<FormRow | null> {
    if (
      params.title !== undefined ||
      params.html !== undefined ||
      params.schemaJson !== undefined ||
      params.status !== undefined
    ) {
      await sql`
        UPDATE forms SET
          title = CASE WHEN ${params.title !== undefined} THEN ${params.title ?? null} ELSE title END,
          html = COALESCE(${params.html ?? null}, html),
          schema_json = COALESCE(${params.schemaJson ?? null}, schema_json),
          status = COALESCE(${params.status ?? null}, status),
          updated_at = NOW()
        WHERE id = ${params.id}
      `;
    }
    return this.getFormById(params.id);
  }

  async incrementViewCount(id: string): Promise<void> {
    await sql`
      UPDATE forms SET view_count = view_count + 1, updated_at = NOW() WHERE id = ${id}
    `;
  }

  async incrementViewCountDaily(formId: string): Promise<void> {
    await sql`
      INSERT INTO form_views_daily (form_id, date, views)
      VALUES (${formId}, CURRENT_DATE, 1)
      ON CONFLICT (form_id, date) DO UPDATE SET views = form_views_daily.views + 1
    `;
  }

  async incrementSubmitCount(id: string): Promise<void> {
    await sql`
      UPDATE forms SET submit_count = submit_count + 1, updated_at = NOW() WHERE id = ${id}
    `;
  }

  async deleteForm(id: string): Promise<boolean> {
    await sql`DELETE FROM responses WHERE form_id = ${id}`;
    const res = await sql`DELETE FROM forms WHERE id = ${id}`;
    return ((res as { rowCount?: number }).rowCount ?? 0) > 0;
  }

  async insertResponse(params: {
    id: string;
    formId: string;
    answersJson: string;
    metadataJson: string | null;
    status?: string;
    sessionId?: string | null;
  }): Promise<ResponseRow> {
    const status = params.status ?? "completed";
    const sessionId = params.sessionId ?? null;
    await sql`
      INSERT INTO responses (id, form_id, answers_json, metadata_json, status, session_id)
      VALUES (${params.id}, ${params.formId}, ${params.answersJson}, ${params.metadataJson}, ${status}, ${sessionId})
    `;
    const { rows } = await sql`SELECT * FROM responses WHERE id = ${params.id}`;
    const r = rows[0];
    if (!r) throw new Error("Failed to insert response");
    return rowToResponseRow(r as Record<string, unknown>);
  }

  async updateResponse(params: {
    id: string;
    formId: string;
    answersJson: string;
    metadataJson: string | null;
    status: string;
  }): Promise<{ updated: boolean }> {
    const { rows } = await sql`
      SELECT status FROM responses WHERE id = ${params.id} AND form_id = ${params.formId}
    `;
    const existing = rows[0] as { status: string } | undefined;
    if (!existing) return { updated: false };
    if (existing.status === "completed") return { updated: false };

    await sql`
      UPDATE responses
      SET answers_json = ${params.answersJson}, metadata_json = ${params.metadataJson},
          status = ${params.status}, updated_at = NOW()
      WHERE id = ${params.id} AND form_id = ${params.formId}
    `;
    return { updated: true };
  }

  async getResponsesByFormId(
    formId: string,
    options?: { limit?: number; offset?: number; since?: string; status?: string },
  ): Promise<{ responses: ResponseRow[]; total: number }> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    const since = options?.since ?? "1970-01-01";
    const status = options?.status ?? "all";

    let responsesRes;
    let countRes;

    if (status === "in_progress") {
      responsesRes = await sql`SELECT * FROM responses
        WHERE form_id = ${formId} AND submitted_at >= ${since}
          AND status = ${status}
        ORDER BY updated_at DESC NULLS LAST, submitted_at DESC
        LIMIT ${limit} OFFSET ${offset}`;
      countRes = await sql`SELECT COUNT(*)::int as total FROM responses
        WHERE form_id = ${formId} AND submitted_at >= ${since}
          AND status = ${status}`;
    } else if (status === "completed") {
      responsesRes = await sql`SELECT * FROM responses
        WHERE form_id = ${formId} AND submitted_at >= ${since}
          AND status = ${status}
        ORDER BY submitted_at DESC
        LIMIT ${limit} OFFSET ${offset}`;
      countRes = await sql`SELECT COUNT(*)::int as total FROM responses
        WHERE form_id = ${formId} AND submitted_at >= ${since}
          AND status = ${status}`;
    } else {
      responsesRes = await sql`SELECT * FROM responses
        WHERE form_id = ${formId} AND submitted_at >= ${since}
          AND status IN ('in_progress', 'completed')
        ORDER BY submitted_at DESC
        LIMIT ${limit} OFFSET ${offset}`;
      countRes = await sql`SELECT COUNT(*)::int as total FROM responses
        WHERE form_id = ${formId} AND submitted_at >= ${since}
          AND status IN ('in_progress', 'completed')`;
    }

    const total = (countRes.rows[0] as { total: number })?.total ?? 0;
    const responses = (responsesRes.rows as Record<string, unknown>[]).map(rowToResponseRow);

    return { responses, total };
  }

  async getAllResponsesForExport(
    formId: string,
    options?: { status?: string },
  ): Promise<ResponseRow[]> {
    const status = options?.status ?? "completed";
    const { rows } = await sql`
      SELECT * FROM responses
      WHERE form_id = ${formId} AND status = ${status}
      ORDER BY submitted_at ASC
    `;
    return (rows as Record<string, unknown>[]).map(rowToResponseRow);
  }

  async getAnalytics(formId: string, days: 7 | 14 | 30): Promise<AnalyticsResult> {
    const form = await this.getFormById(formId);
    if (!form) throw new Error("Form not found");

    const startDateRes = await sql`SELECT (CURRENT_DATE - INTERVAL '1 day' * ${days})::date as d`;
    const startDate = (startDateRes.rows[0] as { d: string })?.d;
    if (!startDate) throw new Error("Failed to compute start date");

    const schema = (() => {
      try {
        return JSON.parse(form.schema_json) as {
          fields?: Array<{ id: string; title?: string }>;
        };
      } catch {
        return { fields: [] };
      }
    })();

    const fieldTitleMap = new Map<string, string>();
    for (const f of schema.fields ?? []) {
      if (f?.id) fieldTitleMap.set(f.id, f.title ?? f.id);
    }

    const views = form.view_count;
    const submissions = form.submit_count;

    const completedRes = await sql`
      SELECT COUNT(*)::int as n FROM responses
      WHERE form_id = ${formId} AND status = 'completed'
        AND submitted_at::date >= ${startDate}
    `;
    const partialsRes = await sql`
      SELECT COUNT(*)::int as n FROM responses
      WHERE form_id = ${formId} AND status = 'in_progress'
        AND COALESCE(updated_at, submitted_at)::date >= ${startDate}
    `;

    const completedCount = (completedRes.rows[0] as { n: number })?.n ?? 0;
    const partialCount = (partialsRes.rows[0] as { n: number })?.n ?? 0;
    const totalStarted = completedCount + partialCount;
    const completionRate = totalStarted > 0 ? (completedCount / totalStarted) * 100 : 0;

    const durationRes = await sql`
      SELECT metadata_json FROM responses
      WHERE form_id = ${formId} AND status = 'completed'
        AND submitted_at::date >= ${startDate}
        AND metadata_json IS NOT NULL
    `;

    let totalDuration = 0;
    let durationCount = 0;
    for (const row of durationRes.rows) {
      const metaJson = (row as { metadata_json: string }).metadata_json;
      if (!metaJson) continue;
      try {
        const meta = JSON.parse(metaJson) as { duration?: number };
        if (typeof meta.duration === "number") {
          totalDuration += meta.duration;
          durationCount++;
        }
      } catch {
        /* skip */
      }
    }
    const avgDurationSeconds = durationCount > 0 ? totalDuration / durationCount : 0;

    const viewsByDateRes = await sql`
      SELECT date::text, views FROM form_views_daily
      WHERE form_id = ${formId} AND date >= ${startDate}
      ORDER BY date
    `;
    const submissionsByDateRes = await sql`
      SELECT submitted_at::date::text as date, COUNT(*)::int as n FROM responses
      WHERE form_id = ${formId} AND status = 'completed'
        AND submitted_at::date >= ${startDate}
      GROUP BY submitted_at::date ORDER BY date
    `;

    const viewsMap = new Map<string, number>();
    for (const r of viewsByDateRes.rows as { date: string; views: number }[]) {
      viewsMap.set(r.date, r.views);
    }
    const subsMap = new Map<string, number>();
    for (const r of submissionsByDateRes.rows as { date: string; n: number }[]) {
      subsMap.set(r.date, r.n);
    }

    const todayRes = await sql`SELECT CURRENT_DATE::text as d`;
    const today = (todayRes.rows[0] as { d: string })?.d;
    const series: { date: string; views: number; submissions: number }[] = [];

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

    const dropoffRes = await sql`
      SELECT (metadata_json::json->>'lastFieldId') as field_id, COUNT(*)::int as cnt
      FROM responses
      WHERE form_id = ${formId} AND status = 'in_progress'
        AND COALESCE(updated_at, submitted_at)::date >= ${startDate}
        AND metadata_json::json->>'lastFieldId' IS NOT NULL
      GROUP BY metadata_json::json->>'lastFieldId'
      ORDER BY cnt DESC LIMIT 1
    `;

    const dropoffRow = dropoffRes.rows[0] as { field_id: string; cnt: number } | undefined;
    let highestDropoff: AnalyticsResult["highestDropoff"] = null;
    if (dropoffRow?.field_id) {
      highestDropoff = {
        fieldId: dropoffRow.field_id,
        fieldTitle: fieldTitleMap.get(dropoffRow.field_id) ?? dropoffRow.field_id,
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

  async insertOAuthSession(params: {
    state: string;
    formId: string;
    schemaJson: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<void> {
    await sql`
      INSERT INTO oauth_sessions (state, form_id, schema_json, redirect_uri, code_verifier)
      VALUES (${params.state}, ${params.formId}, ${params.schemaJson}, ${params.redirectUri}, ${params.codeVerifier})
    `;
  }

  async getAndDeleteOAuthSession(state: string): Promise<{
    formId: string;
    schemaJson: string;
    redirectUri: string;
    codeVerifier: string;
  } | null> {
    const { rows } = await sql`
      SELECT form_id, schema_json, redirect_uri, code_verifier
      FROM oauth_sessions WHERE state = ${state}
    `;
    const row = rows[0] as
      | { form_id: string; schema_json: string; redirect_uri: string; code_verifier: string }
      | undefined;
    if (!row) return null;

    await sql`DELETE FROM oauth_sessions WHERE state = ${state}`;

    return {
      formId: row.form_id,
      schemaJson: row.schema_json,
      redirectUri: row.redirect_uri,
      codeVerifier: row.code_verifier,
    };
  }
}
