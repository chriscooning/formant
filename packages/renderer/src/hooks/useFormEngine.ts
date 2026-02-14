import { useState, useCallback } from "react";
import type { FormSchema, Field } from "@formant/core";
import {
  createInitialState,
  goNext as engineGoNext,
  goBack as engineGoBack,
  setAnswer as engineSetAnswer,
  getProgress,
  isComplete,
  validateField,
  type EngineState,
} from "@formant/core";

export interface UseFormEngineReturn {
  currentField: Field | null;
  currentIndex: number;
  answers: Record<string, unknown>;
  progress: number;
  complete: boolean;
  error: string | null;
  goNext: () => boolean;
  goBack: () => void;
  setAnswer: (fieldId: string, value: unknown) => void;
  setError: (error: string | null) => void;
  state: EngineState;
}

export function useFormEngine(schema: FormSchema): UseFormEngineReturn {
  const [state, setState] = useState<EngineState>(() => createInitialState());
  const [error, setError] = useState<string | null>(null);

  const currentField: Field | null =
    state.currentIndex < schema.fields.length
      ? schema.fields[state.currentIndex] ?? null
      : null;

  const progress = getProgress(state, schema.fields);
  const complete = isComplete(state, schema.fields);

  const goNext = useCallback((): boolean => {
    // Get current field for validation
    const field =
      state.currentIndex < schema.fields.length
        ? schema.fields[state.currentIndex] ?? null
        : null;

    if (field) {
      const answer = state.answers[field.id];
      const validationError = validateField(field, answer);
      if (validationError) {
        setError(validationError);
        return false;
      }
    }

    setError(null);
    const nextState = engineGoNext(state, schema.fields);
    if (nextState) {
      setState(nextState);
    }
    return true;
  }, [state, schema.fields]);

  const goBack = useCallback((): void => {
    setError(null);
    const prevState = engineGoBack(state);
    if (prevState) {
      setState(prevState);
    }
  }, [state]);

  const setAnswerValue = useCallback(
    (fieldId: string, value: unknown): void => {
      setError(null);
      setState((prev) => engineSetAnswer(prev, fieldId, value));
    },
    []
  );

  return {
    currentField,
    currentIndex: state.currentIndex,
    answers: state.answers,
    progress,
    complete,
    error,
    goNext,
    goBack,
    setAnswer: setAnswerValue,
    setError,
    state,
  };
}
