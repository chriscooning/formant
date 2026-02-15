const SESSION_KEY = "formant_session_id";

/**
 * Get or create a session ID for the current browser tab.
 * Persists in sessionStorage — new tab = new session.
 */
export function getSessionId(): string {
  if (typeof sessionStorage === "undefined") {
    return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : null) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
