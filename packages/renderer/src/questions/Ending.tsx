import React from "react";
import type { EndingField, Field, RatingField, ScaleField } from "@formant/core";
import type { QuestionProps } from "./types";
import type { SubmitResult } from "../submit/handler";

export interface EndingComponentProps extends QuestionProps<undefined> {
  answers: Record<string, unknown>;
  fields: Field[];
  submitResults?: SubmitResult[] | null;
  submitting?: boolean;
  onDownloadExcel?: () => void;
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

/** Derive the overall submit status from individual results. */
function getSubmitStatus(
  results: SubmitResult[] | null | undefined,
  submitting: boolean
): "pending" | "submitting" | "all_success" | "partial_failure" | "all_failed" {
  if (submitting) return "submitting";
  if (!results || results.length === 0) return "pending";

  const succeeded = results.filter((r) => r.success).length;
  if (succeeded === results.length) return "all_success";
  if (succeeded === 0) return "all_failed";
  return "partial_failure";
}

export const Ending: React.FC<EndingComponentProps> = ({
  field,
  answers,
  fields,
  submitResults,
  submitting = false,
  onDownloadExcel,
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

  const status = getSubmitStatus(submitResults, submitting);

  return (
    <div className="ff-ending">
      {/* Checkmark / error icon */}
      {status === "all_failed" ? (
        <div className="ff-ending-checkmark">
          <div className="ff-ending-circle ff-ending-circle--error">
            <div className="ff-ending-cross" />
          </div>
        </div>
      ) : (
        <div className="ff-ending-checkmark">
          <div className="ff-ending-circle">
            <div className="ff-ending-check" />
          </div>
        </div>
      )}

      <h1 className="ff-ending-title">{endingField.title}</h1>

      {endingField.subtitle && (
        <p className="ff-question-subtitle">{endingField.subtitle}</p>
      )}

      {/* Submit status indicator */}
      {status === "submitting" && (
        <div className="ff-submit-status ff-submit-status--pending" aria-live="polite">
          <span className="ff-submit-spinner" />
          Submitting your responses…
        </div>
      )}

      {status === "all_success" && (
        <div className="ff-submit-status ff-submit-status--success" aria-live="polite" data-testid="submit-success">
          Responses submitted successfully
        </div>
      )}

      {status === "partial_failure" && (
        <div className="ff-submit-status ff-submit-status--warning" aria-live="polite" data-testid="submit-partial">
          Some destinations were unreachable
          {submitResults && (
            <div className="ff-submit-details">
              {submitResults
                .filter((r) => !r.success)
                .map((r, i) => (
                  <div key={i} className="ff-submit-detail-item">
                    {r.destination}: {r.error ?? "failed"}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {status === "all_failed" && (
        <div className="ff-submit-status ff-submit-status--error" aria-live="polite" data-testid="submit-all-failed">
          Submission failed — please download your responses below
          {submitResults && (
            <div className="ff-submit-details">
              {submitResults.map((r, i) => (
                <div key={i} className="ff-submit-detail-item">
                  {r.destination}: {r.error ?? "failed"}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Always show Excel download as fallback option */}
      {onDownloadExcel && (
        <button
          type="button"
          className={
            status === "all_failed"
              ? "ff-btn-primary ff-ending-download"
              : "ff-btn-ghost ff-ending-download"
          }
          onClick={onDownloadExcel}
          data-testid="download-excel"
        >
          Download Responses
        </button>
      )}

      {/* Answer summary */}
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
