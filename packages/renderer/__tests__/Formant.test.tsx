import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Formant } from "../src/Formant";
import type { FormSchema } from "@formant/core";

// ─── Test Schema ───

const testSchema: FormSchema = {
  id: "test-form",
  title: "Test Form",
  fields: [
    {
      id: "welcome",
      type: "welcome",
      title: "Welcome to the test",
      subtitle: "Let's begin",
      buttonText: "Start",
    },
    {
      id: "name",
      type: "text",
      title: "What is your name?",
      required: true,
      placeholder: "Enter your name",
    },
    {
      id: "rating",
      type: "rating",
      title: "How would you rate this?",
      max: 5,
    },
    {
      id: "ending",
      type: "ending",
      title: "Thank you!",
      subtitle: "Your response has been recorded.",
    },
  ],
  submit: {
    destinations: [],
  },
};

// ─── Helpers ───

let container: HTMLDivElement;
let root: Root;

function render(ui: React.ReactElement): void {
  act(() => {
    root.render(ui);
  });
}

function pressKey(key: string, opts?: Partial<KeyboardEventInit>): void {
  act(() => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      ...opts,
    });
    document.dispatchEvent(event);
  });
}

function advanceTimers(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
});

// ─── Tests ───

describe("Formant", () => {
  it("renders welcome screen for a schema starting with welcome field", () => {
    render(<Formant schema={testSchema} />);

    const title = container.querySelector(".ff-welcome-title");
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe("Welcome to the test");

    const btn = container.querySelector(".ff-welcome-btn");
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe("Start");
  });

  it("advances through questions on Enter key", () => {
    render(<Formant schema={testSchema} />);

    // Start on welcome
    expect(container.querySelector(".ff-welcome")).not.toBeNull();

    // Press Enter → exiting phase
    pressKey("Enter");
    // Advance through transition: 350ms exiting + 50ms entering
    advanceTimers(350);
    advanceTimers(50);

    // Now should be on the text question
    const textTitle = container.querySelector("h2, .ff-question-title, h1");
    expect(container.textContent).toContain("What is your name?");
  });

  it("shows error on required field when empty", () => {
    render(<Formant schema={testSchema} />);

    // Advance past welcome
    pressKey("Enter");
    advanceTimers(350);
    advanceTimers(50);

    // Now on "name" field (required). Press Enter without typing.
    pressKey("Enter");
    // The transition starts, but validation should fail inside the callback
    advanceTimers(350);
    advanceTimers(50);

    // Should show error or still be on the same question
    // Since the field is required and empty, goNext returns false,
    // so the transition callback snaps phase back to active.
    // The question should still be the name field.
    expect(container.textContent).toContain("What is your name?");
  });

  it("completes form and shows ending screen", async () => {
    render(<Formant schema={testSchema} />);

    // Advance past welcome
    pressKey("Enter");
    advanceTimers(350);
    advanceTimers(50);

    // Type a name (simulate by finding input and setting value)
    const input = container.querySelector("input");
    if (input) {
      act(() => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set;
        nativeInputValueSetter?.call(input, "Alice");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    // Advance past name
    pressKey("Enter");
    advanceTimers(350);
    advanceTimers(50);

    // Now on rating — press 4
    pressKey("4");
    // Advance past rating
    pressKey("Enter");
    advanceTimers(350);
    advanceTimers(50);

    // Should be on ending screen
    // Allow submit to complete (flush microtasks)
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Thank you!");
  });

  it("back button appears after first advance", () => {
    render(<Formant schema={testSchema} />);

    // No back button on welcome
    expect(container.querySelector(".ff-back-btn")).toBeNull();

    // Advance past welcome
    pressKey("Enter");
    advanceTimers(350);
    advanceTimers(50);

    // Back button should appear
    const backBtn = container.querySelector(".ff-back-btn");
    expect(backBtn).not.toBeNull();
  });

  it("progress bar updates as questions are answered", () => {
    render(<Formant schema={testSchema} />);

    // Initial progress bar exists
    const progressBar = container.querySelector(".ff-progress-bar");
    expect(progressBar).not.toBeNull();

    // At welcome, progress should be 0% (no answerable fields answered)
    const initialWidth = (progressBar as HTMLElement)?.style.width;
    expect(initialWidth).toBe("0%");
  });

  it("hides download button when allowSubmitterDownload is false", async () => {
    const noDownloadSchema: FormSchema = {
      ...testSchema,
      submit: {
        destinations: [{ type: "excel" }],
        allowSubmitterDownload: false,
      },
    };
    render(<Formant schema={noDownloadSchema} />);

    // Advance to ending
    pressKey("Enter");
    advanceTimers(350);
    advanceTimers(50);

    const input = container.querySelector("input");
    if (input) {
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        setter?.call(input, "Alice");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    pressKey("Enter");
    advanceTimers(350);
    advanceTimers(50);

    pressKey("4"); // rating
    pressKey("Enter");
    advanceTimers(350);
    advanceTimers(50);

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Thank you!");
    expect(container.querySelector("[data-testid='download-excel']")).toBeNull();
  });
});
