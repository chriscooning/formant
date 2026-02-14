import React, { useEffect, useRef } from "react";
import type { ScaleField } from "@formant/core";
import { ErrorMessage } from "../components/ErrorMessage";
import type { QuestionProps } from "./types";

export const Scale: React.FC<QuestionProps<number | undefined>> = ({
  field,
  value,
  onChange,
  error,
  questionNumber,
  totalQuestions,
  onNext,
}) => {
  const scaleField = field as ScaleField;
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current !== null) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  const handleSelect = (num: number): void => {
    onChange(num);

    if (autoAdvanceTimer.current !== null) {
      clearTimeout(autoAdvanceTimer.current);
    }
    autoAdvanceTimer.current = setTimeout(() => {
      onNext();
    }, 400);
  };

  const buttons: number[] = [];
  for (let i = scaleField.min; i <= scaleField.max; i++) {
    buttons.push(i);
  }

  return (
    <div className="ff-question">
      <div className="ff-question-number">
        QUESTION {questionNumber} OF {totalQuestions}
      </div>
      <h2 className="ff-question-title">{scaleField.title}</h2>
      {scaleField.subtitle && (
        <p className="ff-question-subtitle">{scaleField.subtitle}</p>
      )}
      <div className="ff-scale">
        <div className="ff-scale-buttons">
          {buttons.map((num) => (
            <button
              key={num}
              type="button"
              className={`ff-scale-btn${value === num ? " ff-scale-btn--selected" : ""}`}
              onClick={() => handleSelect(num)}
            >
              {num}
            </button>
          ))}
        </div>
        {(scaleField.minLabel || scaleField.maxLabel) && (
          <div className="ff-scale-labels">
            <span>{scaleField.minLabel ?? ""}</span>
            <span>{scaleField.maxLabel ?? ""}</span>
          </div>
        )}
      </div>
      <ErrorMessage message={error} />
    </div>
  );
};
