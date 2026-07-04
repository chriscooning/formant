// ─── Database Adapter Interface ───
// Platform-agnostic interface for D1 (Cloudflare) and Postgres (Vercel).

export interface FormRow {
  id: string;
  title: string | null;
  html: string;
  schema_json: string;
  api_key_hash: string | null;
  created_at: string;
  updated_at: string;
  view_count: number;
  submit_count: number;
}

/** Slim projection of FormRow for listings — omits html/schema/api_key_hash. */
export interface FormSummaryRow {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  view_count: number;
  submit_count: number;
}

export interface ResponseRow {
  id: string;
  form_id: string;
  answers_json: string;
  metadata_json: string | null;
  submitted_at: string;
  status: string;
  session_id: string | null;
  updated_at: string | null;
}

export interface AnalyticsResult {
  totals: {
    views: number;
    submissions: number;
    completionRate: number;
    avgDurationSeconds: number;
  };
  series: { date: string; views: number; submissions: number }[];
  highestDropoff: {
    fieldId: string;
    fieldTitle: string;
    count: number;
  } | null;
}

export interface DbAdapter {
  insertForm(params: {
    id: string;
    title: string | null;
    html: string;
    schemaJson: string;
    apiKeyHash: string | null;
  }): Promise<FormRow>;
  getFormById(id: string): Promise<FormRow | null>;
  listFormsByApiKeyHash(apiKeyHash: string): Promise<FormSummaryRow[]>;
  updateForm(params: {
    id: string;
    title?: string | null;
    html?: string;
    schemaJson?: string;
  }): Promise<FormRow | null>;
  incrementViewCount(id: string): Promise<void>;
  incrementViewCountDaily(formId: string): Promise<void>;
  incrementSubmitCount(id: string): Promise<void>;
  deleteForm(id: string): Promise<boolean>;
  insertResponse(params: {
    id: string;
    formId: string;
    answersJson: string;
    metadataJson: string | null;
    status?: string;
    sessionId?: string | null;
  }): Promise<ResponseRow>;
  updateResponse(params: {
    id: string;
    formId: string;
    answersJson: string;
    metadataJson: string | null;
    status: string;
  }): Promise<{ updated: boolean }>;
  getResponsesByFormId(
    formId: string,
    options?: { limit?: number; offset?: number; since?: string; status?: string },
  ): Promise<{ responses: ResponseRow[]; total: number }>;
  getAllResponsesForExport(formId: string, options?: { status?: string }): Promise<ResponseRow[]>;
  getAnalytics(formId: string, days: 7 | 14 | 30): Promise<AnalyticsResult>;
  /** OAuth sessions for Connect Google Sheet (optional; used by connect-sheets route) */
  insertOAuthSession(params: {
    state: string;
    formId: string;
    schemaJson: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<void>;
  getAndDeleteOAuthSession(state: string): Promise<{
    formId: string;
    schemaJson: string;
    redirectUri: string;
    codeVerifier: string;
  } | null>;
}
