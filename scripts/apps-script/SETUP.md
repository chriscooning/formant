# Google Sheets Connector — Setup Guide

Connect your Formant forms to a Google Sheet so that every submission automatically appears as a new row.

## Prerequisites

- A Google account
- A Google Sheet where you want responses collected

## Step-by-Step Setup

### 1. Open your Google Sheet

Go to [Google Sheets](https://sheets.google.com) and open the spreadsheet where you want form responses to appear (or create a new one).

### 2. Open the Apps Script editor

From the top menu, go to **Extensions → Apps Script**. This opens the Apps Script editor in a new tab.

### 3. Paste the connector script

1. In the Apps Script editor, delete any code in the default `Code.gs` file
2. Copy the entire contents of [`sheets-connector.gs`](./sheets-connector.gs) and paste it in
3. Save the file (**Ctrl+S** / **Cmd+S**)

### 4. Deploy as a Web App

1. Click **Deploy → New deployment** (top-right area)
2. Click the **gear icon** next to "Select type" and choose **Web app**
3. Fill in the deployment settings:
   - **Description**: `Formant connector` (or anything you like)
   - **Execute as**: **Me** (your Google account)
   - **Who has access**: **Anyone**
4. Click **Deploy**
5. Google will ask you to authorize the script — click **Authorize access**, choose your account, and allow the permissions
6. **Copy the Web app URL** that appears — it looks like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

> **Important:** Keep this URL private. Anyone with it can write data to your sheet.

### 5. Use the URL in your form

When generating a form with Claude (or manually editing a schema), include the URL in the submit configuration:

```json
{
  "submit": {
    "destinations": [
      {
        "type": "sheets",
        "url": "https://script.google.com/macros/s/AKfycbx.../exec"
      }
    ]
  }
}
```

Or combine with other destinations:

```json
{
  "submit": {
    "destinations": [
      {
        "type": "sheets",
        "url": "https://script.google.com/macros/s/AKfycbx.../exec"
      },
      {
        "type": "excel"
      }
    ]
  }
}
```

### 6. Test the connection

1. Open a form that's configured with your Sheets URL
2. Fill it out and submit
3. Check your Google Sheet — a new row should appear with the response data
4. The first submission also creates the header row automatically

## How It Works

- Each form submission sends a POST request to your Apps Script URL
- The script parses the JSON response body
- On the first submission, it creates a header row from the field names
- Each subsequent submission appends a new row aligned to those headers
- New fields (not in the original headers) are added as new columns automatically
- Array values (from multi-choice fields) are joined with `, `

## Updating the Script

If you need to update the script after deploying:

1. Open **Extensions → Apps Script** from your Sheet
2. Make your changes
3. Click **Deploy → Manage deployments**
4. Click the **pencil icon** on your deployment
5. Change **Version** to **New version**
6. Click **Deploy**

The URL stays the same — no need to update your forms.

## Troubleshooting

**"The script completed but did not return anything"**
- Make sure you deployed as a **Web app** (not a Library or other type)
- Make sure **Who has access** is set to **Anyone**

**Rows not appearing**
- Check that the Apps Script URL is correct (ends with `/exec`, not `/dev`)
- Open the Apps Script editor and check **Executions** (left sidebar) for error logs
- Try the URL in a browser — you should see `{"status":"ok","message":"Formant Sheets Connector is active"}`

**Permission denied**
- Re-deploy and make sure **Execute as: Me** and **Access: Anyone** are selected
- If Google shows a "This app isn't verified" warning during authorization, click **Advanced → Go to [project name] (unsafe)** — this is normal for personal scripts

**Data in wrong columns**
- The script uses the first submission to create headers. If you re-order or rename fields, delete the header row and submit again, or manually adjust the headers.

## Column Order

The script writes data in this order:
1. **Answer fields** — in the order they appear in the submitted data
2. **Metadata fields** — prefixed with `_` (e.g., `_submittedAt`, `_formId`, `_duration`, `_completionRate`)
