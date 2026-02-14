import React, { useEffect, useRef } from "react";
import type { YesNoField } from "@formant/core";
import { ErrorMessage } from "../components/ErrorMessage";
import type { QuestionProps } from "./types";

export const YesNo: React.FC<QuestionProps<boolean | undefined>> = ({
  field,
  value,
  onChange,
  error,
  questionNumber,
  totalQuestions,
  onNext,
}) => {
  const yesNoField = field as YesNoField;
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current !== null) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  const handleSelect = (answer: boolean): void => {
    onChange(answer);

    if (autoAdvanceTimer.current !== null) {
      clearTimeout(autoAdvanceTimer.current);
    }
    autoAdvanceTimer.current = setTimeout(() => {
      onNextRef.current();
    }, 300);
  };

  return (
    <div className="ff-question">
      <div className="ff-question-number">
        QUESTION {questionNumber} OF {totalQuestions}
      </div>
      <h2 className="ff-question-title">{yesNoField.title}</h2>
      {yesNoField.subtitle && (
        <p className="ff-question-subtitle">{yesNoField.subtitle}</p>
      )}
      <div className="ff-yesno">
        <button
          type="button"
          className={`ff-yesno-card${value === true ? " ff-yesno-card--selected" : ""}`}
          onClick={() => handleSelect(true)}
        >
          <span>{yesNoField.yesLabel || "Yes"}</span>
          <span className="ff-yesno-hint">Y</span>
        </button>
        <button
          type="button"
          className={`ff-yesno-card${value === false ? " ff-yesno-card--selected" : ""}`}
          onClick={() => handleSelect(false)}
        >
          <span>{yesNoField.noLabel || "No"}</span>
          <span className="ff-yesno-hint">N</span>
        </button>
      </div>
      <ErrorMessage message={error} />
    </div>
  );
};
