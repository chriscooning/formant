import { describe, it, expect } from "vitest";
import { validateField, validateSchema } from "../src/validate";
import type {
  TextField,
  TextAreaField,
  EmailField,
  NumberField,
  UrlField,
  PhoneField,
  ChoiceField,
  MultiChoiceField,
  RatingField,
  ScaleField,
  YesNoField,
  DateField,
  DropdownField,
  WelcomeField,
  StatementField,
  EndingField,
  FormSchema,
} from "../src/types";

// ─── validateField ───

describe("validateField", () => {
  // ── Required check ──

  describe("required fields", () => {
    const field: TextField = {
      id: "name",
      type: "text",
      title: "Name",
      required: true,
    };

    it("returns error when required field has undefined value", () => {
      expect(validateField(field, undefined)).not.toBeNull();
    });

    it("returns error when required field has null value", () => {
      expect(validateField(field, null)).not.toBeNull();
    });

    it("returns error when required field has empty string", () => {
      expect(validateField(field, "")).not.toBeNull();
    });

    it("returns null when required field has a value", () => {
      expect(validateField(field, "Alice")).toBeNull();
    });
  });

  describe("optional fields", () => {
    const field: TextField = {
      id: "nickname",
      type: "text",
      title: "Nickname",
      required: false,
    };

    it("returns null for undefined value on optional field", () => {
      expect(validateField(field, undefined)).toBeNull();
    });

    it("returns null for null value on optional field", () => {
      expect(validateField(field, null)).toBeNull();
    });

    it("returns null for empty string on optional field", () => {
      expect(validateField(field, "")).toBeNull();
    });
  });

  // ── Text ──

  describe("text", () => {
    const field: TextField = {
      id: "bio",
      type: "text",
      title: "Bio",
      minLength: 3,
      maxLength: 10,
    };

    it("passes when within length bounds", () => {
      expect(validateField(field, "hello")).toBeNull();
    });

    it("fails when below minLength", () => {
      expect(validateField(field, "hi")).not.toBeNull();
    });

    it("fails when above maxLength", () => {
      expect(validateField(field, "this is way too long")).not.toBeNull();
    });

    it("passes at exact minLength boundary", () => {
      expect(validateField(field, "abc")).toBeNull();
    });

    it("passes at exact maxLength boundary", () => {
      expect(validateField(field, "abcdefghij")).toBeNull();
    });

    it("fails for non-string value", () => {
      expect(validateField(field, 123)).not.toBeNull();
    });

    describe("pattern", () => {
      const patternField: TextField = {
        id: "zip",
        type: "text",
        title: "Zip Code",
        pattern: "^\\d{5}$",
      };

      it("passes when pattern matches", () => {
        expect(validateField(patternField, "12345")).toBeNull();
      });

      it("fails when pattern does not match", () => {
        expect(validateField(patternField, "abcde")).not.toBeNull();
      });

      it("fails when pattern partially matches", () => {
        expect(validateField(patternField, "1234")).not.toBeNull();
      });
    });
  });

  // ── Textarea ──

  describe("textarea", () => {
    const field: TextAreaField = {
      id: "comments",
      type: "textarea",
      title: "Comments",
      minLength: 5,
      maxLength: 100,
    };

    it("passes when within length bounds", () => {
      expect(validateField(field, "A valid comment")).toBeNull();
    });

    it("fails when below minLength", () => {
      expect(validateField(field, "Hi")).not.toBeNull();
    });

    it("fails when above maxLength", () => {
      const longStr = "x".repeat(101);
      expect(validateField(field, longStr)).not.toBeNull();
    });
  });

  // ── Email ──

  describe("email", () => {
    const field: EmailField = {
      id: "email",
      type: "email",
      title: "Email",
    };

    it("passes for valid email", () => {
      expect(validateField(field, "user@example.com")).toBeNull();
    });

    it("passes for email with subdomain", () => {
      expect(validateField(field, "user@mail.example.com")).toBeNull();
    });

    it("fails for email without @", () => {
      expect(validateField(field, "userexample.com")).not.toBeNull();
    });

    it("fails for email with spaces", () => {
      expect(validateField(field, "user @example.com")).not.toBeNull();
    });

    it("fails for email without domain", () => {
      expect(validateField(field, "user@")).not.toBeNull();
    });

    it("fails for non-string value", () => {
      expect(validateField(field, 42)).not.toBeNull();
    });
  });

  // ── Number ──

  describe("number", () => {
    const field: NumberField = {
      id: "age",
      type: "number",
      title: "Age",
      min: 0,
      max: 150,
    };

    it("passes for number within range", () => {
      expect(validateField(field, 25)).toBeNull();
    });

    it("passes at min boundary", () => {
      expect(validateField(field, 0)).toBeNull();
    });

    it("passes at max boundary", () => {
      expect(validateField(field, 150)).toBeNull();
    });

    it("fails below min", () => {
      expect(validateField(field, -1)).not.toBeNull();
    });

    it("fails above max", () => {
      expect(validateField(field, 151)).not.toBeNull();
    });

    it("fails for NaN", () => {
      expect(validateField(field, NaN)).not.toBeNull();
    });

    it("fails for non-numeric string", () => {
      expect(validateField(field, "abc")).not.toBeNull();
    });

    it("passes for numeric string", () => {
      expect(validateField(field, "42")).toBeNull();
    });
  });

  // ── URL ──

  describe("url", () => {
    const field: UrlField = {
      id: "website",
      type: "url",
      title: "Website",
    };

    it("passes for https URL", () => {
      expect(validateField(field, "https://example.com")).toBeNull();
    });

    it("passes for http URL", () => {
      expect(validateField(field, "http://example.com")).toBeNull();
    });

    it("fails without protocol", () => {
      expect(validateField(field, "example.com")).not.toBeNull();
    });

    it("fails for ftp URL", () => {
      expect(validateField(field, "ftp://example.com")).not.toBeNull();
    });

    it("fails for non-string", () => {
      expect(validateField(field, 123)).not.toBeNull();
    });
  });

  // ── Phone ──

  describe("phone", () => {
    const field: PhoneField = {
      id: "phone",
      type: "phone",
      title: "Phone",
    };

    it("passes for standard phone number", () => {
      expect(validateField(field, "555-123-4567")).toBeNull();
    });

    it("passes for international format with +", () => {
      expect(validateField(field, "+1 555 123 4567")).toBeNull();
    });

    it("passes for format with parens", () => {
      expect(validateField(field, "(555) 123-4567")).toBeNull();
    });

    it("fails for too few digits", () => {
      expect(validateField(field, "12345")).not.toBeNull();
    });

    it("fails for letters in phone", () => {
      expect(validateField(field, "555-ABC-1234")).not.toBeNull();
    });

    it("fails for non-string", () => {
      expect(validateField(field, 5551234567)).not.toBeNull();
    });
  });

  // ── Choice ──

  describe("choice", () => {
    const field: ChoiceField = {
      id: "color",
      type: "choice",
      title: "Favorite Color",
      options: ["Red", "Blue", "Green"],
    };

    it("passes when value is in options", () => {
      expect(validateField(field, "Red")).toBeNull();
    });

    it("fails when value is not in options", () => {
      expect(validateField(field, "Purple")).not.toBeNull();
    });

    it("fails for non-string value", () => {
      expect(validateField(field, 1)).not.toBeNull();
    });

    describe("allowOther", () => {
      const otherField: ChoiceField = {
        ...field,
        allowOther: true,
      };

      it("passes for custom value when allowOther is true", () => {
        expect(validateField(otherField, "Purple")).toBeNull();
      });

      it("still passes for listed option with allowOther", () => {
        expect(validateField(otherField, "Red")).toBeNull();
      });
    });
  });

  // ── Multi-choice ──

  describe("multi_choice", () => {
    const field: MultiChoiceField = {
      id: "toppings",
      type: "multi_choice",
      title: "Toppings",
      options: ["Cheese", "Pepperoni", "Mushrooms", "Olives"],
      minSelections: 1,
      maxSelections: 3,
    };

    it("passes for valid selections", () => {
      expect(validateField(field, ["Cheese", "Pepperoni"])).toBeNull();
    });

    it("fails for too few selections", () => {
      expect(validateField(field, [])).not.toBeNull();
    });

    it("fails for too many selections", () => {
      expect(
        validateField(field, ["Cheese", "Pepperoni", "Mushrooms", "Olives"])
      ).not.toBeNull();
    });

    it("fails for invalid option in array", () => {
      expect(validateField(field, ["Cheese", "Bacon"])).not.toBeNull();
    });

    it("fails for non-array value", () => {
      expect(validateField(field, "Cheese")).not.toBeNull();
    });

    it("passes at exact minSelections boundary", () => {
      expect(validateField(field, ["Cheese"])).toBeNull();
    });

    it("passes at exact maxSelections boundary", () => {
      expect(
        validateField(field, ["Cheese", "Pepperoni", "Mushrooms"])
      ).toBeNull();
    });

    describe("required multi_choice", () => {
      const requiredField: MultiChoiceField = {
        id: "req-mc",
        type: "multi_choice",
        title: "Required Multi",
        options: ["A", "B"],
        required: true,
      };

      it("fails for empty array when required", () => {
        expect(validateField(requiredField, [])).not.toBeNull();
      });

      it("uses minSelections=1 when required and minSelections not set", () => {
        expect(validateField(requiredField, [])).not.toBeNull();
        expect(validateField(requiredField, ["A"])).toBeNull();
      });
    });
  });

  // ── Rating ──

  describe("rating", () => {
    const field: RatingField = {
      id: "stars",
      type: "rating",
      title: "Rating",
      max: 5,
    };

    it("passes for value within range", () => {
      expect(validateField(field, 3)).toBeNull();
    });

    it("passes at min boundary (1)", () => {
      expect(validateField(field, 1)).toBeNull();
    });

    it("passes at max boundary", () => {
      expect(validateField(field, 5)).toBeNull();
    });

    it("fails for 0", () => {
      expect(validateField(field, 0)).not.toBeNull();
    });

    it("fails for above max", () => {
      expect(validateField(field, 6)).not.toBeNull();
    });

    it("fails for non-integer", () => {
      expect(validateField(field, 3.5)).not.toBeNull();
    });

    it("fails for non-number", () => {
      expect(validateField(field, "3")).not.toBeNull();
    });

    it("uses default max of 5 when not specified", () => {
      const defaultField: RatingField = {
        id: "r",
        type: "rating",
        title: "R",
      };
      expect(validateField(defaultField, 5)).toBeNull();
      expect(validateField(defaultField, 6)).not.toBeNull();
    });
  });

  // ── Scale ──

  describe("scale", () => {
    const field: ScaleField = {
      id: "nps",
      type: "scale",
      title: "NPS",
      min: 0,
      max: 10,
    };

    it("passes for value within range", () => {
      expect(validateField(field, 5)).toBeNull();
    });

    it("passes at min boundary", () => {
      expect(validateField(field, 0)).toBeNull();
    });

    it("passes at max boundary", () => {
      expect(validateField(field, 10)).toBeNull();
    });

    it("fails below min", () => {
      expect(validateField(field, -1)).not.toBeNull();
    });

    it("fails above max", () => {
      expect(validateField(field, 11)).not.toBeNull();
    });

    it("fails for non-integer", () => {
      expect(validateField(field, 5.5)).not.toBeNull();
    });
  });

  // ── Yes/No ──

  describe("yes_no", () => {
    const field: YesNoField = {
      id: "agree",
      type: "yes_no",
      title: "Do you agree?",
    };

    it('passes for "Yes"', () => {
      expect(validateField(field, "Yes")).toBeNull();
    });

    it('passes for "No"', () => {
      expect(validateField(field, "No")).toBeNull();
    });

    it("fails for other strings", () => {
      expect(validateField(field, "Maybe")).not.toBeNull();
    });

    it("fails for boolean", () => {
      expect(validateField(field, true)).not.toBeNull();
    });

    describe("custom labels", () => {
      const customField: YesNoField = {
        id: "confirm",
        type: "yes_no",
        title: "Confirm?",
        yesLabel: "Agree",
        noLabel: "Disagree",
      };

      it("passes with custom yes label", () => {
        expect(validateField(customField, "Agree")).toBeNull();
      });

      it("passes with custom no label", () => {
        expect(validateField(customField, "Disagree")).toBeNull();
      });

      it('fails with default "Yes" when custom labels set', () => {
        expect(validateField(customField, "Yes")).not.toBeNull();
      });
    });
  });

  // ── Date ──

  describe("date", () => {
    const field: DateField = {
      id: "dob",
      type: "date",
      title: "Date of Birth",
    };

    it("passes for valid ISO date", () => {
      expect(validateField(field, "2024-01-15")).toBeNull();
    });

    it("passes for full ISO datetime", () => {
      expect(validateField(field, "2024-01-15T10:30:00Z")).toBeNull();
    });

    it("fails for invalid date string", () => {
      expect(validateField(field, "not-a-date")).not.toBeNull();
    });

    it("fails for non-string", () => {
      expect(validateField(field, 20240115)).not.toBeNull();
    });

    describe("date range", () => {
      const rangeField: DateField = {
        id: "event",
        type: "date",
        title: "Event Date",
        minDate: "2024-01-01",
        maxDate: "2024-12-31",
      };

      it("passes for date within range", () => {
        expect(validateField(rangeField, "2024-06-15")).toBeNull();
      });

      it("fails for date before minDate", () => {
        expect(validateField(rangeField, "2023-12-31")).not.toBeNull();
      });

      it("fails for date after maxDate", () => {
        expect(validateField(rangeField, "2025-01-01")).not.toBeNull();
      });
    });
  });

  // ── Dropdown ──

  describe("dropdown", () => {
    const field: DropdownField = {
      id: "country",
      type: "dropdown",
      title: "Country",
      options: ["USA", "Canada", "Mexico"],
    };

    it("passes when value is in options", () => {
      expect(validateField(field, "USA")).toBeNull();
    });

    it("fails when value is not in options", () => {
      expect(validateField(field, "Brazil")).not.toBeNull();
    });

    it("fails for non-string", () => {
      expect(validateField(field, 1)).not.toBeNull();
    });
  });

  // ── Non-input fields ──

  describe("welcome / statement / ending", () => {
    const welcome: WelcomeField = {
      id: "w",
      type: "welcome",
      title: "Welcome",
    };
    const statement: StatementField = {
      id: "s",
      type: "statement",
      title: "Info",
    };
    const ending: EndingField = {
      id: "e",
      type: "ending",
      title: "Thanks",
    };

    it("welcome always passes", () => {
      expect(validateField(welcome, undefined)).toBeNull();
      expect(validateField(welcome, null)).toBeNull();
      expect(validateField(welcome, "anything")).toBeNull();
    });

    it("statement always passes", () => {
      expect(validateField(statement, undefined)).toBeNull();
    });

    it("ending always passes", () => {
      expect(validateField(ending, undefined)).toBeNull();
    });
  });

  // ── Edge cases ──

  describe("edge cases", () => {
    const textField: TextField = {
      id: "t",
      type: "text",
      title: "T",
    };

    it("handles undefined value on optional text field", () => {
      expect(validateField(textField, undefined)).toBeNull();
    });

    it("handles null value on optional text field", () => {
      expect(validateField(textField, null)).toBeNull();
    });

    it("handles wrong type (number where string expected)", () => {
      const requiredText: TextField = { ...textField, required: true };
      // Number 42 satisfies required (not undefined/null/empty), then fails string check
      expect(validateField(requiredText, 42)).not.toBeNull();
    });
  });
});

// ─── validateSchema ───

describe("validateSchema", () => {
  const validSchema: FormSchema = {
    id: "test-form",
    fields: [
      { id: "q1", type: "text", title: "Question 1" },
      { id: "end", type: "ending", title: "Thank you" },
    ],
  };

  it("returns empty array for valid minimal schema", () => {
    expect(validateSchema(validSchema)).toEqual([]);
  });

  it("returns error when no fields", () => {
    const schema: FormSchema = { id: "empty", fields: [] };
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("at least one field"))).toBe(true);
  });

  it("returns error for duplicate field IDs", () => {
    const schema: FormSchema = {
      id: "dup",
      fields: [
        { id: "q1", type: "text", title: "Q1" },
        { id: "q1", type: "text", title: "Q1 again" },
        { id: "end", type: "ending", title: "End" },
      ],
    };
    const errors = validateSchema(schema);
    expect(errors.some((e) => e.includes("Duplicate field ID"))).toBe(true);
  });

  it("returns error when no ending field", () => {
    const schema: FormSchema = {
      id: "no-end",
      fields: [{ id: "q1", type: "text", title: "Q1" }],
    };
    const errors = validateSchema(schema);
    expect(errors.some((e) => e.includes("ending field"))).toBe(true);
  });

  it("returns error when branch target references nonexistent field", () => {
    const schema: FormSchema = {
      id: "bad-branch",
      fields: [
        {
          id: "q1",
          type: "choice",
          title: "Q1",
          options: ["A"],
          next: { A: "nonexistent" },
        },
        { id: "end", type: "ending", title: "End" },
      ],
    };
    const errors = validateSchema(schema);
    expect(errors.some((e) => e.includes("nonexistent"))).toBe(true);
  });

  it("returns error when string next references nonexistent field", () => {
    const schema: FormSchema = {
      id: "bad-next",
      fields: [
        { id: "q1", type: "text", title: "Q1", next: "missing-field" },
        { id: "end", type: "ending", title: "End" },
      ],
    };
    const errors = validateSchema(schema);
    expect(errors.some((e) => e.includes("missing-field"))).toBe(true);
  });

  it("returns no errors for valid branching targets", () => {
    const schema: FormSchema = {
      id: "good-branch",
      fields: [
        {
          id: "q1",
          type: "choice",
          title: "Q1",
          options: ["A", "B"],
          next: { A: "q2", B: "end" },
        },
        { id: "q2", type: "text", title: "Q2" },
        { id: "end", type: "ending", title: "End" },
      ],
    };
    expect(validateSchema(schema)).toEqual([]);
  });

  it("returns error for sheets destination missing URL", () => {
    const schema: FormSchema = {
      id: "bad-sheets",
      fields: [
        { id: "q1", type: "text", title: "Q1" },
        { id: "end", type: "ending", title: "End" },
      ],
      submit: {
        destinations: [{ type: "sheets", url: "" }],
      },
    };
    const errors = validateSchema(schema);
    expect(errors.some((e) => e.includes("Sheets"))).toBe(true);
  });

  it("returns error for webhook destination missing URL", () => {
    const schema: FormSchema = {
      id: "bad-webhook",
      fields: [
        { id: "q1", type: "text", title: "Q1" },
        { id: "end", type: "ending", title: "End" },
      ],
      submit: {
        destinations: [{ type: "webhook", url: "" }],
      },
    };
    const errors = validateSchema(schema);
    expect(errors.some((e) => e.includes("Webhook"))).toBe(true);
  });

  it("returns error for service destination missing formId", () => {
    const schema: FormSchema = {
      id: "bad-service",
      fields: [
        { id: "q1", type: "text", title: "Q1" },
        { id: "end", type: "ending", title: "End" },
      ],
      submit: {
        destinations: [{ type: "service", formId: "" }],
      },
    };
    const errors = validateSchema(schema);
    expect(errors.some((e) => e.includes("Service"))).toBe(true);
  });

  it("returns no errors for valid multi-destination schema", () => {
    const schema: FormSchema = {
      id: "multi-dest",
      fields: [
        { id: "q1", type: "text", title: "Q1" },
        { id: "end", type: "ending", title: "End" },
      ],
      submit: {
        destinations: [
          { type: "sheets", url: "https://script.google.com/exec" },
          { type: "webhook", url: "https://hooks.example.com/form" },
          { type: "excel" },
        ],
      },
    };
    expect(validateSchema(schema)).toEqual([]);
  });
});
