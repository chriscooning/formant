import React from "react";
import type { EndingField, Field, RatingField, ScaleField } from "@formant/core";
import type { QuestionProps } from "./types";

export interface EndingComponentProps extends QuestionProps<undefined> {
  answers: Record<string, unknown>;
  fields: Field[];
}

function formatAnswerValue(field: Field, value: unknown): string {
  if (value == null || value === "") return "—";

  switch (field.type) {
    case "rating": {
      const max = (field as RatingField).max ?? 5;
      const rating = Number(value);
      return "★".repeat(rating) + "☆".repeat(max - rating);
    }
    case "scale":
      return String(value);
    case "multi_choice":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "yes_no":
      return value === true ? "Yes" : "No";
    default:
      return String(value);
  }
}

export const Ending: React.FC<EndingComponentProps> = ({
  field,
  answers,
  fields,
}) => {
  const endingField = field as EndingField;

  // Filter to only answerable fields with answers for summary
  const answerableFields = fields.filter(
    (f) =>
      f.type !== "welcome" &&
      f.type !== "statement" &&
      f.type !== "ending" &&
      answers[f.id] !== undefined
  );

  return (
    <div className="ff-ending">
      <div className="ff-ending-checkmark">
        <div className="ff-ending-circle">
          <div className="ff-ending-check" />
        </div>
      </div>
      <h1 className="ff-ending-title">{endingField.title}</h1>
      {endingField.subtitle && (
        <p className="ff-question-subtitle">{endingField.subtitle}</p>
      )}
      {endingField.showSummary && answerableFields.length > 0 && (
        <div className="ff-ending-summary">
          {answerableFields.map((f) => (
            <div key={f.id} className="ff-ending-summary-item">
              <div className="ff-question-number">{f.title}</div>
              <div>{formatAnswerValue(f, answers[f.id])}</div>
            </div>
          ))}
        </div>
      )}
      {endingField.redirectUrl && (
        <a
          href={endingField.redirectUrl}
          className="ff-ending-redirect"
          target="_blank"
          rel="noopener noreferrer"
        >
          {endingField.redirectLabel || "Continue"}
        </a>
      )}
    </div>
  );
};
