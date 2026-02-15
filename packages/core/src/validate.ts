import type {
  Field,
  FormSchema,
  SubmitDestination,
} from "./types";

// ─── Field Validation ───

/**
 * Validate a single field's value.
 * Returns an error message string, or null if valid.
 */
export function validateField(field: Field, value: unknown): string | null {
  // Non-input field types always pass
  if (field.type === "welcome" || field.type === "statement" || field.type === "ending") {
    return null;
  }

  // Required check
  if (field.required) {
    if (value === undefined || value === null || value === "") {
      return `${field.title} is required`;
    }
    if (field.type === "multi_choice" && Array.isArray(value) && value.length === 0) {
      return `${field.title} is required`;
    }
  }

  // If value is empty and not required, skip further validation
  if (value === undefined || value === null || value === "") {
    return null;
  }

  switch (field.type) {
    case "text":
    case "textarea": {
      if (typeof value !== "string") {
        return `${field.title} must be a string`;
      }
      if (field.minLength !== undefined && value.length < field.minLength) {
        return `${field.title} must be at least ${field.minLength} characters`;
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        return `${field.title} must be at most ${field.maxLength} characters`;
      }
      if (field.type === "text" && field.pattern) {
        const regex = new RegExp(field.pattern);
        if (!regex.test(value)) {
          return `${field.title} does not match the required format`;
        }
      }
      return null;
    }

    case "email": {
      if (typeof value !== "string") {
        return `${field.title} must be a string`;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return `${field.title} must be a valid email address`;
      }
      return null;
    }

    case "number": {
      const num = typeof value === "string" ? Number(value) : value;
      if (typeof num !== "number" || isNaN(num)) {
        return `${field.title} must be a number`;
      }
      if (field.min !== undefined && num < field.min) {
        return `${field.title} must be at least ${field.min}`;
      }
      if (field.max !== undefined && num > field.max) {
        return `${field.title} must be at most ${field.max}`;
      }
      return null;
    }

    case "url": {
      if (typeof value !== "string") {
        return `${field.title} must be a string`;
      }
      if (!value.startsWith("http://") && !value.startsWith("https://")) {
        return `${field.title} must start with http:// or https://`;
      }
      return null;
    }

    case "phone": {
      if (typeof value !== "string") {
        return `${field.title} must be a string`;
      }
      const digits = value.replace(/[^0-9]/g, "");
      if (digits.length < 7) {
        return `${field.title} must have at least 7 digits`;
      }
      // Allow +, -, spaces, parens, and digits
      const phoneRegex = /^[+\d\s\-()]+$/;
      if (!phoneRegex.test(value)) {
        return `${field.title} contains invalid characters`;
      }
      return null;
    }

    case "choice": {
      if (typeof value !== "string") {
        return `${field.title} must be a string`;
      }
      if (!field.options.includes(value) && !field.allowOther) {
        return `${field.title} must be one of the available options`;
      }
      return null;
    }

    case "multi_choice": {
      if (!Array.isArray(value)) {
        return `${field.title} must be an array of selections`;
      }
      for (const item of value) {
        if (typeof item !== "string" || !field.options.includes(item)) {
          return `${field.title} contains an invalid option: ${String(item)}`;
        }
      }
      const minSel = field.minSelections ?? (field.required ? 1 : 0);
      if (value.length < minSel) {
        return `${field.title} requires at least ${minSel} selection(s)`;
      }
      if (field.maxSelections !== undefined && value.length > field.maxSelections) {
        return `${field.title} allows at most ${field.maxSelections} selection(s)`;
      }
      return null;
    }

    case "rating": {
      const max = field.max ?? 5;
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return `${field.title} must be an integer`;
      }
      if (value < 1 || value > max) {
        return `${field.title} must be between 1 and ${max}`;
      }
      return null;
    }

    case "scale": {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return `${field.title} must be an integer`;
      }
      if (value < field.min || value > field.max) {
        return `${field.title} must be between ${field.min} and ${field.max}`;
      }
      return null;
    }

    case "yes_no": {
      const yesLabel = field.yesLabel ?? "Yes";
      const noLabel = field.noLabel ?? "No";
      // Accept booleans (true = yes, false = no) as well as string labels
      if (value === true || value === yesLabel) return null;
      if (value === false || value === noLabel) return null;
      return `${field.title} must be "${yesLabel}" or "${noLabel}"`;
    }

    case "date": {
      if (typeof value !== "string") {
        return `${field.title} must be a date string`;
      }
      const parsed = new Date(value);
      if (isNaN(parsed.getTime())) {
        return `${field.title} is not a valid date`;
      }
      if (field.minDate) {
        const minD = new Date(field.minDate);
        if (parsed < minD) {
          return `${field.title} must be on or after ${field.minDate}`;
        }
      }
      if (field.maxDate) {
        const maxD = new Date(field.maxDate);
        if (parsed > maxD) {
          return `${field.title} must be on or before ${field.maxDate}`;
        }
      }
      return null;
    }

    case "dropdown": {
      if (typeof value !== "string") {
        return `${field.title} must be a string`;
      }
      if (!field.options.includes(value)) {
        return `${field.title} must be one of the available options`;
      }
      return null;
    }

    default:
      return null;
  }
}

// ─── Schema Validation ───

/**
 * Validate the structure of a FormSchema.
 * Returns an array of error strings (empty if valid).
 */
export function validateSchema(schema: FormSchema): string[] {
  const errors: string[] = [];

  // At least one field
  if (!schema.fields || schema.fields.length === 0) {
    errors.push("Form must have at least one field");
    return errors; // Can't do further checks without fields
  }

  // All field IDs are unique
  const ids = new Set<string>();
  for (const field of schema.fields) {
    if (ids.has(field.id)) {
      errors.push(`Duplicate field ID: "${field.id}"`);
    }
    ids.add(field.id);
  }

  // An ending field exists
  const hasEnding = schema.fields.some((f) => f.type === "ending");
  if (!hasEnding) {
    errors.push("Form must have at least one ending field");
  }

  // Build a set of valid field IDs for branching checks
  const validIds = new Set(schema.fields.map((f) => f.id));

  // Check branching targets
  for (const field of schema.fields) {
    if (field.next === undefined) continue;

    if (typeof field.next === "string") {
      if (!validIds.has(field.next)) {
        errors.push(
          `Field "${field.id}" has next target "${field.next}" which does not exist`
        );
      }
    } else if (typeof field.next === "object") {
      for (const [key, targetId] of Object.entries(field.next)) {
        if (!validIds.has(targetId)) {
          errors.push(
            `Field "${field.id}" has branch "${key}" targeting "${targetId}" which does not exist`
          );
        }
      }
    }
  }

  // Validate submit destinations
  if (schema.submit?.destinations) {
    for (const dest of schema.submit.destinations) {
      validateDestination(dest, errors);
    }
  }

  return errors;
}

function validateDestination(dest: SubmitDestination, errors: string[]): void {
  switch (dest.type) {
    case "sheets":
      if (!dest.url) {
        errors.push("Sheets destination must have a URL");
      }
      break;
    case "webhook":
      if (!dest.url) {
        errors.push("Webhook destination must have a URL");
      }
      break;
    case "service":
      if (!dest.formId) {
        errors.push("Service destination must have a formId");
      }
      break;
    case "excel":
      // Excel needs nothing
      break;
    case "local":
      // No config required
      break;
  }
}
