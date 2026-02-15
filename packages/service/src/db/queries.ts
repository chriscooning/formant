// ─── Database Row Types ───

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

// ─── Form Queries ───

export async function insertForm(
  db: D1Database,
  params: {
    id: string;
    title: string | null;
    html: string;
    schemaJson: string;
    apiKeyHash: string | null;
  },
): Promise<FormRow> {
  await db
    .prepare(
      `INSERT INTO forms (id, title, html, schema_json, api_key_hash)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      params.id,
      params.title,
      params.html,
      params.schemaJson,
      params.apiKeyHash,
    )
    .run();

  const row = await db
    .prepare("SELECT * FROM forms WHERE id = ?")
    .bind(params.id)
    .first<FormRow>();

  if (!row) throw new Error("Failed to insert form");
  return row;
}

export async function getFormById(
  db: D1Database,
  id: string,
): Promise<FormRow | null> {
  return db.prepare("SELECT * FROM forms WHERE id = ?").bind(id).first<FormRow>();
}

export async function incrementViewCount(
  db: D1Database,
  id: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE forms SET view_count = view_count + 1, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(id)
    .run();
}

export async function incrementSubmitCount(
  db: D1Database,
  id: string,
): Promise<void> {
  await db
    .prepare(
      "UPDATE forms SET submit_count = submit_count + 1, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(id)
    .run();
}

export async function deleteForm(
  db: D1Database,
  id: string,
): Promise<boolean> {
  // Delete responses first, then the form
  await db.prepare("DELETE FROM responses WHERE form_id = ?").bind(id).run();

  const result = await db
    .prepare("DELETE FROM forms WHERE id = ?")
    .bind(id)
    .run();

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
    .bind(
      params.id,
      params.formId,
      params.answersJson,
      params.metadataJson,
      status,
      sessionId,
    )
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
    .bind(
      params.answersJson,
      params.metadataJson,
      params.status,
      params.id,
      params.formId,
    )
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
  let countQuery =
    "SELECT COUNT(*) as total FROM responses WHERE form_id = ?";
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

export async function getResponseCount(
  db: D1Database,
  formId: string,
): Promise<number> {
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
    .prepare(
      "SELECT * FROM responses WHERE form_id = ? AND status = ? ORDER BY submitted_at ASC",
    )
    .bind(formId, status)
    .all<ResponseRow>();
  return result.results;
}
