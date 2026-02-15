import { useRef, useEffect, useCallback, useState } from "react";
import type { FormSchema, EngineState, ServiceDestination } from "@formant/core";
import { getSessionId } from "../utils/sessionId";

export interface UseAutoSaveConfig {
  schema: FormSchema;
  state: EngineState;
  enabled: boolean; // Only auto-save when service destination is configured
}

export interface UseAutoSaveReturn {
  responseId: string | null; // Assigned by service after first save
  saving: boolean;
  lastSaved: number | null; // Timestamp
  markCompleted: () => void; // Signal that form is submitted — stop saving
}

/**
 * Progressive capture hook: saves answers as the user progresses
 * so incomplete submissions aren't lost.
 *
 * Only active when a `service` destination is configured.
 * Auto-save errors are always silent (console only).
 */
export function useAutoSave(config: UseAutoSaveConfig): UseAutoSaveReturn {
  const { schema, state, enabled } = config;

  // Find service destination
  const serviceDest = enabled
    ? (schema.submit?.destinations ?? []).find(
        (d): d is ServiceDestination => d.type === "service"
      )
    : undefined;

  const isActive = serviceDest !== undefined;
  const endpoint = serviceDest?.endpoint ?? "";
  const formId = serviceDest?.formId ?? schema.id;

  const [responseId, setResponseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const responseIdRef = useRef<string | null>(null);
  const completedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIndexRef = useRef(state.currentIndex);
  const hasInteractedRef = useRef(false);
  const stateRef = useRef(state);

  // Keep stateRef up to date
  stateRef.current = state;

  // Detect first interaction (user provides at least one answer)
  const hasAnswers = Object.keys(state.answers).length > 0;

  const saveState = useCallback(
    async (status: "in_progress" | "completed"): Promise<void> => {
      if (!isActive || completedRef.current) return;

      const currentState = stateRef.current;
      const currentField =
        currentState.currentIndex < schema.fields.length
          ? schema.fields[currentState.currentIndex]
          : undefined;

      const payload = {
        formId,
        status,
        answers: currentState.answers,
        metadata: {
          lastFieldId: currentField?.id ?? null,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
      };

      try {
        setSaving(true);

        if (responseIdRef.current) {
          // Update existing response
          await fetch(
            `${endpoint}/api/responses/${formId}/${responseIdRef.current}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          );
        } else {
          // Create new response (one POST per session)
          const res = await fetch(`${endpoint}/api/responses/${formId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...payload,
              sessionId: getSessionId(),
            }),
          });

          if (res.ok) {
            const data = (await res.json()) as { responseId?: string; id?: string };
            const id = data.responseId ?? data.id;
            if (id) {
              responseIdRef.current = id;
              setResponseId(id);
            }
          }
        }

        setLastSaved(Date.now());
      } catch (err) {
        // Auto-save errors are silent — never show to user
        console.error("[formant] auto-save error:", err);
      } finally {
        setSaving(false);
      }
    },
    [isActive, endpoint, formId, schema.fields]
  );

  // Create response on first interaction
  useEffect(() => {
    if (!isActive || hasInteractedRef.current || !hasAnswers) return;
    hasInteractedRef.current = true;
    void saveState("in_progress");
  }, [isActive, hasAnswers, saveState]);

  // Save on question advance (currentIndex changes)
  useEffect(() => {
    if (!isActive || !hasInteractedRef.current) return;
    if (state.currentIndex === prevIndexRef.current) return;

    prevIndexRef.current = state.currentIndex;
    void saveState("in_progress");
  }, [isActive, state.currentIndex, saveState]);

  // Debounced save while typing (answers change)
  useEffect(() => {
    if (!isActive || !hasInteractedRef.current || completedRef.current) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void saveState("in_progress");
    }, 3000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [isActive, state.answers, saveState]);

  // Save on page close via sendBeacon
  useEffect(() => {
    if (!isActive) return;

    const handleBeforeUnload = (): void => {
      if (completedRef.current || !hasInteractedRef.current) return;

      const currentState = stateRef.current;
      const currentField =
        currentState.currentIndex < schema.fields.length
          ? schema.fields[currentState.currentIndex]
          : undefined;

      const payload = JSON.stringify({
        formId,
        status: "in_progress" as const,
        answers: currentState.answers,
        metadata: {
          lastFieldId: currentField?.id ?? null,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
      });

      const url = responseIdRef.current
        ? `${endpoint}/api/responses/${formId}/${responseIdRef.current}`
        : `${endpoint}/api/responses/${formId}`;

      navigator.sendBeacon(url, payload);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isActive, endpoint, formId, schema.fields]);

  const markCompleted = useCallback((): void => {
    completedRef.current = true;

    // Clear any pending debounced save
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  // No-op return when inactive
  if (!isActive) {
    return {
      responseId: null,
      saving: false,
      lastSaved: null,
      markCompleted: () => {},
    };
  }

  return {
    responseId,
    saving,
    lastSaved,
    markCompleted,
  };
}
