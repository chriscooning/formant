import React, { useEffect, useRef } from "react";
import type { TextAreaField } from "@formant/core";
import { ErrorMessage } from "../components/ErrorMessage";
import type { QuestionProps } from "./types";

export const TextArea: React.FC<QuestionProps<string>> = ({
  field,
  value,
  onChange,
  error,
  questionNumber,
  totalQuestions,
  onNext,
}) => {
  const textAreaField = field as TextAreaField;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    onChange(e.target.value);
  };

  const currentLength = (value ?? "").length;
  const hasContent = currentLength > 0;

  return (
    <div className="ff-question">
      <div className="ff-question-number">
        QUESTION {questionNumber} OF {totalQuestions}
      </div>
      <h2 className="ff-question-title">{textAreaField.title}</h2>
      {textAreaField.subtitle && (
        <p className="ff-question-subtitle">{textAreaField.subtitle}</p>
      )}
      <textarea
        ref={textareaRef}
        className="ff-textarea"
        value={value ?? ""}
        onChange={handleChange}
        placeholder={textAreaField.placeholder}
        rows={textAreaField.rows ?? 4}
        maxLength={textAreaField.maxLength}
      />
      <div className="ff-textarea-actions">
        {hasContent && (
          <button
            type="button"
            className="ff-textarea-ok"
            onClick={onNext}
          >
            OK ✓
          </button>
        )}
        {textAreaField.maxLength != null && (
          <span className="ff-char-count">
            {currentLength}/{textAreaField.maxLength}
          </span>
        )}
      </div>
      <ErrorMessage message={error} />
    </div>
  );
};
