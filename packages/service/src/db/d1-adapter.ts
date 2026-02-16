// ─── D1 Adapter ───
// Implements DbAdapter by wrapping the existing D1 queries.

import type { DbAdapter, FormRow, ResponseRow, AnalyticsResult } from "./interface";
import * as queries from "./queries";

export class D1Adapter implements DbAdapter {
  constructor(private db: D1Database) {}

  async insertForm(params: {
    id: string;
    title: string | null;
    html: string;
    schemaJson: string;
    apiKeyHash: string | null;
  }): Promise<FormRow> {
    return queries.insertForm(this.db, params);
  }

  async getFormById(id: string): Promise<FormRow | null> {
    return queries.getFormById(this.db, id);
  }

  async incrementViewCount(id: string): Promise<void> {
    return queries.incrementViewCount(this.db, id);
  }

  async incrementViewCountDaily(formId: string): Promise<void> {
    return queries.incrementViewCountDaily(this.db, formId);
  }

  async incrementSubmitCount(id: string): Promise<void> {
    return queries.incrementSubmitCount(this.db, id);
  }

  async deleteForm(id: string): Promise<boolean> {
    return queries.deleteForm(this.db, id);
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
    const sessionId = params.sessionId ?? null;
    return queries.insertResponse(this.db, {
      ...params,
      status,
      sessionId,
    });
  }

  async updateResponse(params: {
    id: string;
    formId: string;
    answersJson: string;
    metadataJson: string | null;
    status: string;
  }): Promise<{ updated: boolean }> {
    return queries.updateResponse(this.db, {
      ...params,
      status: params.status as "in_progress" | "completed",
    });
  }

  async getResponsesByFormId(
    formId: string,
    options?: { limit?: number; offset?: number; since?: string; status?: string },
  ): Promise<{ responses: ResponseRow[]; total: number }> {
    const opts = options
      ? {
          ...options,
          status: (options.status ?? "all") as "in_progress" | "completed" | "all",
        }
      : undefined;
    return queries.getResponsesByFormId(this.db, formId, opts);
  }

  async getAllResponsesForExport(
    formId: string,
    options?: { status?: string },
  ): Promise<ResponseRow[]> {
    const opts = options
      ? { status: options.status as "in_progress" | "completed" }
      : undefined;
    return queries.getAllResponsesForExport(this.db, formId, opts);
  }

  async getAnalytics(
    formId: string,
    days: 7 | 14 | 30,
  ): Promise<AnalyticsResult> {
    return queries.getAnalytics(this.db, formId, days);
  }

  async insertOAuthSession(params: {
    state: string;
    formId: string;
    schemaJson: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<void> {
    return queries.insertOAuthSession(this.db, params);
  }

  async getAndDeleteOAuthSession(
    state: string,
  ): Promise<{
    formId: string;
    schemaJson: string;
    redirectUri: string;
    codeVerifier: string;
  } | null> {
    return queries.getAndDeleteOAuthSession(this.db, state);
  }
}
