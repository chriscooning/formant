import React from "react";
import type { MultiChoiceField } from "@formant/core";
import { ErrorMessage } from "../components/ErrorMessage";
import type { QuestionProps } from "./types";

const LETTER_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const MultiChoice: React.FC<QuestionProps<string[]>> = ({
  field,
  value,
  onChange,
  error,
  questionNumber,
  totalQuestions,
  onNext,
}) => {
  const multiField = field as MultiChoiceField;
  const selected = value ?? [];

  const toggleOption = (option: string): void => {
    if (selected.includes(option)) {
      onChange(selected.filter((v) => v !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const minSelections = multiField.required
    ? (multiField.minSelections ?? 1)
    : (multiField.minSelections ?? 0);

  const canContinue = selected.length >= minSelections;

  return (
    <div className="ff-question">
      <div className="ff-question-number">
        QUESTION {questionNumber} OF {totalQuestions}
      </div>
      <h2 className="ff-question-title">{multiField.title}</h2>
      {multiField.subtitle && (
        <p className="ff-question-subtitle">{multiField.subtitle}</p>
      )}
      <div className="ff-multi-list">
        {multiField.options.map((option, idx) => {
          const letter = LETTER_KEYS[idx] ?? String(idx);
          const isChecked = selected.includes(option);

          return (
            <button
              key={option}
              type="button"
              className={`ff-multi-card${isChecked ? " ff-multi-card--selected" : ""}`}
              onClick={() => toggleOption(option)}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <span className={`ff-multi-check${isChecked ? " ff-multi-check--checked" : ""}`} />
              <span className="ff-choice-key">{letter}</span>
              <span className="ff-choice-label">{option}</span>
            </button>
          );
        })}
      </div>
      {canContinue && (
        <button
          type="button"
          className="ff-multi-continue"
          onClick={onNext}
        >
          Continue
        </button>
      )}
      <ErrorMessage message={error} />
    </div>
  );
};
