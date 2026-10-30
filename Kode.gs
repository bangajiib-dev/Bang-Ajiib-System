/**
 * ============================================================================
 * FILE: Kode.gs (Google Apps Script)
 * Spreadsheet: https://docs.google.com/spreadsheets/d/1_ImJ32kF3PfKdg9iTfO187a2Xbb8CzW36mJLdfS7QB0/edit?usp=sharing
 * Web App URL: https://script.google.com/macros/s/AKfycbzFxIRgm2CYI1zON5exZgTwu0s5-2sBPU5GydQ1voJvscnpsrgS0OqvqtC5Vq82XMs3/exec
 * ============================================================================
 */

const SPREADSHEET_ID = '1_ImJ32kF3PfKdg9iTfO187a2Xbb8CzW36mJLdfS7QB0';
const USER_SHEET_NAME = 'DataUser';

/**
 * Memastikan sheet "DataUser" tersedia dengan header kolom: Email, Nama, Password, Role, Status Akun, Terakhir Sinkron.
 * Aman dijalankan langsung melalui tombol "Jalankan" (Run) di editor Apps Script.
 */
function ensureUserSheet(ss) {
  const spreadsheet = ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(USER_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(USER_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    const headers = ['Email', 'Nama', 'Password', 'Role', 'Status Akun', 'Terakhir Sinkron'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const userSheet = ensureUserSheet(ss);
    const usersData = userSheet.getDataRange().getValues();

    return ContentService.createTextOutput(
      JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        sheetName: USER_SHEET_NAME,
        users: usersData,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: 'error',
        message: err.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const dataUserSheet = ensureUserSheet(ss);

    // Jika dijalankan manual dari tombol "Jalankan" di editor tanpa payload POST
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: 'ok',
          message: 'Sheet DataUser siap digunakan.',
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const payload = JSON.parse(e.postData.contents || '{}');

    if (payload.users && Array.isArray(payload.users)) {
      const headers = ['Email', 'Nama', 'Password', 'Role', 'Status Akun', 'Terakhir Sinkron'];

      const rows = payload.users.map(function (u) {
        return [
          u.email || '',
          u.name || '',
          u.password || '',
          u.role || 'user',
          u.status || 'Aktif & Terverifikasi',
          u.lastSyncedAt || new Date().toISOString(),
        ];
      });

      // 1. Simpan ke Sheet "DataUser"
      dataUserSheet.clearContents();
      dataUserSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      if (rows.length > 0) {
        dataUserSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }

      // 2. Sinkronkan juga ke Sheet pertama (Sheet1)
      const firstSheet = ss.getSheets()[0];
      if (firstSheet && firstSheet.getName() !== USER_SHEET_NAME) {
        firstSheet.clearContents();
        firstSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        if (rows.length > 0) {
          firstSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
        }
      }
    }

    return ContentService.createTextOutput(
      JSON.stringify({
        status: 'synced',
        sheet: USER_SHEET_NAME,
        syncedAt: new Date().toISOString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        status: 'error',
        message: err.toString(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
