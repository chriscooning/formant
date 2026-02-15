import type { FormResponse } from "@formant/core";

const DB_NAME = "formant_local";
const STORE_NAME = "responses";
const DB_VERSION = 2;

interface LocalRecord {
  formId: string;
  sessionId: string;
  status: "in_progress" | "completed";
  submittedAt: string;
  updatedAt: string;
  answers: Record<string, unknown>;
  metadata: unknown;
  lastFieldId?: string | null;
}

interface LegacyRecord {
  formId: string;
  id: string;
  submittedAt: string;
  answers: Record<string, unknown>;
  metadata: unknown;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const event = e as IDBVersionChangeEvent;
      const tx = (e.target as IDBOpenDBRequest).transaction;
      if (!tx) return;

      if (event.oldVersion === 0) {
        db.createObjectStore(STORE_NAME, {
          keyPath: ["formId", "sessionId"],
        });
        return;
      }
      if (event.oldVersion < 2) {
        const oldStore = tx.objectStore(STORE_NAME);
        const getAllReq = oldStore.getAll();
        getAllReq.onsuccess = () => {
          const records = getAllReq.result as LegacyRecord[];
          db.deleteObjectStore(STORE_NAME);
          const newStore = db.createObjectStore(STORE_NAME, {
            keyPath: ["formId", "sessionId"],
          });
          for (const r of records) {
            newStore.put({
              formId: r.formId,
              sessionId: r.id,
              status: "completed" as const,
              submittedAt: r.submittedAt,
              updatedAt: r.submittedAt,
              answers: r.answers ?? {},
              metadata: r.metadata ?? null,
            });
          }
        };
      }
    };
  });
}

/**
 * Save a completed response (legacy path — used when no partial was ever saved).
 * For forms with local destination, prefer completePartialToLocal on submit.
 */
export async function saveToLocal(
  formId: string,
  response: FormResponse
): Promise<void> {
  const sessionId =
    response.responseId ??
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const now = new Date().toISOString();
  const record: LocalRecord = {
    formId,
    sessionId,
    status: "completed",
    submittedAt: response.submittedAt,
    updatedAt: now,
    answers: response.answers,
    metadata: response.metadata ?? null,
    lastFieldId: response.metadata?.lastFieldId ?? null,
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Upsert a partial (in_progress) response by session.
 */
export async function savePartialToLocal(
  formId: string,
  sessionId: string,
  response: Omit<FormResponse, "status"> & { status?: "in_progress" }
): Promise<void> {
  const now = new Date().toISOString();
  const record: LocalRecord = {
    formId,
    sessionId,
    status: "in_progress",
    submittedAt: response.submittedAt,
    updatedAt: now,
    answers: response.answers,
    metadata: response.metadata ?? null,
    lastFieldId: response.metadata?.lastFieldId ?? null,
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Mark a partial as completed, or insert completed if no partial existed.
 */
export async function completePartialToLocal(
  formId: string,
  sessionId: string,
  response: FormResponse
): Promise<void> {
  const now = new Date().toISOString();
  const record: LocalRecord = {
    formId,
    sessionId,
    status: "completed",
    submittedAt: response.submittedAt,
    updatedAt: now,
    answers: response.answers,
    metadata: response.metadata ?? null,
    lastFieldId: response.metadata?.lastFieldId ?? null,
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function mapRecordToResponse(r: LocalRecord): FormResponse {
  const meta = (r.metadata ?? {}) as Record<string, unknown>;
  if (r.lastFieldId != null) meta.lastFieldId = r.lastFieldId;
  if (r.updatedAt) meta.updatedAt = r.updatedAt;
  return {
    formId: r.formId,
    responseId: r.sessionId,
    status: r.status,
    submittedAt: r.submittedAt,
    answers: r.answers,
    metadata: meta as FormResponse["metadata"],
  };
}

/**
 * Get completed responses only (for Full submissions tab).
 */
export async function getCompletedFromLocal(
  formId: string
): Promise<FormResponse[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const all = (req.result as LocalRecord[])
        .filter((r) => r.formId === formId && r.status === "completed")
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
        .map(mapRecordToResponse);
      resolve(all);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/**
 * Get partial (in_progress) responses only (for Partial submissions tab).
 */
export async function getPartialsFromLocal(
  formId: string
): Promise<FormResponse[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const all = (req.result as LocalRecord[])
        .filter((r) => r.formId === formId && r.status === "in_progress")
        .sort((a, b) => (b.updatedAt ?? b.submittedAt).localeCompare(a.updatedAt ?? a.submittedAt))
        .map(mapRecordToResponse);
      resolve(all);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/**
 * Get all responses (completed + partial). For backwards compat with admin that expects getAllFromLocal.
 */
export async function getAllFromLocal(formId: string): Promise<FormResponse[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const all = (req.result as LocalRecord[])
        .filter((r) => r.formId === formId)
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
        .map(mapRecordToResponse);
      resolve(all);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
