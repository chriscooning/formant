import type { Field } from "@formant/core";

export interface QuestionProps<T = unknown> {
  field: Field;
  value: T;
  onChange: (value: T) => void;
  error: string | null;
  questionNumber: number;
  totalQuestions: number;
  onNext: () => void;
}

export interface EndingProps extends QuestionProps<undefined> {
  answers: Record<string, unknown>;
  fields: Field[];
}
