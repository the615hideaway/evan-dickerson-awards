/**
 * Evan Dickerson Awards — Form Responses API
 *
 * SETUP (one-time):
 * 1. Open your Google Form → Responses → Link to Sheets (create spreadsheet)
 * 2. In that spreadsheet: Extensions → Apps Script
 * 3. Paste this file, save
 * 4. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the deployment URL into admin-config.js → dataUrl
 */

var API_SECRET = 'evan@awards';
var SPREADSHEET_ID = '1gbUzlOErRQF-LC1qqtmHXp0gqPtod7_KmbkfP24rN0M';

function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    if (params.key !== API_SECRET) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Form Responses 1');
    if (!sheet) {
      return jsonResponse({ error: 'Sheet "Form Responses 1" not found' }, 404);
    }

    var values = sheet.getDataRange().getDisplayValues();
    if (!values.length) {
      return jsonResponse({ updatedAt: new Date().toISOString(), totalBallots: 0, headers: [], rows: [] });
    }

    var headers = values[0];
    var rows = values.slice(1).filter(function (row) {
      return row.some(function (cell) { return String(cell).trim() !== ''; });
    });

    return jsonResponse({
      updatedAt: new Date().toISOString(),
      totalBallots: rows.length,
      headers: headers,
      rows: rows
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

function jsonResponse(payload, status) {
  var output = ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);

  // Apps Script web apps don't support custom HTTP status codes,
  // but the payload includes error info when needed.
  if (status && status >= 400) {
    return ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return output;
}