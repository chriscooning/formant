# Phase 2 — Google Sheets Connector

## Goal

Enable form responses to automatically appear as rows in a Google Sheet. Zero server infrastructure — uses Google Apps Script as the bridge.

## Prerequisites

- Phase 1E complete (submit handlers exist, specifically `sheets.ts`)
- Forms can be generated and submitted (Phase 1F)

## Dependency Graph Position

```
Phase 1E-2 ──► ► Phase 2 ◄ (can run in parallel with Phase 1F/1G)
```

---

## Implementation Spec

### 1. Google Apps Script (`scripts/apps-script/sheets-connector.gs`)

A ~40 line Google Apps Script that users deploy as a web app on their Google Sheet.

```javascript
/**
 * Formant — Google Sheets Connector
 * 
 * Deploy this as a web app on your Google Sheet to receive form responses.
 * See SETUP.md for step-by-step instructions.
 */

function doPost(e) {
  try {
    // 1. Parse the incoming JSON
    var data = JSON.parse(e.postData.contents);
    
    // 2. Get the active sheet
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 3. On first submission (row 1 is empty), create header row
    if (sheet.getLastRow() === 0) {
      var headers = Object.keys(data.answers || data);
      // Add metadata columns
      headers.push("Submitted At", "Duration (s)", "Status");
      sheet.appendRow(headers);
      // Bold the header row
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }
    
    // 4. Get headers from row 1 to maintain column order
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // 5. Map response to columns
    var answers = data.answers || data;
    var row = headers.map(function(header) {
      if (header === "Submitted At") return data.submittedAt || new Date().toISOString();
      if (header === "Duration (s)") return data.metadata?.duration || "";
      if (header === "Status") return data.status || "completed";
      
      var value = answers[header];
      // Handle arrays (multi_choice)
      if (Array.isArray(value)) return value.join(", ");
      // Handle null/undefined
      if (value === null || value === undefined) return "";
      return value;
    });
    
    // 6. Append the row
    sheet.appendRow(row);
    
    // 7. Return success
    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", row: sheet.getLastRow() }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle GET requests (for testing the deployment)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "Formant Sheets Connector is active" }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 2. Setup Guide (`scripts/apps-script/SETUP.md`)

Step-by-step instructions with clear descriptions:

```markdown
# Google Sheets Integration — Setup Guide

## Overview
Connect your Formant form to a Google Sheet so responses automatically appear as rows.

## Steps

### 1. Create a Google Sheet
- Go to [sheets.google.com](https://sheets.google.com)
- Create a new spreadsheet
- Give it a name (e.g., "Form Responses")
- The first sheet will be used for responses

### 2. Open Apps Script
- In your Google Sheet, go to **Extensions → Apps Script**
- This opens the Apps Script editor in a new tab

### 3. Add the Connector Script
- Delete any default code in the editor
- Copy the entire contents of `sheets-connector.gs` and paste it in
- Save the project (Ctrl+S / Cmd+S)
- Name the project "Formant Connector" (or whatever you prefer)

### 4. Deploy as Web App
- Click **Deploy → New deployment**
- Click the gear icon next to "Select type" and choose **Web app**
- Set the following:
  - **Description**: "Formant form responses"
  - **Execute as**: "Me" (your Google account)
  - **Who has access**: "Anyone"
- Click **Deploy**
- **Important**: You'll be asked to authorize. Click through the permissions.

### 5. Copy the Deployment URL
- After deployment, you'll see a **Web app URL**
- Copy this URL — it looks like: `https://script.google.com/macros/s/ABC.../exec`
- This is what you'll give to Formant

### 6. Use in Your Form
When generating a form, add this to the submit config:
\`\`\`json
{
  "submit": {
    "destinations": [
      { "type": "sheets", "url": "YOUR_DEPLOYMENT_URL_HERE" },
      { "type": "excel" }
    ]
  }
}
\`\`\`

### Troubleshooting
- **"Authorization required"**: Re-deploy and authorize again
- **Responses not appearing**: Check the Apps Script execution log (View → Executions)
- **Wrong columns**: Delete row 1 (headers) — they'll be recreated on next submission
- **To update the script**: Deploy → Manage deployments → Edit → Update version
```

### 3. Harden Sheets Submit Handler (`packages/renderer/src/submit/sheets.ts`)

The handler was scaffolded in Phase 1E-1. Now make it robust:

```typescript
export async function submitToSheets(
  url: string,
  response: FormResponse,
  fieldTitleMap: Record<string, string>  // Map field IDs to human-readable titles
): Promise<void> {
  // Flatten answers: convert field IDs to titles for readable spreadsheet headers
  const flatAnswers: Record<string, unknown> = {};
  for (const [fieldId, value] of Object.entries(response.answers)) {
    const title = fieldTitleMap[fieldId] || fieldId;
    flatAnswers[title] = value;
  }

  const payload = {
    answers: flatAnswers,
    submittedAt: response.submittedAt,
    status: response.status,
    metadata: response.metadata,
  };

  // Use text/plain content type — Apps Script quirk for CORS from null origin
  // When Content-Type is text/plain, the browser treats it as a "simple request"
  // and doesn't send a preflight OPTIONS request
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
      mode: "cors",
    });
    
    if (!res.ok) {
      throw new Error(`Sheets responded with ${res.status}`);
    }
  } catch (corsError) {
    // Fallback: try no-cors mode (fire-and-forget, no response readable)
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
      mode: "no-cors",
    });
    // Can't verify success in no-cors mode, but the request is sent
  }
}
```

**Edge cases to handle:**
- Very long text answers: Google Sheets cell limit is 50,000 chars — truncate if longer
- Special characters in answers: JSON.stringify handles this
- Multi-choice answers (arrays): joined with ", " by the Apps Script
- Rating/scale (numbers): pass as-is, Apps Script writes them as numbers
- Date answers: pass as ISO string

### 4. Update Skill for Sheets Integration

Add to `skill/SKILL.md`:

```markdown
## Google Sheets Integration

When generating a form, ask the user:
"Want responses sent to a Google Sheet?"

If yes:
1. Ask if they have a Google Apps Script deployment URL
2. If not, link to the setup guide or explain the steps
3. Add sheets destination to the schema's submit config
4. Always include "excel" destination as fallback

The generated HTML works regardless of whether the Sheets URL is valid —
failed Sheets POSTs are silent and the Excel download still works.

Example config with Sheets:
\`\`\`json
{
  "submit": {
    "destinations": [
      { "type": "sheets", "url": "https://script.google.com/macros/s/.../exec" },
      { "type": "excel", "filename": "responses-backup" }
    ]
  }
}
\`\`\`
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `scripts/apps-script/sheets-connector.gs` | Replace placeholder with full script |
| `scripts/apps-script/SETUP.md` | **NEW** — create setup guide |
| `packages/renderer/src/submit/sheets.ts` | Harden with edge case handling |
| `skill/SKILL.md` | Add Sheets integration section |

## Completion Criteria

- Apps Script handles POST requests, creates headers on first submit, appends rows
- Apps Script handles arrays, numbers, dates, special characters
- SETUP.md has clear step-by-step instructions
- Sheets submit handler handles CORS from null origin (text/plain content type)
- Sheets submit handler falls back to no-cors mode
- Skill instructions teach Claude to offer Sheets integration
- Manual test: deploy the script on a real Google Sheet, submit a form, verify row appears

## Open Questions

None — all decisions resolved for this segment.
