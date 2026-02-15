/**
 * Formant — Google Sheets Connector (Standalone)
 *
 * Variant for OAuth flow: script is deployed via Apps Script API as a
 * standalone project. Uses SPREADSHEET_ID (injected at deploy time) instead
 * of getActiveSpreadsheet().
 *
 * Deploy as: Web App → Execute as: Me → Access: Anyone
 *
 * @see connect-google-sheet-oauth.md
 */

// Injected by backend at deploy time
var SPREADSHEET_ID = "{{SPREADSHEET_ID}}";

/**
 * Handle incoming POST requests from Formant forms.
 * @param {GoogleAppsScript.Events.DoPost} e - The POST event object.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = spreadsheet.getActiveSheet();

    // Extract metadata keys (prefixed with _) and answer keys
    var metaKeys = [];
    var answerKeys = [];
    var keys = Object.keys(data);

    for (var i = 0; i < keys.length; i++) {
      if (keys[i].charAt(0) === "_") {
        metaKeys.push(keys[i]);
      } else {
        answerKeys.push(keys[i]);
      }
    }

    // Ordered: answers first, then metadata
    var orderedKeys = answerKeys.concat(metaKeys);

    // If the sheet is empty (no headers), create header row
    var lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.appendRow(orderedKeys);
    } else {
      // Use existing headers to determine column order
      var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      orderedKeys = existingHeaders.filter(function (h) { return h !== ""; });

      // Add any new keys not yet in headers
      for (var j = 0; j < keys.length; j++) {
        if (orderedKeys.indexOf(keys[j]) === -1) {
          orderedKeys.push(keys[j]);
          // Extend header row with the new column
          sheet.getRange(1, orderedKeys.length).setValue(keys[j]);
        }
      }
    }

    // Build the row in header order
    var row = [];
    for (var k = 0; k < orderedKeys.length; k++) {
      var value = data[orderedKeys[k]];
      if (value === undefined || value === null) {
        row.push("");
      } else if (Array.isArray(value)) {
        row.push(value.join(", "));
      } else {
        row.push(value);
      }
    }

    sheet.appendRow(row);

    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok", row: sheet.getLastRow() })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests — used for testing that the deployment is active.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON status.
 */
function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "ok", message: "Formant Sheets Connector is active" })
  ).setMimeType(ContentService.MimeType.JSON);
}
