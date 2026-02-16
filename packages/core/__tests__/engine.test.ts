import { describe, it, expect } from "vitest";
import {
  createInitialState,
  resolveNextIndex,
  goNext,
  goBack,
  setAnswer,
  getProgress,
  isComplete,
} from "../src/engine";
import type { Field } from "../src/types";

// ─── Helper: build a simple linear form ───

function linearForm(count: number): Field[] {
  const fields: Field[] = [];
  for (let i = 0; i < count; i++) {
    fields.push({ id: `q${i + 1}`, type: "text", title: `Question ${i + 1}` });
  }
  fields.push({ id: "end", type: "ending", title: "Thank you" });
  return fields;
}

// ─── createInitialState ───

describe("createInitialState", () => {
  it("returns expected default values", () => {
    const state = createInitialState();
    expect(state.currentIndex).toBe(0);
    expect(state.answers).toEqual({});
    expect(state.history).toEqual([]);
  });

  it("startedAt is a recent timestamp", () => {
    const before = Date.now();
    const state = createInitialState();
    const after = Date.now();
    expect(state.startedAt).toBeGreaterThanOrEqual(before);
    expect(state.startedAt).toBeLessThanOrEqual(after);
  });

  it("accepts initialAnswers for prefill (e.g. URL params)", () => {
    const state = createInitialState({ name: "Alice", email: "alice@example.com" });
    expect(state.answers).toEqual({ name: "Alice", email: "alice@example.com" });
    expect(state.currentIndex).toBe(0);
  });
});

// ─── resolveNextIndex ───

describe("resolveNextIndex", () => {
  it("returns currentIndex + 1 for sequential (no next)", () => {
    const fields = linearForm(3);
    expect(resolveNextIndex(fields, 0, "answer")).toBe(1);
    expect(resolveNextIndex(fields, 1, "answer")).toBe(2);
  });

  it("handles unconditional jump (next is string)", () => {
    const fields: Field[] = [
      { id: "q1", type: "text", title: "Q1", next: "q3" },
      { id: "q2", type: "text", title: "Q2" },
      { id: "q3", type: "text", title: "Q3" },
      { id: "end", type: "ending", title: "End" },
    ];
    expect(resolveNextIndex(fields, 0, "anything")).toBe(2);
  });

  it("handles conditional branching (next is Record)", () => {
    const fields: Field[] = [
      {
        id: "q1",
        type: "choice",
        title: "Q1",
        options: ["A", "B"],
        next: { A: "field-a", B: "field-b" },
      },
      { id: "field-a", type: "text", title: "Field A" },
      { id: "field-b", type: "text", title: "Field B" },
      { id: "end", type: "ending", title: "End" },
    ];
    expect(resolveNextIndex(fields, 0, "A")).toBe(1);
    expect(resolveNextIndex(fields, 0, "B")).toBe(2);
  });

  it("handles multi_choice branching (first match wins)", () => {
    const fields: Field[] = [
      {
        id: "q1",
        type: "multi_choice",
        title: "Q1",
        options: ["A", "B", "C"],
        next: { A: "target-a", B: "target-b" },
      },
      { id: "target-a", type: "text", title: "Target A" },
      { id: "target-b", type: "text", title: "Target B" },
      { id: "end", type: "ending", title: "End" },
    ];
    // ["A", "C"] — A matches first
    expect(resolveNextIndex(fields, 0, ["A", "C"])).toBe(1);
    // ["C", "B"] — B is first matching key
    expect(resolveNextIndex(fields, 0, ["C", "B"])).toBe(2);
  });

  it('uses "default" key as fallback', () => {
    const fields: Field[] = [
      {
        id: "q1",
        type: "choice",
        title: "Q1",
        options: ["A", "B", "X"],
        next: { A: "field-a", default: "fallback" },
      },
      { id: "field-a", type: "text", title: "Field A" },
      { id: "fallback", type: "text", title: "Fallback" },
      { id: "end", type: "ending", title: "End" },
    ];
    expect(resolveNextIndex(fields, 0, "X")).toBe(2); // "fallback"
  });

  it("falls through to sequential when no match and no default", () => {
    const fields: Field[] = [
      {
        id: "q1",
        type: "choice",
        title: "Q1",
        options: ["A", "B", "X"],
        next: { A: "field-a" },
      },
      { id: "field-a", type: "text", title: "Field A" },
      { id: "end", type: "ending", title: "End" },
    ];
    expect(resolveNextIndex(fields, 0, "X")).toBe(1); // sequential
  });

  it("returns fields.length for last field (signals completion)", () => {
    const fields = linearForm(2);
    // Last field is the ending at index 2
    expect(resolveNextIndex(fields, 2, undefined)).toBe(3);
  });

  it("falls through to sequential when next string references nonexistent ID", () => {
    const fields: Field[] = [
      { id: "q1", type: "text", title: "Q1", next: "nonexistent" },
      { id: "end", type: "ending", title: "End" },
    ];
    expect(resolveNextIndex(fields, 0, "answer")).toBe(1);
  });
});

// ─── goNext / goBack ───

describe("goNext / goBack", () => {
  it("advances through a linear 5-question form", () => {
    const fields = linearForm(5);
    let state = createInitialState();

    for (let i = 0; i < 5; i++) {
      state = setAnswer(state, `q${i + 1}`, `answer-${i + 1}`);
      const next = goNext(state, fields);
      expect(next).not.toBeNull();
      state = next!;
      expect(state.currentIndex).toBe(i + 1);
    }

    // Now at the ending field (index 5)
    expect(state.currentIndex).toBe(5);
    expect(state.history).toEqual([0, 1, 2, 3, 4]);
  });

  it("goes back correctly (history pops)", () => {
    const fields = linearForm(3);
    let state = createInitialState();

    // Advance to index 1
    state = goNext(state, fields)!;
    // Advance to index 2
    state = goNext(state, fields)!;
    expect(state.currentIndex).toBe(2);
    expect(state.history).toEqual([0, 1]);

    // Go back to index 1
    state = goBack(state)!;
    expect(state.currentIndex).toBe(1);
    expect(state.history).toEqual([0]);

    // Go back to index 0
    state = goBack(state)!;
    expect(state.currentIndex).toBe(0);
    expect(state.history).toEqual([]);
  });

  it("returns null when going back at start", () => {
    const state = createInitialState();
    expect(goBack(state)).toBeNull();
  });

  it("returns null when going next at end", () => {
    const fields = linearForm(1);
    let state = createInitialState();
    // Advance to index 1 (ending)
    state = goNext(state, fields)!;
    // Advance past ending
    state = goNext(state, fields)!;
    expect(state.currentIndex).toBe(2);
    // Now past all fields
    expect(goNext(state, fields)).toBeNull();
  });
});

// ─── Branching flow ───

describe("branching flow", () => {
  const fields: Field[] = [
    {
      id: "q1",
      type: "choice",
      title: "Pick A or B",
      options: ["A", "B"],
      next: { A: "q-a", B: "q-b" },
    },
    { id: "q-a", type: "text", title: "You chose A" },
    { id: "q-b", type: "text", title: "You chose B" },
    { id: "end", type: "ending", title: "End" },
  ];

  it("navigates to q-a when answer is A", () => {
    let state = createInitialState();
    state = setAnswer(state, "q1", "A");
    state = goNext(state, fields)!;
    expect(state.currentIndex).toBe(1); // q-a
    expect(fields[state.currentIndex]!.id).toBe("q-a");
  });

  it("navigates to q-b when answer is B", () => {
    let state = createInitialState();
    state = setAnswer(state, "q1", "B");
    state = goNext(state, fields)!;
    expect(state.currentIndex).toBe(2); // q-b
    expect(fields[state.currentIndex]!.id).toBe("q-b");
  });

  it("goes back, changes answer, and branches differently", () => {
    let state = createInitialState();
    state = setAnswer(state, "q1", "A");
    state = goNext(state, fields)!;
    expect(fields[state.currentIndex]!.id).toBe("q-a");

    // Go back
    state = goBack(state)!;
    expect(state.currentIndex).toBe(0);

    // Change answer to B
    state = setAnswer(state, "q1", "B");
    state = goNext(state, fields)!;
    expect(fields[state.currentIndex]!.id).toBe("q-b");
  });

  it("maintains correct history through branches", () => {
    let state = createInitialState();
    state = setAnswer(state, "q1", "A");
    state = goNext(state, fields)!; // q-a
    state = goNext(state, fields)!; // q-b (sequential from q-a)
    state = goNext(state, fields)!; // end

    expect(state.history).toEqual([0, 1, 2]);
    expect(state.currentIndex).toBe(3);
  });
});

// ─── setAnswer ───

describe("setAnswer", () => {
  it("sets an answer immutably", () => {
    const state = createInitialState();
    const updated = setAnswer(state, "q1", "hello");

    expect(updated.answers["q1"]).toBe("hello");
    // Original not modified
    expect(state.answers["q1"]).toBeUndefined();
  });

  it("preserves existing answers", () => {
    let state = createInitialState();
    state = setAnswer(state, "q1", "a");
    state = setAnswer(state, "q2", "b");

    expect(state.answers["q1"]).toBe("a");
    expect(state.answers["q2"]).toBe("b");
  });

  it("overwrites existing answer for same field", () => {
    let state = createInitialState();
    state = setAnswer(state, "q1", "first");
    state = setAnswer(state, "q1", "second");

    expect(state.answers["q1"]).toBe("second");
  });
});

// ─── getProgress ───

describe("getProgress", () => {
  it("returns 0% when no questions answered", () => {
    const fields = linearForm(5);
    const state = createInitialState();
    expect(getProgress(state, fields)).toBe(0);
  });

  it("returns correct percentage for partial answers", () => {
    const fields = linearForm(5);
    let state = createInitialState();
    state = setAnswer(state, "q1", "a");
    state = setAnswer(state, "q2", "b");
    // 2 of 5 answerable questions = 40%
    expect(getProgress(state, fields)).toBe(40);
  });

  it("returns 100% when all answerable questions answered", () => {
    const fields = linearForm(5);
    let state = createInitialState();
    for (let i = 1; i <= 5; i++) {
      state = setAnswer(state, `q${i}`, `answer-${i}`);
    }
    expect(getProgress(state, fields)).toBe(100);
  });

  it("excludes welcome, ending, and statement from count", () => {
    const fields: Field[] = [
      { id: "w", type: "welcome", title: "Welcome" },
      { id: "q1", type: "text", title: "Q1" },
      { id: "s", type: "statement", title: "Statement" },
      { id: "q2", type: "text", title: "Q2" },
      { id: "end", type: "ending", title: "End" },
    ];
    let state = createInitialState();
    state = setAnswer(state, "q1", "a");
    // 1 of 2 answerable = 50%
    expect(getProgress(state, fields)).toBe(50);
  });

  it("returns 100% when form has no answerable fields", () => {
    const fields: Field[] = [
      { id: "w", type: "welcome", title: "Welcome" },
      { id: "end", type: "ending", title: "End" },
    ];
    const state = createInitialState();
    expect(getProgress(state, fields)).toBe(100);
  });
});

// ─── isComplete ───

describe("isComplete", () => {
  it("returns true when at ending field", () => {
    const fields = linearForm(2);
    let state = createInitialState();
    state = goNext(state, fields)!; // q2
    state = goNext(state, fields)!; // ending
    expect(isComplete(state, fields)).toBe(true);
  });

  it("returns true when past all fields", () => {
    const fields = linearForm(1);
    const state = { ...createInitialState(), currentIndex: fields.length + 5 };
    expect(isComplete(state, fields)).toBe(true);
  });

  it("returns false in the middle of the form", () => {
    const fields = linearForm(5);
    const state = createInitialState();
    expect(isComplete(state, fields)).toBe(false);
  });
});

// ─── Edge cases ───

describe("edge cases", () => {
  it("handles single-field form (just ending)", () => {
    const fields: Field[] = [
      { id: "end", type: "ending", title: "Done" },
    ];
    const state = createInitialState();
    expect(isComplete(state, fields)).toBe(true);
    expect(getProgress(state, fields)).toBe(100);
  });

  it("handles all optional fields with no answers", () => {
    const fields: Field[] = [
      { id: "q1", type: "text", title: "Q1" },
      { id: "q2", type: "text", title: "Q2" },
      { id: "end", type: "ending", title: "End" },
    ];
    let state = createInitialState();
    // Advance through without answering
    state = goNext(state, fields)!;
    state = goNext(state, fields)!;
    expect(isComplete(state, fields)).toBe(true);
    expect(getProgress(state, fields)).toBe(0);
  });

  it("handles deep branching (3+ levels)", () => {
    const fields: Field[] = [
      {
        id: "q1",
        type: "choice",
        title: "Level 1",
        options: ["A", "B"],
        next: { A: "q2a" },
      },
      { id: "q2a", type: "choice", title: "Level 2a", options: ["X", "Y"], next: { X: "q3a" } },
      { id: "q3a", type: "text", title: "Level 3a" },
      { id: "end", type: "ending", title: "End" },
    ];

    let state = createInitialState();
    state = setAnswer(state, "q1", "A");
    state = goNext(state, fields)!;
    expect(fields[state.currentIndex]!.id).toBe("q2a");

    state = setAnswer(state, "q2a", "X");
    state = goNext(state, fields)!;
    expect(fields[state.currentIndex]!.id).toBe("q3a");

    state = goNext(state, fields)!;
    expect(fields[state.currentIndex]!.id).toBe("end");
    expect(isComplete(state, fields)).toBe(true);

    // Verify full history
    expect(state.history).toEqual([0, 1, 2]);
  });
});
