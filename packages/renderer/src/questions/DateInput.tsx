import React, { useEffect, useRef } from "react";
import type { DateField } from "@formant/core";
import { ErrorMessage } from "../components/ErrorMessage";
import type { QuestionProps } from "./types";

export const DateInput: React.FC<QuestionProps<string>> = ({
  field,
  value,
  onChange,
  error,
  questionNumber,
  totalQuestions,
}) => {
  const dateField = field as DateField;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onChange(e.target.value);
  };

  return (
    <div className="ff-question">
      <div className="ff-question-number">
        QUESTION {questionNumber} OF {totalQuestions}
      </div>
      <h2 className="ff-question-title">{dateField.title}</h2>
      {dateField.subtitle && (
        <p className="ff-question-subtitle">{dateField.subtitle}</p>
      )}
      <input
        ref={inputRef}
        type="date"
        className="ff-input ff-date-input"
        value={value ?? ""}
        onChange={handleChange}
        min={dateField.minDate}
        max={dateField.maxDate}
      />
      <ErrorMessage message={error} />
    </div>
  );
};
