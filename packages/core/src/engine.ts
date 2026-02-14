import type { Field } from "./types";

// ─── Engine State ───

export interface EngineState {
  currentIndex: number;
  answers: Record<string, unknown>;
  history: number[];
  startedAt: number;
}

// ─── Pure Functions ───

/**
 * Create the initial engine state.
 */
export function createInitialState(): EngineState {
  return {
    currentIndex: 0,
    answers: {},
    history: [],
    startedAt: Date.now(),
  };
}

/**
 * Resolve the next field index given the current field and answer.
 *
 * Branching rules:
 * - If field has `next` as a string: jump to that field ID's index.
 * - If field has `next` as a Record:
 *   - For multi_choice (answer is array): first matching option key wins.
 *   - For other types: look up String(answer) in the map.
 *   - Fallback to "default" key if present.
 *   - Otherwise fall through to sequential.
 * - No `next`: return currentIndex + 1.
 * - Clamp to fields.length (signals completion).
 */
export function resolveNextIndex(
  fields: Field[],
  currentIndex: number,
  answer: unknown
): number {
  const field = fields[currentIndex];

  if (field?.next !== undefined) {
    if (typeof field.next === "string") {
      const idx = fields.findIndex((f) => f.id === field.next);
      if (idx !== -1) {
        return idx;
      }
      // Not found — fall through to sequential
    } else if (typeof field.next === "object") {
      const nextMap = field.next;

      // Multi-choice: answer is an array; find first matching key
      if (field.type === "multi_choice" && Array.isArray(answer)) {
        for (const selected of answer) {
          const target = nextMap[String(selected)];
          if (target !== undefined) {
            const idx = fields.findIndex((f) => f.id === target);
            if (idx !== -1) return idx;
          }
        }
      } else {
        // All other types: look up String(answer)
        const target = nextMap[String(answer)];
        if (target !== undefined) {
          const idx = fields.findIndex((f) => f.id === target);
          if (idx !== -1) return idx;
        }
      }

      // Fallback to "default" key
      const defaultTarget = nextMap["default"];
      if (defaultTarget !== undefined) {
        const idx = fields.findIndex((f) => f.id === defaultTarget);
        if (idx !== -1) return idx;
      }

      // No match, no default — fall through to sequential
    }
  }

  const nextIndex = currentIndex + 1;
  return Math.min(nextIndex, fields.length);
}

/**
 * Advance to the next field.
 * Returns new state, or null if already at/past end.
 */
export function goNext(state: EngineState, fields: Field[]): EngineState | null {
  if (state.currentIndex >= fields.length) {
    return null;
  }

  const field = fields[state.currentIndex];
  if (!field) return null;

  const answer = state.answers[field.id];
  const nextIndex = resolveNextIndex(fields, state.currentIndex, answer);

  return {
    ...state,
    currentIndex: nextIndex,
    history: [...state.history, state.currentIndex],
  };
}

/**
 * Go back to the previous field.
 * Returns new state, or null if history is empty.
 */
export function goBack(state: EngineState): EngineState | null {
  if (state.history.length === 0) {
    return null;
  }

  const newHistory = [...state.history];
  const previousIndex = newHistory.pop()!;

  return {
    ...state,
    currentIndex: previousIndex,
    history: newHistory,
  };
}

/**
 * Set the answer for a field (immutable).
 */
export function setAnswer(
  state: EngineState,
  fieldId: string,
  value: unknown
): EngineState {
  return {
    ...state,
    answers: {
      ...state.answers,
      [fieldId]: value,
    },
  };
}

/** Field types that are not "answerable" questions */
const NON_ANSWERABLE: ReadonlySet<string> = new Set([
  "welcome",
  "ending",
  "statement",
]);

/**
 * Get progress as a percentage (0-100).
 * Excludes welcome, ending, and statement fields from the count.
 */
export function getProgress(state: EngineState, fields: Field[]): number {
  const answerable = fields.filter((f) => !NON_ANSWERABLE.has(f.type));
  const total = answerable.length;
  if (total === 0) return 100;

  const answered = answerable.filter(
    (f) => state.answers[f.id] !== undefined
  ).length;

  return Math.min(100, Math.max(0, Math.round((answered / total) * 100)));
}

/**
 * Check if the form is complete.
 * True if currentIndex is past all fields or on an ending field.
 */
export function isComplete(state: EngineState, fields: Field[]): boolean {
  if (state.currentIndex >= fields.length) return true;
  return fields[state.currentIndex]?.type === "ending";
}
