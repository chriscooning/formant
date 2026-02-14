import React, { useEffect, useRef, useState } from "react";
import type { DropdownField } from "@formant/core";
import { ErrorMessage } from "../components/ErrorMessage";
import type { QuestionProps } from "./types";

export const Dropdown: React.FC<QuestionProps<string>> = ({
  field,
  value,
  onChange,
  error,
  questionNumber,
  totalQuestions,
  onNext,
}) => {
  const dropdownField = field as DropdownField;
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredOptions = dropdownField.searchable
    ? dropdownField.options.filter((opt) =>
        opt.toLowerCase().includes(searchText.toLowerCase())
      )
    : dropdownField.options;

  useEffect(() => {
    if (isOpen && dropdownField.searchable) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, dropdownField.searchable]);

  // Reset highlight when filtered options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchText]);

  const handleSelect = (option: string): void => {
    onChange(option);
    setIsOpen(false);
    setSearchText("");
    onNext();
  };

  const handleToggle = (): void => {
    setIsOpen((prev) => !prev);
    if (isOpen) {
      setSearchText("");
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) {
        handleSelect(option);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSearchText("");
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) {
        handleSelect(option);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="ff-question">
      <div className="ff-question-number">
        QUESTION {questionNumber} OF {totalQuestions}
      </div>
      <h2 className="ff-question-title">{dropdownField.title}</h2>
      {dropdownField.subtitle && (
        <p className="ff-question-subtitle">{dropdownField.subtitle}</p>
      )}
      <div className="ff-dropdown">
        {dropdownField.searchable ? (
          <>
            <input
              ref={searchInputRef}
              type="text"
              className="ff-dropdown-search"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder={value || "Type to search..."}
            />
            {isOpen && filteredOptions.length > 0 && (
              <div className="ff-dropdown-list" ref={listRef}>
                {filteredOptions.map((option, idx) => (
                  <button
                    key={option}
                    type="button"
                    className={`ff-dropdown-option${idx === highlightedIndex ? " ff-dropdown-option--highlighted" : ""}`}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className="ff-dropdown-trigger"
              onClick={handleToggle}
            >
              {value || "Select an option..."}
            </button>
            {isOpen && (
              <div
                className="ff-dropdown-list"
                ref={listRef}
                onKeyDown={handleListKeyDown}
                tabIndex={0}
              >
                {filteredOptions.map((option, idx) => (
                  <button
                    key={option}
                    type="button"
                    className={`ff-dropdown-option${idx === highlightedIndex ? " ff-dropdown-option--highlighted" : ""}`}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <ErrorMessage message={error} />
    </div>
  );
};
