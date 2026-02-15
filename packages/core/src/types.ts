// ─── Field Types ───

export type FieldType =
  | "welcome"
  | "text"
  | "textarea"
  | "email"
  | "number"
  | "phone"
  | "url"
  | "choice"
  | "multi_choice"
  | "rating"
  | "scale"
  | "yes_no"
  | "date"
  | "dropdown"
  | "statement"
  | "ending";

// ─── Base Field ───

export interface BaseField {
  id: string;
  type: FieldType;
  title: string;
  subtitle?: string;
  required?: boolean;
  next?: Record<string, string> | string;
}

// ─── Type-Specific Fields ───

export interface WelcomeField extends BaseField {
  type: "welcome";
  buttonText?: string;
}

export interface TextField extends BaseField {
  type: "text";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface EmailField extends BaseField {
  type: "email";
  placeholder?: string;
}

export interface NumberField extends BaseField {
  type: "number";
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface PhoneField extends BaseField {
  type: "phone";
  placeholder?: string;
}

export interface UrlField extends BaseField {
  type: "url";
  placeholder?: string;
}

export interface TextAreaField extends BaseField {
  type: "textarea";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  rows?: number;
}

export interface ChoiceField extends BaseField {
  type: "choice";
  options: string[];
  allowOther?: boolean;
}

export interface MultiChoiceField extends BaseField {
  type: "multi_choice";
  options: string[];
  minSelections?: number;
  maxSelections?: number;
}

export interface RatingField extends BaseField {
  type: "rating";
  max?: number;
  labels?: Record<number, string>;
}

export interface ScaleField extends BaseField {
  type: "scale";
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface YesNoField extends BaseField {
  type: "yes_no";
  yesLabel?: string;
  noLabel?: string;
}

export interface DateField extends BaseField {
  type: "date";
  minDate?: string;
  maxDate?: string;
}

export interface DropdownField extends BaseField {
  type: "dropdown";
  options: string[];
  searchable?: boolean;
}

export interface StatementField extends BaseField {
  type: "statement";
  buttonText?: string;
}

export interface EndingField extends BaseField {
  type: "ending";
  showSummary?: boolean;
  redirectUrl?: string;
  redirectLabel?: string;
}

// ─── Discriminated Union ───

export type Field =
  | WelcomeField
  | TextField
  | EmailField
  | NumberField
  | PhoneField
  | UrlField
  | TextAreaField
  | ChoiceField
  | MultiChoiceField
  | RatingField
  | ScaleField
  | YesNoField
  | DateField
  | DropdownField
  | StatementField
  | EndingField;

// ─── Submit Destinations ───

export interface SheetsDestination {
  type: "sheets";
  url: string;
}

export interface WebhookDestination {
  type: "webhook";
  url: string;
  headers?: Record<string, string>;
}

export interface ServiceDestination {
  type: "service";
  formId: string;
  endpoint?: string;
}

export interface ExcelDestination {
  type: "excel";
  filename?: string;
}

export interface LocalDestination {
  type: "local";
}

export type SubmitDestination =
  | SheetsDestination
  | WebhookDestination
  | ServiceDestination
  | ExcelDestination
  | LocalDestination;

// ─── Theme ───

export interface ThemeConfig {
  accent?: string;
  accentHover?: string;
  radius?: string;
  defaultMode?: "light" | "dark" | "auto";
}

// ─── Form Schema ───

export interface FormSchema {
  id: string;
  title?: string;
  fields: Field[];
  submit?: {
    destinations: SubmitDestination[];
    successMessage?: string;
    /** When false, hide the "Download Responses" button on the ending screen. Default: true. */
    allowSubmitterDownload?: boolean;
  };
  theme?: ThemeConfig;
  meta?: {
    createdAt?: string;
    createdBy?: string;
    version?: number;
  };
}

// ─── Form Response ───

export type ResponseStatus = "in_progress" | "completed";

export interface FormResponse {
  formId: string;
  responseId?: string;
  status: ResponseStatus;
  submittedAt: string;
  answers: Record<string, unknown>;
  metadata?: {
    userAgent?: string;
    duration?: number;
    completionRate?: number;
    lastFieldId?: string;
  };
}
