import { useEffect } from "react";
import type { Field } from "@formant/core";

export interface UseKeyboardConfig {
  onNext: () => void;
  onBack: () => void;
  onSelect: (key: string) => void;
  currentField: Field | null;
  phase: "entering" | "active" | "exiting";
  inputFocused: boolean;
}

export function useKeyboard(config: UseKeyboardConfig): void {
  const { onNext, onBack, onSelect, currentField, phase, inputFocused } =
    config;

  useEffect(() => {
    if (phase !== "active") return;

    function handleKeyDown(event: KeyboardEvent): void {
      const key = event.key;
      const fieldType = currentField?.type ?? null;

      // Enter key
      if (key === "Enter") {
        // For textarea, Enter creates newlines — don't intercept
        if (fieldType === "textarea") {
          // Only intercept Shift+Enter for textarea submit
          if (event.shiftKey) {
            event.preventDefault();
            onNext();
          }
          return;
        }
        event.preventDefault();
        onNext();
        return;
      }

      // Backspace — only when input is not focused
      if (key === "Backspace" && !inputFocused) {
        event.preventDefault();
        onBack();
        return;
      }

      // A-Z keys for choice and multi_choice
      if (
        (fieldType === "choice" || fieldType === "multi_choice") &&
        /^[a-zA-Z]$/.test(key)
      ) {
        event.preventDefault();
        onSelect(key.toUpperCase());
        return;
      }

      // Y / N keys for yes_no
      if (fieldType === "yes_no" && /^[ynYN]$/.test(key)) {
        event.preventDefault();
        onSelect(key.toUpperCase());
        return;
      }

      // 1-9, 0 keys for rating and scale
      if (
        (fieldType === "rating" || fieldType === "scale") &&
        /^[0-9]$/.test(key)
      ) {
        event.preventDefault();
        onSelect(key);
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [phase, onNext, onBack, onSelect, currentField, inputFocused]);
}
