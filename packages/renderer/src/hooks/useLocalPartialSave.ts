import { useRef, useEffect, useCallback } from "react";
import type { FormSchema, EngineState } from "@formant/core";
import { getSessionId } from "../utils/sessionId";
import { savePartialToLocal } from "../submit/local";

export interface UseLocalPartialSaveConfig {
  schema: FormSchema;
  state: EngineState;
  enabled: boolean;
}

export interface UseLocalPartialSaveReturn {
  markCompleted: () => void;
}

/**
 * Progressive capture for local (IndexedDB) destination.
 * Upserts partial state by session. On submit, call markCompleted with the full response.
 */
export function useLocalPartialSave(
  config: UseLocalPartialSaveConfig
): UseLocalPartialSaveReturn {
  const { schema, state, enabled } = config;

  const isActive = enabled;
  const formId = schema.id;

  const completedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIndexRef = useRef(state.currentIndex);
  const hasInteractedRef = useRef(false);
  const stateRef = useRef(state);

  stateRef.current = state;

  const hasAnswers = Object.keys(state.answers).length > 0;

  const savePartial = useCallback(() => {
    if (!isActive || completedRef.current) return;

    const currentState = stateRef.current;
    const currentField =
      currentState.currentIndex < schema.fields.length
        ? schema.fields[currentState.currentIndex]
        : undefined;

    const sessionId = getSessionId();
    void savePartialToLocal(formId, sessionId, {
      formId,
      status: "in_progress",
      submittedAt: new Date().toISOString(),
      answers: currentState.answers,
      metadata: {
        lastFieldId: currentField?.id,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
    });
  }, [isActive, formId, schema.fields]);

  useEffect(() => {
    if (!isActive || hasInteractedRef.current || !hasAnswers) return;
    hasInteractedRef.current = true;
    savePartial();
  }, [isActive, hasAnswers, savePartial]);

  useEffect(() => {
    if (!isActive || !hasInteractedRef.current) return;
    if (state.currentIndex === prevIndexRef.current) return;
    prevIndexRef.current = state.currentIndex;
    savePartial();
  }, [isActive, state.currentIndex, savePartial]);

  useEffect(() => {
    if (!isActive || !hasInteractedRef.current || completedRef.current) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(savePartial, 3000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [isActive, state.answers, savePartial]);

  const markCompleted = useCallback(() => {
    completedRef.current = true;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  if (!isActive) {
    return { markCompleted: () => {} };
  }

  return { markCompleted };
}
