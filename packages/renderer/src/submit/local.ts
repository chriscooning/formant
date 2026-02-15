import type { FormResponse } from "@formant/core";

const DB_NAME = "formant_local";
const STORE_NAME = "responses";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: ["formId", "id"] });
      }
    };
  });
}

export async function saveToLocal(
  formId: string,
  response: FormResponse
): Promise<void> {
  const id =
    response.responseId ??
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const record = {
    formId,
    id,
    submittedAt: response.submittedAt,
    answers: response.answers,
    metadata: response.metadata ?? null,
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

export async function getAllFromLocal(formId: string): Promise<FormResponse[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const all = (
        req.result as Array<{
          formId: string;
          id: string;
          submittedAt: string;
          answers: Record<string, unknown>;
          metadata: unknown;
        }>
      )
        .filter((r) => r.formId === formId)
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
        .map((r): FormResponse => ({
          formId: r.formId,
          responseId: r.id,
          status: "completed",
          submittedAt: r.submittedAt,
          answers: r.answers,
          metadata: r.metadata as FormResponse["metadata"],
        }));
      resolve(all);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}
