# Phase 1-Skill — Claude Skill (Initial)

## Goal

Create the initial `skill/SKILL.md` that teaches Claude how to generate valid `FormSchema` JSON and produce HTML form artifacts. This is the user-facing product layer — the primary way people interact with Formant.

## Prerequisites

- Phase 1F complete (HTML builder works — the skill references `buildFormHTML`)
- All core types finalized (the skill teaches Claude the schema format)

## Dependency Graph Position

```
Phase 1F ──► ► Phase 1-Skill ◄ (updated in Phases 2, 3B, 4)
```

This phase creates the **initial** skill. It will be updated in later phases to add Sheets integration (Phase 2), deployment (Phase 3B), and multi-destination config (Phase 4).

---

## Implementation Spec

### `skill/SKILL.md`

This file follows the Claude skill format. It teaches Claude to:

1. **Understand Formant** — what it is, what it produces
2. **Generate valid FormSchema JSON** — the exact types and constraints
3. **Produce HTML artifacts** — using `buildFormHTML` or by generating the schema for the user
4. **Offer sensible defaults** — good UX patterns, question ordering, etc.

#### Structure of the skill file:

```markdown
# Formant — Form Generation Skill

## What is Formant?

Formant generates self-contained HTML forms. Each form is a single `.html` file
that works anywhere — hosted on a website, attached to an email, or opened locally.
Forms follow a Typeform-inspired design: one question at a time, smooth transitions,
keyboard navigation, dark/light mode.

## How to Use

When a user asks you to create a form, survey, quiz, or questionnaire:

1. Ask what questions they want (or infer from context)
2. Ask where responses should go (Excel download is the default)
3. Generate a FormSchema JSON
4. Present the form as an HTML artifact using the schema

## FormSchema Reference

[Include the COMPLETE type definitions from @formant/core/types.ts]
[Formatted as a reference, with descriptions of each field and type]

### Field Types

| Type | Description | Key Properties |
|------|-------------|----------------|
| welcome | Opening screen | buttonText |
| text | Single-line text | placeholder, minLength, maxLength, pattern |
| email | Email input | placeholder |
| number | Numeric input | min, max, step |
| phone | Phone number | placeholder |
| url | URL input | placeholder |
| textarea | Multi-line text | placeholder, minLength, maxLength, rows |
| choice | Single select | options[], allowOther |
| multi_choice | Multi select | options[], minSelections, maxSelections |
| rating | Star rating | max (1-10), labels |
| scale | Numeric scale | min, max, minLabel, maxLabel |
| yes_no | Binary choice | yesLabel, noLabel |
| date | Date picker | minDate, maxDate |
| dropdown | Dropdown select | options[], searchable |
| statement | Info screen | buttonText |
| ending | Completion screen | showSummary, redirectUrl |

### Branching

Fields can have a `next` property for conditional logic:
- String: unconditional jump to field ID
- Record<string, string>: map answer values to field IDs
- Include "default" key as fallback

### Submit Destinations

[Document each destination type with examples]

### Theme Configuration

[Document ThemeConfig with defaults]

## Best Practices

1. Always start with a `welcome` field and end with an `ending` field
2. Keep forms short — 5-10 questions max for good completion rates
3. Use required sparingly — only for truly essential questions
4. Use `choice` for 2-5 options, `dropdown` for 6+ options
5. Use `statement` fields to break up long forms with encouraging messages
6. Set `showSummary: true` on ending for forms with many questions
7. Always include at least `{ type: "excel" }` in destinations as a fallback
8. Use branching to skip irrelevant questions based on previous answers
9. Match question types to data: email for emails, number for numbers, etc.
10. Write conversational, friendly question titles

## Example Schemas

[Include 2-3 complete example schemas:]
1. Simple feedback form (3 questions)
2. Product survey with branching (8 questions)
3. Event registration with multiple types (10 questions)

## Generating the HTML

When presenting the form to the user, generate the FormSchema JSON and
explain that they can:
1. Save the schema as a .json file
2. Use the Formant HTML builder to convert it to a self-contained .html file
3. (Future) Deploy it to get a live URL

For now, present the schema JSON as a code block that the user can use
with the buildFormHTML() function.
```

### `skill/examples/product-feedback.json`

A complete example schema for a product feedback form (5-8 questions with branching based on satisfaction level).

### `skill/examples/product-feedback.html`

The generated HTML output from the above schema (for reference).

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `skill/SKILL.md` | Replace placeholder with full skill |
| `skill/examples/product-feedback.json` | Create example schema |
| `skill/examples/product-feedback.html` | Generate from example (or create manually) |

## Completion Criteria

- SKILL.md contains complete FormSchema reference with all field types
- SKILL.md includes best practices for form design
- SKILL.md includes 2-3 example schemas
- Example schemas are valid (pass `validateSchema`)
- Skill instructions are clear enough that Claude can generate valid schemas from natural language requests

## Open Questions

None — all decisions resolved for this segment.
