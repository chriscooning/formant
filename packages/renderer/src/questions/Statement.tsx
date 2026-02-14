import React from "react";
import type { StatementField } from "@formant/core";
import type { QuestionProps } from "./types";

export const Statement: React.FC<QuestionProps> = ({ field, onNext }) => {
  const statementField = field as StatementField;

  return (
    <div className="ff-statement">
      <h1 className="ff-statement-title">{statementField.title}</h1>
      {statementField.subtitle && (
        <p className="ff-statement-subtitle">{statementField.subtitle}</p>
      )}
      <button
        type="button"
        className="ff-statement-btn"
        onClick={onNext}
      >
        {statementField.buttonText || "Continue"} →
      </button>
    </div>
  );
};
