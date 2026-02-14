import React from "react";
import type { WelcomeField } from "@formant/core";
import type { QuestionProps } from "./types";

export const Welcome: React.FC<QuestionProps> = ({ field, onNext }) => {
  const welcomeField = field as WelcomeField;

  return (
    <div className="ff-welcome">
      <h1 className="ff-welcome-title">{welcomeField.title}</h1>
      {welcomeField.subtitle && (
        <p className="ff-welcome-subtitle">{welcomeField.subtitle}</p>
      )}
      <button
        type="button"
        className="ff-welcome-btn"
        onClick={onNext}
      >
        {welcomeField.buttonText || "Start"}
      </button>
    </div>
  );
};
