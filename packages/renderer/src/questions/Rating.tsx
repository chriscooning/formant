import React, { useEffect, useRef, useState } from "react";
import type { RatingField } from "@formant/core";
import { ErrorMessage } from "../components/ErrorMessage";
import type { QuestionProps } from "./types";

export const Rating: React.FC<QuestionProps<number | undefined>> = ({
  field,
  value,
  onChange,
  error,
  questionNumber,
  totalQuestions,
  onNext,
}) => {
  const ratingField = field as RatingField;
  const max = ratingField.max ?? 5;
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current !== null) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  const handleSelect = (rating: number): void => {
    onChange(rating);

    if (autoAdvanceTimer.current !== null) {
      clearTimeout(autoAdvanceTimer.current);
    }
    autoAdvanceTimer.current = setTimeout(() => {
      onNext();
    }, 400);
  };

  const displayValue = hoverValue ?? value ?? 0;

  const stars = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div className="ff-question">
      <div className="ff-question-number">
        QUESTION {questionNumber} OF {totalQuestions}
      </div>
      <h2 className="ff-question-title">{ratingField.title}</h2>
      {ratingField.subtitle && (
        <p className="ff-question-subtitle">{ratingField.subtitle}</p>
      )}
      <div className="ff-rating">
        <div className="ff-rating-stars">
          {stars.map((starNum) => {
            const isFilled = starNum <= displayValue;
            const isHovered = hoverValue !== null && starNum <= hoverValue;

            return (
              <button
                key={starNum}
                type="button"
                className={`ff-star${isFilled ? " ff-star--filled" : ""}${isHovered ? " ff-star--hover" : ""}`}
                onClick={() => handleSelect(starNum)}
                onMouseEnter={() => setHoverValue(starNum)}
                onMouseLeave={() => setHoverValue(null)}
                aria-label={`${starNum} star${starNum !== 1 ? "s" : ""}`}
              >
                {isFilled ? "★" : "☆"}
              </button>
            );
          })}
        </div>
        {ratingField.labels && (
          <div className="ff-rating-labels">
            {Object.entries(ratingField.labels).map(([key, label]) => (
              <span key={key}>{label}</span>
            ))}
          </div>
        )}
      </div>
      <ErrorMessage message={error} />
    </div>
  );
};
