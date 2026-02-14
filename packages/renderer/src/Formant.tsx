import React, { useState, useCallback, useRef } from "react";
import type { FormSchema, Field, ChoiceField, MultiChoiceField } from "@formant/core";
import { useFormEngine } from "./hooks/useFormEngine";
import { useKeyboard } from "./hooks/useKeyboard";
import { useTheme } from "./hooks/useTheme";
import { useAutoSave } from "./hooks/useAutoSave";
import { questionRegistry } from "./questions";
import type { EndingComponentProps } from "./questions";
import { ProgressBar } from "./components/ProgressBar";
import { ThemeToggle } from "./components/ThemeToggle";
import { TransitionWrapper } from "./components/TransitionWrapper";
import { KeyboardHint } from "./components/KeyboardHint";
import { submitResponses, type SubmitResult } from "./submit/handler";

/** Field types that are not answerable questions. */
const NON_ANSWERABLE = new Set(["welcome", "statement", "ending"]);

export interface FormantProps {
  schema: FormSchema;
}

export const Formant: React.FC<FormantProps> = ({ schema }) => {
  const {
    currentField,
    currentIndex,
    answers,
    progress,
    complete,
    error,
    goNext: engineGoNext,
    goBack: engineGoBack,
    setAnswer,
    setError,
    state,
  } = useFormEngine(schema);

  const { mode, toggle } = useTheme(schema.theme?.defaultMode ?? "auto");

  const [phase, setPhase] = useState<"entering" | "active" | "exiting">(
    "active"
  );
  const [submitResults, setSubmitResults] = useState<SubmitResult[] | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save: enabled when at least one service destination exists
  const hasServiceDest = (schema.submit?.destinations ?? []).some(
    (d) => d.type === "service"
  );
  const autoSave = useAutoSave({
    schema,
    state,
    enabled: hasServiceDest,
  });

  // Compute question number (1-indexed, answerable only) and total
  const answerableFields = schema.fields.filter(
    (f) => !NON_ANSWERABLE.has(f.type)
  );
  const totalQuestions = answerableFields.length;

  const getQuestionNumber = (idx: number): number => {
    let count = 0;
    for (let i = 0; i <= idx; i++) {
      const f = schema.fields[i];
      if (f && !NON_ANSWERABLE.has(f.type)) {
        count++;
      }
    }
    return count;
  };

  const questionNumber = getQuestionNumber(currentIndex);

  // ─── Submission ───

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (submitted || submitting) return;

    setSubmitting(true);

    try {
      const metadata = {
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "",
        duration: Math.round((Date.now() - state.startedAt) / 1000),
        completionRate: progress,
      };

      const results = await submitResponses(schema, answers, metadata);
      setSubmitResults(results);
      setSubmitted(true);

      // Signal auto-save to stop
      autoSave.markCompleted();
    } catch (err) {
      console.error("[formant] submit error:", err);
      setSubmitResults([
        {
          destination: "unknown",
          success: false,
          error: err instanceof Error ? err.message : String(err),
        },
      ]);
    } finally {
      setSubmitting(false);
    }
  }, [
    submitted,
    submitting,
    state.startedAt,
    progress,
    schema,
    answers,
    autoSave,
  ]);

  // ─── Transition Logic ───

  const transitionTo = useCallback(
    (action: () => void): void => {
      // Clear any existing transition
      if (transitionRef.current) {
        clearTimeout(transitionRef.current);
      }

      setPhase("exiting");

      transitionRef.current = setTimeout(() => {
        action();
        setPhase("entering");

        transitionRef.current = setTimeout(() => {
          setPhase("active");
        }, 50);
      }, 350);
    },
    []
  );

  const handleNext = useCallback((): void => {
    if (phase !== "active") return;

    // Check if advancing to an ending field — trigger submission
    const canAdvance = engineGoNext();

    if (!canAdvance) return;

    // The engine has already advanced. Check if we landed on ending.
    // Actually, we need to trigger transition BEFORE advancing.
    // Let me restructure: we validate first, then transition, then the engine state
    // has already been updated by goNext().

    // Since goNext() already updated state, we need to check if the new current field
    // is an ending. If so, trigger submit.
    // Note: state updates are async in React, so we check after the fact via effect.
  }, [phase, engineGoNext]);

  // Revised approach: we validate and advance in the transition callback
  const handleGoNext = useCallback((): void => {
    if (phase !== "active") return;

    // For non-answerable types (welcome, statement), just advance directly
    const field = currentField;
    if (!field) return;

    // Validate first (the engine's goNext does validation)
    // We'll trigger the transition, then advance

    transitionTo(() => {
      const advanced = engineGoNext();
      if (!advanced) {
        // Validation failed — snap back to active immediately
        setPhase("active");
      }
    });
  }, [phase, currentField, transitionTo, engineGoNext]);

  const handleGoBack = useCallback((): void => {
    if (phase !== "active") return;
    if (state.history.length === 0) return;

    transitionTo(() => {
      engineGoBack();
    });
  }, [phase, state.history.length, transitionTo, engineGoBack]);

  // ─── Submit on reaching ending ───

  const submittedForIndex = useRef<number | null>(null);

  // When we land on an ending field and haven't submitted, trigger submission
  React.useEffect(() => {
    if (
      complete &&
      !submitted &&
      !submitting &&
      submittedForIndex.current !== currentIndex
    ) {
      submittedForIndex.current = currentIndex;
      void handleSubmit();
    }
  }, [complete, submitted, submitting, currentIndex, handleSubmit]);

  // ─── Keyboard ───

  const handleSelect = useCallback(
    (key: string): void => {
      if (!currentField || phase !== "active") return;

      switch (currentField.type) {
        case "choice": {
          const idx = key.charCodeAt(0) - "A".charCodeAt(0);
          const options = (currentField as ChoiceField).options;
          if (idx >= 0 && idx < options.length) {
            const option = options[idx];
            if (option !== undefined) {
              setAnswer(currentField.id, option);
            }
          }
          break;
        }
        case "multi_choice": {
          const idx = key.charCodeAt(0) - "A".charCodeAt(0);
          const options = (currentField as MultiChoiceField).options;
          if (idx >= 0 && idx < options.length) {
            const option = options[idx];
            if (option !== undefined) {
              const current = (answers[currentField.id] as string[]) ?? [];
              const newVal = current.includes(option)
                ? current.filter((v) => v !== option)
                : [...current, option];
              setAnswer(currentField.id, newVal);
            }
          }
          break;
        }
        case "yes_no": {
          setAnswer(currentField.id, key === "Y");
          break;
        }
        case "rating": {
          const num = parseInt(key, 10);
          if (num >= 1) {
            setAnswer(currentField.id, num);
          }
          break;
        }
        case "scale": {
          const num = parseInt(key, 10);
          setAnswer(currentField.id, num);
          break;
        }
        default:
          break;
      }
    },
    [currentField, phase, answers, setAnswer]
  );

  useKeyboard({
    onNext: handleGoNext,
    onBack: handleGoBack,
    onSelect: handleSelect,
    currentField,
    phase,
    inputFocused,
  });

  // ─── Render ───

  if (!currentField) {
    return null;
  }

  const QuestionComponent = questionRegistry[currentField.type];
  if (!QuestionComponent) {
    return null;
  }

  // Build props based on field type
  const isEnding = currentField.type === "ending";

  const questionProps = isEnding
    ? ({
        field: currentField,
        value: undefined,
        onChange: () => {},
        error: null,
        questionNumber,
        totalQuestions,
        onNext: handleGoNext,
        answers,
        fields: schema.fields,
      } satisfies EndingComponentProps)
    : {
        field: currentField,
        value: answers[currentField.id],
        onChange: (value: unknown) => {
          setAnswer(currentField.id, value);
          setError(null);
        },
        error,
        questionNumber,
        totalQuestions,
        onNext: handleGoNext,
      };

  return (
    <div className="ff-root" data-theme={mode}>
      <ProgressBar progress={progress} />
      <ThemeToggle mode={mode} onToggle={toggle} />
      {state.history.length > 0 && phase === "active" && (
        <button
          type="button"
          className="ff-back-btn"
          onClick={handleGoBack}
          aria-label="Go back"
        >
          &larr;
        </button>
      )}
      <div className="ff-question-container">
        <TransitionWrapper phase={phase}>
          <QuestionComponent {...questionProps} />
        </TransitionWrapper>
      </div>
      {submitting && (
        <div className="ff-submit-status" aria-live="polite">
          Submitting...
        </div>
      )}
      <KeyboardHint field={currentField} />
    </div>
  );
};
