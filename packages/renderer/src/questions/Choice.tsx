import React, { useEffect, useRef, useState } from "react";
import type { ChoiceField } from "@formant/core";
import { ErrorMessage } from "../components/ErrorMessage";
import type { QuestionProps } from "./types";

const LETTER_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const Choice: React.FC<QuestionProps<string>> = ({
  field,
  value,
  onChange,
  error,
  questionNumber,
  totalQuestions,
  onNext,
}) => {
  const choiceField = field as ChoiceField;
  const [otherText, setOtherText] = useState("");
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-advance after 300ms on selection
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current !== null) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  const handleSelect = (option: string): void => {
    onChange(option);

    // Clear any existing timer
    if (autoAdvanceTimer.current !== null) {
      clearTimeout(autoAdvanceTimer.current);
    }

    // Don't auto-advance if "Other" is selected — user needs to type
    if (option !== "__other__") {
      autoAdvanceTimer.current = setTimeout(() => {
        onNext();
      }, 300);
    }
  };

  const handleOtherChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const text = e.target.value;
    setOtherText(text);
    onChange(text);
  };

  // Handle keyboard selection via letter keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const key = e.key.toUpperCase();
      const idx = LETTER_KEYS.indexOf(key);
      if (idx === -1) return;

      if (idx < choiceField.options.length) {
        handleSelect(choiceField.options[idx]!);
      } else if (choiceField.allowOther && idx === choiceField.options.length) {
        handleSelect("__other__");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choiceField.options, choiceField.allowOther]);

  return (
    <div className="ff-question">
      <div className="ff-question-number">
        QUESTION {questionNumber} OF {totalQuestions}
      </div>
      <h2 className="ff-question-title">{choiceField.title}</h2>
      {choiceField.subtitle && (
        <p className="ff-question-subtitle">{choiceField.subtitle}</p>
      )}
      <div className="ff-choice-list">
        {choiceField.options.map((option, idx) => {
          const letter = LETTER_KEYS[idx] ?? String(idx);
          const isSelected = value === option;

          return (
            <button
              key={option}
              type="button"
              className={`ff-choice-card${isSelected ? " ff-choice-card--selected" : ""}`}
              onClick={() => handleSelect(option)}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <span className="ff-choice-key">{letter}</span>
              <span className="ff-choice-label">{option}</span>
            </button>
          );
        })}
        {choiceField.allowOther && (
          <div>
            <button
              type="button"
              className={`ff-choice-card${value === "__other__" || (value != null && value !== "" && !choiceField.options.includes(value)) ? " ff-choice-card--selected" : ""}`}
              onClick={() => handleSelect("__other__")}
              style={{ animationDelay: `${choiceField.options.length * 50}ms` }}
            >
              <span className="ff-choice-key">
                {LETTER_KEYS[choiceField.options.length] ?? "?"}
              </span>
              <span className="ff-choice-label">Other</span>
            </button>
            {(value === "__other__" || (value != null && value !== "" && !choiceField.options.includes(value))) && (
              <input
                type="text"
                className="ff-choice-other-input"
                value={otherText}
                onChange={handleOtherChange}
                placeholder="Type your answer..."
                autoFocus
              />
            )}
          </div>
        )}
      </div>
      <ErrorMessage message={error} />
    </div>
  );
};
