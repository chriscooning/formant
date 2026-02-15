/**
 * IndexedDB storage for Connect Google Sheet URLs.
 * Key: formId. Value: { url, spreadsheetUrl, connectedAt }.
 * Admin writes via setStoredSheetsUrl; form reads via getStoredSheetsUrl at submit time.
 */

const DB_NAME = "formant_sheets_config";
const STORE_NAME = "urls";
const DB_VERSION = 1;

export interface StoredSheetsConfig {
  url: string;
  spreadsheetUrl?: string;
  connectedAt?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      db.createObjectStore(STORE_NAME, { keyPath: "formId" });
    };
  });
}

/**
 * Get stored Sheets web app URL for a form, if any.
 */
export async function getStoredSheetsUrl(
  formId: string
): Promise<StoredSheetsConfig | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(formId);
      req.onsuccess = () => {
        db.close();
        const row = req.result as { formId: string } & StoredSheetsConfig | undefined;
        if (!row) {
          resolve(null);
          return;
        }
        resolve({
          url: row.url,
          spreadsheetUrl: row.spreadsheetUrl,
          connectedAt: row.connectedAt,
        });
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Store Sheets web app URL for a form. Used by admin after Connect flow.
 */
export async function setStoredSheetsUrl(
  formId: string,
  config: StoredSheetsConfig
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({
      formId,
      url: config.url,
      spreadsheetUrl: config.spreadsheetUrl,
      connectedAt: config.connectedAt ?? new Date().toISOString(),
    });
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
