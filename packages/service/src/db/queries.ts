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
  },
): Promise<ResponseRow> {
  await db
    .prepare(
      `INSERT INTO responses (id, form_id, answers_json, metadata_json)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(params.id, params.formId, params.answersJson, params.metadataJson)
    .run();

  const row = await db
    .prepare("SELECT * FROM responses WHERE id = ?")
    .bind(params.id)
    .first<ResponseRow>();

  if (!row) throw new Error("Failed to insert response");
  return row;
}

export async function getResponsesByFormId(
  db: D1Database,
  formId: string,
  options: {
    limit?: number;
    offset?: number;
    since?: string;
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

  query += " ORDER BY submitted_at DESC LIMIT ? OFFSET ?";
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
): Promise<ResponseRow[]> {
  const result = await db
    .prepare(
      "SELECT * FROM responses WHERE form_id = ? ORDER BY submitted_at ASC",
    )
    .bind(formId)
    .all<ResponseRow>();
  return result.results;
}
