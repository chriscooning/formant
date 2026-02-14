import React from "react";
import type { Field, RatingField, ScaleField } from "@formant/core";

export interface KeyboardHintProps {
  field: Field | null;
}

export const KeyboardHint: React.FC<KeyboardHintProps> = ({ field }) => {
  if (!field) return null;

  const hints = getHintsForField(field);
  if (hints.length === 0) return null;

  return (
    <div className="ff-keyboard-hint">
      {hints.map((hint, i) => (
        <span key={i} className="ff-keyboard-hint-item">
          {hint}
        </span>
      ))}
    </div>
  );
};

function getHintsForField(field: Field): React.ReactNode[] {
  switch (field.type) {
    case "welcome":
    case "statement":
      return [
        <>
          Press <kbd>Enter ↵</kbd>
        </>,
      ];

    case "text":
    case "email":
    case "number":
    case "phone":
    case "url":
    case "date":
      return [
        <>
          Press <kbd>Enter ↵</kbd>
        </>,
      ];

    case "textarea":
      return [
        <>
          <kbd>Shift + Enter ↵</kbd> to submit
        </>,
      ];

    case "choice":
      return [
        <>
          <kbd>A</kbd>, <kbd>B</kbd>, <kbd>C</kbd> ... to select
        </>,
        <>
          <kbd>Enter ↵</kbd>
        </>,
      ];

    case "multi_choice":
      return [
        <>
          <kbd>A</kbd>, <kbd>B</kbd>, <kbd>C</kbd> ... to toggle
        </>,
        <>
          <kbd>Enter ↵</kbd> to continue
        </>,
      ];

    case "rating": {
      const max = (field as RatingField).max ?? 5;
      return [
        <>
          <kbd>1</kbd>-<kbd>{max}</kbd> to rate
        </>,
      ];
    }

    case "scale": {
      const scaleField = field as ScaleField;
      return [
        <>
          <kbd>{scaleField.min}</kbd>-<kbd>{scaleField.max}</kbd> to select
        </>,
      ];
    }

    case "yes_no":
      return [
        <>
          <kbd>Y</kbd> / <kbd>N</kbd>
        </>,
      ];

    case "dropdown":
      return [
        <>
          <kbd>↑</kbd> <kbd>↓</kbd> to navigate
        </>,
        <>
          <kbd>Enter ↵</kbd>
        </>,
      ];

    case "ending":
      return [];

    default:
      return [];
  }
}
