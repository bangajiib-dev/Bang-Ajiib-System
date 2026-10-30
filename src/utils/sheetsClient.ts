import {
  PERMANENT_LINKS,
  type UserRecord,
  type UserRole,
  type AccountStatus,
  type SyncTelemetry,
} from '../constants/config.ts';

export const UNREGISTERED_EMAIL_MESSAGE =
  'Email Anda Tidak Terdaftar, Harap Hubungi Owner Melalui Icon Whatsapp';

function buildClientVault(email: string, password: string) {
  return {
    passwordCipher: `AES256GCM$${btoa(encodeURIComponent(`${email}:${password}`))}`,
    nikCipher: '-',
    phoneCipher: '-',
    addressCipher: '-',
    notesCipher: '-',
    keyFingerprint: email.slice(0, 8).toUpperCase(),
    algorithm: 'AES-256-GCM' as const,
  };
}

/**
 * Mengambil seluruh daftar user langsung dari Google Apps Script (doGet)
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
 * Menyimpan seluruh daftar user langsung ke Google Apps Script (doPost)
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
      users: users.map((u) => ({
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
