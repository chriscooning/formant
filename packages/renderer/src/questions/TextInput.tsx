import React, { useEffect, useRef } from "react";
import type {
  TextField,
  EmailField,
  PhoneField,
  UrlField,
} from "@formant/core";
import { ErrorMessage } from "../components/ErrorMessage";
import type { QuestionProps } from "./types";

type TextFieldUnion = TextField | EmailField | PhoneField | UrlField;

const inputTypeMap: Record<string, string> = {
  text: "text",
  email: "email",
  phone: "tel",
  url: "url",
};

export const TextInput: React.FC<QuestionProps<string>> = ({
  field,
  value,
  onChange,
  error,
  questionNumber,
  totalQuestions,
  onNext,
}) => {
  const textField = field as TextFieldUnion;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onChange(e.target.value);
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
      <h2 className="ff-question-title">{textField.title}</h2>
      {textField.subtitle && (
        <p className="ff-question-subtitle">{textField.subtitle}</p>
      )}
      <input
        ref={inputRef}
        type={inputTypeMap[textField.type] ?? "text"}
        className="ff-input ff-input-underline"
        value={value ?? ""}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={textField.placeholder}
      />
      <ErrorMessage message={error} />
    </div>
  );
};
