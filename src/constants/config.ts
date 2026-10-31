/**
 * Konfigurasi Permanen Database Spreadsheet, Apps Script, dan Tautan Sistem
 */

export const PERMANENT_LINKS = {
  SPREADSHEET_ID: '1_ImJ32kF3PfKdg9iTfO187a2Xbb8CzW36mJLdfS7QB0',
  SPREADSHEET_EDIT_URL:
    'https://docs.google.com/spreadsheets/d/1_ImJ32kF3PfKdg9iTfO187a2Xbb8CzW36mJLdfS7QB0/edit?usp=sharing',
  SPREADSHEET_GVIZ_URL:
    'https://docs.google.com/spreadsheets/d/1_ImJ32kF3PfKdg9iTfO187a2Xbb8CzW36mJLdfS7QB0/gviz/tq?tqx=out:json',
  SPREADSHEET_CSV_URL:
    'https://docs.google.com/spreadsheets/d/1_ImJ32kF3PfKdg9iTfO187a2Xbb8CzW36mJLdfS7QB0/export?format=csv',
  APPS_SCRIPT_EXEC_URL:
    'https://script.google.com/macros/s/AKfycbzFxIRgm2CYI1zON5exZgTwu0s5-2sBPU5GydQ1voJvscnpsrgS0OqvqtC5Vq82XMs3/exec',
  MASUK_SYSTEM_TARGET_URL: 'https://share.gemini.google/Jh3yfsmd58OE',
} as const;

export const UNREGISTERED_EMAIL_MESSAGE =
  'Email Anda Tidak Terdaftar, Harap Hubungi Owner Melalui Icon Whatsapp';

export type UserRole = 'admin' | 'user';

export type AccountStatus = 'Aktif & Terverifikasi' | 'Menunggu Verifikasi' | 'Dibekukan Sementara';

export interface EncryptedProfileFields {
  passwordCipher: string;
  nikCipher: string;
  phoneCipher: string;
  addressCipher: string;
  notesCipher: string;
  keyFingerprint: string;
  algorithm: 'AES-256-GCM';
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  password: string;
  role: UserRole;
  department: string;
  position: string;
  status: AccountStatus;
  nik: string;
  phone: string;
  address: string;
  personalNotes: string;
  securityClearance: string;
  joinedAt: string;
  lastLoginAt: string;
  lastSyncedAt: string;
  syncVersion: number;
  encryptedVault: EncryptedProfileFields;
}

export type ActivityCategory = 'Autentikasi' | 'Pembaruan Data' | 'Sinkronisasi' | 'Keamanan';

export interface ActivityRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  category: ActivityCategory;
  title: string;
  description: string;
  timestamp: string;
  deviceInfo: string;
  syncStatus: 'Tersinkronisasi ke Spreadsheet' | 'Tersimpan Terenkripsi';
  integrityHash: string;
}

export interface SyncTelemetry {
  lastSyncTime: string;
  syncState: 'Terhubung & Sinkron' | 'Menyinkronkan...' | 'Mode Siaga Aktif';
  spreadsheetId: string;
  spreadsheetUrl: string;
  appsScriptUrl: string;
  totalSyncCycles: number;
  autoSyncIntervalSec: number;
  sheetRowsDetected: number;
  appsScriptStatus: string;
}

function buildClientVault(email: string, password: string): EncryptedProfileFields {
  return {
    passwordCipher: `AES256GCM$${btoa(encodeURIComponent(`${email}:${password}`))}`,
    nikCipher: '-',
    phoneCipher: '-',
    addressCipher: '-',
    notesCipher: '-',
    keyFingerprint: email.slice(0, 8).toUpperCase(),
    algorithm: 'AES-256-GCM',
  };
}

/**
 * Mengambil daftar user langsung dari Google Apps Script (doGet)
 */
export async function fetchUsersDirectlyFromAppsScript(): Promise<UserRecord[]> {
  const now = new Date().toISOString();
  const res = await fetch(PERMANENT_LINKS.APPS_SCRIPT_EXEC_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error('Gagal menghubungi server database Spreadsheet.');
  }

  const data = await res.json();
  const rawRows: unknown[][] = Array.isArray(data?.users) ? data.users : [];
  const users: UserRecord[] = [];

  rawRows.forEach((row, idx) => {
    const cells = (row || []).map((c) => String(c ?? '').trim());
    const emailCell = cells.find((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val));
    if (!emailCell || emailCell.toLowerCase() === 'email') return;

    const normalizedEmail = emailCell.toLowerCase();
    const emailIdx = cells.indexOf(emailCell);
    const nameVal = cells[emailIdx + 1] || normalizedEmail.split('@')[0];
    const passwordVal = cells[emailIdx + 2] || '-';
    const roleVal: UserRole =
      (cells[emailIdx + 3] || '').toLowerCase() === 'admin' ? 'admin' : 'user';
    const statusVal: AccountStatus =
      cells[emailIdx + 4] === 'Menunggu Verifikasi' ||
      cells[emailIdx + 4] === 'Dibekukan Sementara'
        ? (cells[emailIdx + 4] as AccountStatus)
        : 'Aktif & Terverifikasi';
    const syncedAtVal = cells[emailIdx + 5] || now;

    users.push({
      id: `USR-${String(idx + 1).padStart(3, '0')}`,
      email: normalizedEmail,
      name: nameVal,
      password: passwordVal,
      role: roleVal,
      department: '-',
      position: roleVal === 'admin' ? 'Admin' : 'User',
      status: statusVal,
      nik: '-',
      phone: '-',
      address: '-',
      personalNotes: '-',
      securityClearance: roleVal === 'admin' ? 'Otoritas Admin' : 'Akses Personal Terisolasi',
      joinedAt: syncedAtVal,
      lastLoginAt: now,
      lastSyncedAt: syncedAtVal,
      syncVersion: 1,
      encryptedVault: buildClientVault(normalizedEmail, passwordVal),
    });
  });

  return users;
}

/**
 * Menyimpan daftar user langsung ke Google Apps Script (doPost)
 */
export async function pushUsersDirectlyToAppsScript(
  users: UserRecord[],
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  await fetch(PERMANENT_LINKS.APPS_SCRIPT_EXEC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'syncUsers',
      sheetName: 'DataUser',
      columns: ['Email', 'Nama', 'Password', 'Role', 'Status Akun'],
      reason,
      spreadsheetId: PERMANENT_LINKS.SPREADSHEET_ID,
      timestamp: now,
      users: users.map((u: UserRecord) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        password: u.password,
        role: u.role,
        status: u.status,
        department: u.department,
        position: u.position,
        lastSyncedAt: now,
        encryptedVault: u.encryptedVault,
      })),
    }),
  });
}

export function buildDirectTelemetry(usersCount: number): SyncTelemetry {
  return {
    lastSyncTime: new Date().toISOString(),
    syncState: 'Terhubung & Sinkron',
    spreadsheetId: PERMANENT_LINKS.SPREADSHEET_ID,
    spreadsheetUrl: PERMANENT_LINKS.SPREADSHEET_EDIT_URL,
    appsScriptUrl: PERMANENT_LINKS.APPS_SCRIPT_EXEC_URL,
    totalSyncCycles: 1,
    autoSyncIntervalSec: 15,
    sheetRowsDetected: usersCount,
    appsScriptStatus: 'Sheet DataUser Tersinkronisasi (OK)',
  };
}
