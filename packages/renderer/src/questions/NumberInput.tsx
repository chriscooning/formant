import React, { useEffect, useRef } from "react";
import type { NumberField } from "@formant/core";
import { ErrorMessage } from "../components/ErrorMessage";
import type { QuestionProps } from "./types";

export const NumberInput: React.FC<QuestionProps<number | undefined>> = ({
  field,
  value,
  onChange,
  error,
  questionNumber,
  totalQuestions,
  onNext,
}) => {
  const numberField = field as NumberField;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value;
    if (raw === "") {
      onChange(undefined);
    } else {
      const num = Number(raw);
      if (!Number.isNaN(num)) {
        onChange(num);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <div className="ff-question">
      <div className="ff-question-number">
        QUESTION {questionNumber} OF {totalQuestions}
      </div>
      <h2 className="ff-question-title">{numberField.title}</h2>
      {numberField.subtitle && (
        <p className="ff-question-subtitle">{numberField.subtitle}</p>
      )}
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        className="ff-input ff-input-underline"
        value={value ?? ""}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={numberField.placeholder}
        min={numberField.min}
        max={numberField.max}
        step={numberField.step}
      />
      <ErrorMessage message={error} />
    </div>
  );
};
