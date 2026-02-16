/**
 * In-memory DbAdapter for parameterized API tests.
 * Implements the full DbAdapter interface with mutable state.
 */
import type {
  DbAdapter,
  FormRow,
  ResponseRow,
  AnalyticsResult,
} from "@formant/service";

export class MemoryAdapter implements DbAdapter {
  private forms = new Map<string, FormRow>();
  private responses = new Map<string, ResponseRow>();
  private formResponses = new Map<string, string[]>();
  private viewsDaily = new Map<string, number>();

  private dailyKey(formId: string, date: string): string {
    return `${formId}:${date}`;
  }

  async insertForm(params: {
    id: string;
    title: string | null;
    html: string;
    schemaJson: string;
    apiKeyHash: string | null;
  }): Promise<FormRow> {
    const now = new Date().toISOString();
    const row: FormRow = {
      id: params.id,
      title: params.title,
      html: params.html,
      schema_json: params.schemaJson,
      api_key_hash: params.apiKeyHash,
      created_at: now,
      updated_at: now,
      view_count: 0,
      submit_count: 0,
    };
    this.forms.set(params.id, row);
    return row;
  }

  async getFormById(id: string): Promise<FormRow | null> {
    return this.forms.get(id) ?? null;
  }

  async incrementViewCount(id: string): Promise<void> {
    const form = this.forms.get(id);
    if (form) {
      form.view_count++;
      this.forms.set(id, form);
    }
  }

  async incrementViewCountDaily(formId: string): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    const key = this.dailyKey(formId, date);
    this.viewsDaily.set(key, (this.viewsDaily.get(key) ?? 0) + 1);
  }

  async incrementSubmitCount(id: string): Promise<void> {
    const form = this.forms.get(id);
    if (form) {
      form.submit_count++;
      this.forms.set(id, form);
    }
  }

  async deleteForm(id: string): Promise<boolean> {
    if (!this.forms.has(id)) return false;
    this.forms.delete(id);
    const ids = this.formResponses.get(id) ?? [];
    for (const rid of ids) this.responses.delete(rid);
    this.formResponses.delete(id);
    for (const [k] of this.viewsDaily) {
      if (k.startsWith(`${id}:`)) this.viewsDaily.delete(k);
    }
    return true;
  }

  async insertResponse(params: {
    id: string;
    formId: string;
    answersJson: string;
    metadataJson: string | null;
    status?: string;
    sessionId?: string | null;
  }): Promise<ResponseRow> {
    const status = (params.status ?? "completed") as "in_progress" | "completed";
    const now = new Date().toISOString();
    const row: ResponseRow = {
      id: params.id,
      form_id: params.formId,
      answers_json: params.answersJson,
      metadata_json: params.metadataJson,
      submitted_at: now,
      status,
      session_id: params.sessionId ?? null,
      updated_at: now,
    };
    this.responses.set(params.id, row);
    const list = this.formResponses.get(params.formId) ?? [];
    list.push(params.id);
    this.formResponses.set(params.formId, list);
    return row;
  }

  async updateResponse(params: {
    id: string;
    formId: string;
    answersJson: string;
    metadataJson: string | null;
    status: string;
  }): Promise<{ updated: boolean }> {
    const row = this.responses.get(params.id);
    if (!row || row.form_id !== params.formId) return { updated: false };
    if (row.status === "completed") return { updated: false };
    row.answers_json = params.answersJson;
    row.metadata_json = params.metadataJson;
    row.status = params.status;
    row.updated_at = new Date().toISOString();
    this.responses.set(params.id, row);
    return { updated: true };
  }

  async getResponsesByFormId(
    formId: string,
    options?: { limit?: number; offset?: number; since?: string; status?: string },
  ): Promise<{ responses: ResponseRow[]; total: number }> {
    const ids = this.formResponses.get(formId) ?? [];
    let rows = ids
      .map((id) => this.responses.get(id)!)
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
      );

    const status = options?.status ?? "all";
    if (status !== "all") {
      rows = rows.filter((r) => r.status === status);
    }
    if (options?.since) {
      rows = rows.filter((r) => r.submitted_at >= options.since!);
    }

    const total = rows.length;
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    const slice = rows.slice(offset, offset + limit);

    return { responses: slice, total };
  }

  async getAllResponsesForExport(
    formId: string,
    options?: { status?: string },
  ): Promise<ResponseRow[]> {
    const ids = this.formResponses.get(formId) ?? [];
    let rows = ids
      .map((id) => this.responses.get(id)!)
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
      );
    if (options?.status && options.status !== "all") {
      rows = rows.filter((r) => r.status === options.status);
    }
    return rows;
  }

  async getAnalytics(
    formId: string,
    days: 7 | 14 | 30,
  ): Promise<AnalyticsResult> {
    const form = this.forms.get(formId);
    if (!form) throw new Error("Form not found");

    const start = new Date();
    start.setDate(start.getDate() - days);
    const startStr = start.toISOString().slice(0, 10);

    const ids = this.formResponses.get(formId) ?? [];
    const rows = ids
      .map((id) => this.responses.get(id)!)
      .filter(Boolean)
      .filter((r) => (r.submitted_at?.slice(0, 10) ?? "") >= startStr);

    const completed = rows.filter((r) => r.status === "completed");
    const totalStarted = rows.length;
    const completionRate =
      totalStarted > 0 ? (completed.length / totalStarted) * 100 : 0;

    let totalDuration = 0;
    let durationCount = 0;
    for (const r of completed) {
      if (r.metadata_json) {
        try {
          const meta = JSON.parse(r.metadata_json) as { duration?: number };
          if (typeof meta.duration === "number") {
            totalDuration += meta.duration;
            durationCount++;
          }
        } catch {
          /* skip */
        }
      }
    }
    const avgDurationSeconds =
      durationCount > 0 ? totalDuration / durationCount : 0;

    const series: { date: string; views: number; submissions: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const views = this.viewsDaily.get(this.dailyKey(formId, dateStr)) ?? 0;
      const submissions = completed.filter(
        (r) => r.submitted_at?.slice(0, 10) === dateStr,
      ).length;
      series.push({ date: dateStr, views, submissions });
    }

    return {
      totals: {
        views: form.view_count,
        submissions: form.submit_count,
        completionRate,
        avgDurationSeconds,
      },
      series,
      highestDropoff: null,
    };
  }

  async insertOAuthSession(): Promise<void> {}

  async getAndDeleteOAuthSession(): Promise<{
    formId: string;
    schemaJson: string;
    redirectUri: string;
    codeVerifier: string;
  } | null> {
    return null;
  }
}
