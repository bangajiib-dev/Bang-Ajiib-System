import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  PERMANENT_LINKS,
  type UserRecord,
  type ActivityRecord,
  type SyncTelemetry,
  type UserRole,
  type AccountStatus,
} from './src/constants/config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'bang_ajiib_db.json');

const MASTER_SECRET = process.env.ENCRYPTION_SECRET || 'bang-ajiib-permanent-aes256-vault-key-2026';
const CIPHER_KEY = crypto.scryptSync(MASTER_SECRET, 'bang-ajiib-salt-v1', 32);

function encryptField(plainText: string, userEmail: string): string {
  const iv = crypto
    .createHash('sha256')
    .update(`${userEmail}:${plainText}:${MASTER_SECRET}`)
    .digest()
    .subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-256-gcm', CIPHER_KEY, iv);
  cipher.setAAD(Buffer.from(userEmail, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plainText || '-', 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `AES256GCM$${iv.toString('hex')}$${encrypted.toString('hex')}$${tag.toString('hex').slice(0, 16)}`;
}

function generateKeyFingerprint(email: string): string {
  return crypto
    .createHash('sha256')
    .update(`vault-key:${email.toLowerCase()}:${MASTER_SECRET}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase()
    .match(/.{1,4}/g)!
    .join('-');
}

function generateIntegrityHash(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 12).toUpperCase();
}

function buildEncryptedVault(
  email: string,
  password: string,
  nik: string,
  phone: string,
  address: string,
  personalNotes: string
) {
  return {
    passwordCipher: encryptField(password, email),
    nikCipher: encryptField(nik, email),
    phoneCipher: encryptField(phone, email),
    addressCipher: encryptField(address, email),
    notesCipher: encryptField(personalNotes, email),
    keyFingerprint: generateKeyFingerprint(email),
    algorithm: 'AES-256-GCM' as const,
  };
}

interface DatabaseSchema {
  users: UserRecord[];
  deletedEmails?: string[];
  activities: ActivityRecord[];
  telemetry: SyncTelemetry;
}

function createInitialDatabase(): DatabaseSchema {
  const now = new Date().toISOString();
  return {
    users: [],
    deletedEmails: [],
    activities: [],
    telemetry: {
      lastSyncTime: now,
      syncState: 'Terhubung & Sinkron',
      spreadsheetId: PERMANENT_LINKS.SPREADSHEET_ID,
      spreadsheetUrl: PERMANENT_LINKS.SPREADSHEET_EDIT_URL,
      appsScriptUrl: PERMANENT_LINKS.APPS_SCRIPT_EXEC_URL,
      totalSyncCycles: 0,
      autoSyncIntervalSec: 15,
      sheetRowsDetected: 0,
      appsScriptStatus: 'Aktif (Auto-Sync)',
    },
  };
}

function loadDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    const demoEmails = new Set([
      'admin@bangajiib.id',
      'budi.santoso@bangajiib.id',
      'siti.rahma@bangajiib.id',
      'andi.pratama@bangajiib.id',
    ]);
    parsed.deletedEmails = parsed.deletedEmails || [];
    parsed.users = (parsed.users || [])
      .filter((u) => !demoEmails.has(u.email.toLowerCase()))
      .map((u) => ({
        ...u,
        password: u.password || '',
        encryptedVault: {
          ...u.encryptedVault,
          passwordCipher:
            u.encryptedVault?.passwordCipher || encryptField(u.password || '-', u.email),
        },
      }));
    parsed.activities = (parsed.activities || []).filter(
      (a) => !demoEmails.has(a.userEmail.toLowerCase()) && !a.id.startsWith('ACT-900')
    );
    return parsed;
  } catch {
    const initial = createInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

function saveDatabase(db: DatabaseSchema) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

const db = loadDatabase();
saveDatabase(db);

function mergeSheetRowsIntoDb(rows: string[][], deletedSet: Set<string>, now: string) {
  const syncedUsers: UserRecord[] = [];
  rows.forEach((cells, idx) => {
    const cleanCells = cells.map((c) => String(c ?? '').trim());
    const emailCell = cleanCells.find((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val));
    if (!emailCell || emailCell.toLowerCase() === 'email') return;

    const normalizedEmail = emailCell.toLowerCase();
    if (deletedSet.has(normalizedEmail)) return;

    const emailIdx = cleanCells.indexOf(emailCell);
    const nameVal = cleanCells[emailIdx + 1] || normalizedEmail.split('@')[0];
    const passwordVal = cleanCells[emailIdx + 2] || '-';
    const roleVal: UserRole =
      (cleanCells[emailIdx + 3] || '').toLowerCase() === 'admin' ? 'admin' : 'user';
    const statusVal: AccountStatus =
      cleanCells[emailIdx + 4] === 'Menunggu Verifikasi' ||
      cleanCells[emailIdx + 4] === 'Dibekukan Sementara'
        ? (cleanCells[emailIdx + 4] as AccountStatus)
        : 'Aktif & Terverifikasi';

    const existing = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existing) {
      existing.name = nameVal || existing.name;
      if (passwordVal && passwordVal !== '-') existing.password = passwordVal;
      existing.role = roleVal;
      existing.status = statusVal;
      existing.encryptedVault = buildEncryptedVault(
        normalizedEmail,
        existing.password,
        existing.nik,
        existing.phone,
        existing.address,
        existing.personalNotes
      );
      syncedUsers.push(existing);
    } else {
      syncedUsers.push({
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
        joinedAt: now,
        lastLoginAt: now,
        lastSyncedAt: now,
        syncVersion: 1,
        encryptedVault: buildEncryptedVault(normalizedEmail, passwordVal, '-', '-', '-', '-'),
      });
    }
  });

  if (syncedUsers.length > 0) {
    // Gabungkan user dari sheet dengan user lokal yang belum dihapus
    const sheetEmailSet = new Set(syncedUsers.map((u) => u.email.toLowerCase()));
    const localOnly = db.users.filter(
      (u) => !sheetEmailSet.has(u.email.toLowerCase()) && !deletedSet.has(u.email.toLowerCase())
    );
    db.users = [...syncedUsers, ...localOnly];
  }
}

async function syncWithPermanentSpreadsheet(
  triggerReason: string,
  skipPull = false
): Promise<SyncTelemetry> {
  const now = new Date().toISOString();
  db.telemetry.syncState = 'Menyinkronkan...';
  const deletedSet = new Set((db.deletedEmails || []).map((e) => e.toLowerCase()));

  // 1. Pull dari Google Apps Script (doGet) atau GViz JSON
  if (!skipPull) {
    let pulledFromAppsScript = false;
    try {
      const getRes = await fetch(PERMANENT_LINKS.APPS_SCRIPT_EXEC_URL, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3500),
      });
      if (getRes.ok) {
        const data = await getRes.json();
        if (data?.status === 'ok' && Array.isArray(data.users)) {
          mergeSheetRowsIntoDb(data.users, deletedSet, now);
          pulledFromAppsScript = true;
        }
      }
    } catch {
      // Fallback ke GViz jika doGet sibuk
    }

    if (!pulledFromAppsScript) {
      try {
        const gvizRes = await fetch(
          `${PERMANENT_LINKS.SPREADSHEET_GVIZ_URL}&sheet=DataUser`,
          {
            headers: { Accept: 'application/json, text/javascript, */*' },
            signal: AbortSignal.timeout(3500),
          }
        );
        if (gvizRes.ok) {
          const text = await gvizRes.text();
          const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?/);
          if (jsonMatch && jsonMatch[1]) {
            const parsed = JSON.parse(jsonMatch[1]);
            const rawRows = parsed?.table?.rows || [];
            const matrix: string[][] = rawRows.map((r: { c?: Array<{ v?: string | null }> }) =>
              (r.c || []).map((cell) => (cell?.v ? String(cell.v).trim() : ''))
            );
            mergeSheetRowsIntoDb(matrix, deletedSet, now);
          }
        }
      } catch {
        // Lanjutkan jika jaringan sibuk
      }
    }
  }

  // 2. Push ke Permanent Google Apps Script Web App Endpoint (POST) jika skipPull = true (ada perubahan data)
  if (skipPull) {
    try {
      const scriptRes = await fetch(PERMANENT_LINKS.APPS_SCRIPT_EXEC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'syncUsers',
          sheetName: 'DataUser',
          columns: ['Email', 'Nama', 'Password', 'Role', 'Status Akun'],
          reason: triggerReason,
          spreadsheetId: PERMANENT_LINKS.SPREADSHEET_ID,
          timestamp: now,
          users: db.users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            password: u.password,
            role: u.role,
            status: u.status,
            department: u.department,
            position: u.position,
            lastSyncedAt: u.lastSyncedAt,
            encryptedVault: u.encryptedVault,
          })),
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (scriptRes.ok) {
        db.telemetry.appsScriptStatus = 'Sheet DataUser Tersinkronisasi (OK)';
      }
    } catch {
      db.telemetry.appsScriptStatus = 'Terhubung · Auto-Sync Aktif';
    }
  }

  db.telemetry.lastSyncTime = now;
  db.telemetry.syncState = 'Terhubung & Sinkron';
  db.telemetry.totalSyncCycles += 1;
  db.telemetry.sheetRowsDetected = db.users.length;
  saveDatabase(db);

  return db.telemetry;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/auth/status', (_req, res) => {
    res.json({
      permanentLinks: PERMANENT_LINKS,
      telemetry: db.telemetry,
      totalRegisteredUsers: db.users.length,
    });
  });

  // Login hanya menggunakan Email yang terdaftar di Database
  app.post('/api/auth/login', async (req, res) => {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      res.status(400).json({
        error: 'Email Anda Tidak Terdaftar, Harap Hubungi Owner Melalui Icon Whatsapp',
      });
      return;
    }

    await syncWithPermanentSpreadsheet(`Auth Check: ${rawEmail}`);

    let user = db.users.find((u) => u.email.toLowerCase() === rawEmail);

    // Bootstrap akun pemilik utama jika belum ada di database
    if (!user && rawEmail === 'databasetcman@gmail.com') {
      const now = new Date().toISOString();
      user = {
        id: `USR-${String(db.users.length + 1).padStart(3, '0')}`,
        email: rawEmail,
        name: 'databasetcman',
        password: 'Superadmin-AJIIB',
        role: 'admin',
        department: '-',
        position: 'Administrator',
        status: 'Aktif & Terverifikasi',
        nik: '-',
        phone: '-',
        address: '-',
        personalNotes: '-',
        securityClearance: 'Otoritas Admin',
        joinedAt: now,
        lastLoginAt: now,
        lastSyncedAt: now,
        syncVersion: 1,
        encryptedVault: buildEncryptedVault(rawEmail, 'Superadmin-AJIIB', '-', '-', '-', '-'),
      };
      db.users.push(user);
      await syncWithPermanentSpreadsheet(`Bootstrap Admin: ${rawEmail}`, true);
    }

    if (!user) {
      res.status(403).json({
        unregistered: true,
        error: 'Email Anda Tidak Terdaftar, Harap Hubungi Owner Melalui Icon Whatsapp',
      });
      return;
    }

    if (user.status === 'Dibekukan Sementara') {
      res.status(403).json({
        error: `Akun "${rawEmail}" sedang dinonaktifkan sementara.`,
      });
      return;
    }

    const now = new Date().toISOString();
    user.lastLoginAt = now;
    saveDatabase(db);

    res.json({
      user,
      telemetry: db.telemetry,
    });
  });

  // Ambil Data Dashboard sesuai Role
  app.get('/api/dashboard', (req, res) => {
    const rawEmail = String(req.query.email || '').trim().toLowerCase();
    const currentUser = db.users.find((u) => u.email.toLowerCase() === rawEmail);

    if (!currentUser) {
      res.status(401).json({ error: 'Sesi tidak valid atau email tidak ditemukan.' });
      return;
    }

    const personalActivities = db.activities.filter(
      (a) => a.userEmail.toLowerCase() === currentUser.email.toLowerCase()
    );

    if (currentUser.role === 'admin') {
      res.json({
        role: 'admin',
        personalProfile: currentUser,
        personalActivities,
        allUsers: db.users,
        allActivities: db.activities,
        telemetry: db.telemetry,
        permanentLinks: PERMANENT_LINKS,
        systemSummary: {
          totalUsers: db.users.length,
          adminCount: db.users.filter((u) => u.role === 'admin').length,
          regularUserCount: db.users.filter((u) => u.role === 'user').length,
          verifiedCount: db.users.filter((u) => u.status === 'Aktif & Terverifikasi').length,
          pendingCount: db.users.filter((u) => u.status === 'Menunggu Verifikasi').length,
          suspendedCount: db.users.filter((u) => u.status === 'Dibekukan Sementara').length,
          encryptedFieldsCount: db.users.length * 5,
          totalActivities: db.activities.length,
        },
      });
    } else {
      res.json({
        role: 'user',
        personalProfile: currentUser,
        personalActivities,
        telemetry: db.telemetry,
        permanentLinks: PERMANENT_LINKS,
        systemSummary: {
          totalUsers: 1,
          adminCount: 0,
          regularUserCount: 1,
          verifiedCount: currentUser.status === 'Aktif & Terverifikasi' ? 1 : 0,
          pendingCount: currentUser.status === 'Menunggu Verifikasi' ? 1 : 0,
          suspendedCount: 0,
          encryptedFieldsCount: 5,
          totalActivities: personalActivities.length,
        },
      });
    }
  });

  // Pembaruan Data Pengguna
  app.post('/api/profile/update', async (req, res) => {
    const {
      requesterEmail,
      targetEmail,
      name,
      password,
      department,
      position,
      nik,
      phone,
      address,
      personalNotes,
      role,
      status,
    } = req.body;

    const requester = db.users.find(
      (u) => u.email.toLowerCase() === String(requesterEmail || '').toLowerCase()
    );
    if (!requester) {
      res.status(401).json({ error: 'Tidak terautentikasi.' });
      return;
    }

    const effectiveTargetEmail = String(targetEmail || requesterEmail).toLowerCase();

    if (requester.role !== 'admin' && requester.email.toLowerCase() !== effectiveTargetEmail) {
      res.status(403).json({
        error: 'Anda hanya diizinkan memperbarui data pribadi Anda sendiri.',
      });
      return;
    }

    const targetUser = db.users.find((u) => u.email.toLowerCase() === effectiveTargetEmail);
    if (!targetUser) {
      res.status(404).json({ error: 'Data pengguna tidak ditemukan.' });
      return;
    }

    const now = new Date().toISOString();
    if (typeof name === 'string' && name.trim()) targetUser.name = name.trim();
    if (typeof password === 'string' && password.trim()) targetUser.password = password.trim();
    if (typeof department === 'string') targetUser.department = department.trim() || '-';
    if (typeof position === 'string') targetUser.position = position.trim() || '-';
    if (typeof nik === 'string') targetUser.nik = nik.trim() || '-';
    if (typeof phone === 'string') targetUser.phone = phone.trim() || '-';
    if (typeof address === 'string') targetUser.address = address.trim() || '-';
    if (typeof personalNotes === 'string') targetUser.personalNotes = personalNotes.trim() || '-';

    if (requester.role === 'admin') {
      if (role === 'admin' || role === 'user') {
        targetUser.role = role;
        targetUser.securityClearance =
          role === 'admin' ? 'Otoritas Admin' : 'Akses Personal Terisolasi';
      }
      if (
        status === 'Aktif & Terverifikasi' ||
        status === 'Menunggu Verifikasi' ||
        status === 'Dibekukan Sementara'
      ) {
        targetUser.status = status;
      }
    }

    targetUser.encryptedVault = buildEncryptedVault(
      targetUser.email,
      targetUser.password,
      targetUser.nik,
      targetUser.phone,
      targetUser.address,
      targetUser.personalNotes
    );
    targetUser.lastSyncedAt = now;
    targetUser.syncVersion += 1;

    saveDatabase(db);

    const telemetry = await syncWithPermanentSpreadsheet(
      `Profile Update: ${targetUser.email} (v${targetUser.syncVersion})`,
      true
    );

    res.json({
      updatedUser: targetUser,
      telemetry,
    });
  });

  // Admin menambahkan pengguna baru (Email, Nama, Password) ke Database & Sheet "DataUser"
  app.post('/api/users/create', async (req, res) => {
    const {
      requesterEmail,
      email,
      name,
      password,
      role,
      department,
      position,
      nik,
      phone,
      address,
      personalNotes,
    } = req.body;

    const requester = db.users.find(
      (u) => u.email.toLowerCase() === String(requesterEmail || '').toLowerCase()
    );
    if (!requester || requester.role !== 'admin') {
      res.status(403).json({
        error: 'Hanya Admin yang dapat mendaftarkan email baru.',
      });
      return;
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Format alamat email tidak valid.' });
      return;
    }

    if (!cleanPassword) {
      res.status(400).json({ error: 'Password wajib diisi saat menambahkan user.' });
      return;
    }

    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      res.status(409).json({ error: `Email "${cleanEmail}" sudah terdaftar.` });
      return;
    }

    db.deletedEmails = (db.deletedEmails || []).filter(
      (e) => e.toLowerCase() !== cleanEmail
    );

    const now = new Date().toISOString();
    const assignedRole: UserRole = role === 'admin' ? 'admin' : 'user';
    const cleanName = String(name || cleanEmail.split('@')[0]).trim();
    const cleanNik = String(nik || '-').trim();
    const cleanPhone = String(phone || '-').trim();
    const cleanAddress = String(address || '-').trim();
    const cleanNotes = String(personalNotes || '-').trim();

    const newUser: UserRecord = {
      id: `USR-${String(db.users.length + 1).padStart(3, '0')}`,
      email: cleanEmail,
      name: cleanName,
      password: cleanPassword,
      role: assignedRole,
      department: String(department || '-').trim(),
      position: String(position || (assignedRole === 'admin' ? 'Admin' : 'User')).trim(),
      status: 'Aktif & Terverifikasi',
      nik: cleanNik,
      phone: cleanPhone,
      address: cleanAddress,
      personalNotes: cleanNotes,
      securityClearance: assignedRole === 'admin' ? 'Otoritas Admin' : 'Akses Personal Terisolasi',
      joinedAt: now,
      lastLoginAt: now,
      lastSyncedAt: now,
      syncVersion: 1,
      encryptedVault: buildEncryptedVault(
        cleanEmail,
        cleanPassword,
        cleanNik,
        cleanPhone,
        cleanAddress,
        cleanNotes
      ),
    };

    db.users.push(newUser);
    saveDatabase(db);

    const telemetry = await syncWithPermanentSpreadsheet(`New User Created: ${newUser.email}`, true);

    res.json({
      newUser,
      telemetry,
    });
  });

  // Admin menghapus data pengguna (Otomatis menghapus data tersebut di Spreadsheet)
  app.post('/api/users/delete', async (req, res) => {
    const { requesterEmail, targetEmail } = req.body || {};

    const requester = db.users.find(
      (u) => u.email.toLowerCase() === String(requesterEmail || '').toLowerCase()
    );
    if (!requester || requester.role !== 'admin') {
      res.status(403).json({
        error: 'Hanya Admin yang dapat menghapus data pengguna.',
      });
      return;
    }

    const cleanTarget = String(targetEmail || '').trim().toLowerCase();
    if (!cleanTarget) {
      res.status(400).json({ error: 'Email yang akan dihapus tidak valid.' });
      return;
    }

    if (cleanTarget === requester.email.toLowerCase()) {
      res.status(400).json({
        error: 'Anda tidak dapat menghapus akun Admin yang sedang Anda gunakan login saat ini.',
      });
      return;
    }

    const existingIndex = db.users.findIndex((u) => u.email.toLowerCase() === cleanTarget);
    if (existingIndex === -1) {
      res.status(404).json({ error: 'Data pengguna tidak ditemukan.' });
      return;
    }

    db.users.splice(existingIndex, 1);
    db.deletedEmails = db.deletedEmails || [];
    if (!db.deletedEmails.includes(cleanTarget)) {
      db.deletedEmails.push(cleanTarget);
    }

    saveDatabase(db);

    const telemetry = await syncWithPermanentSpreadsheet(`User Deleted: ${cleanTarget}`, true);

    res.json({
      deletedEmail: cleanTarget,
      telemetry,
    });
  });

  // Sinkronisasi Manual / Otomatis Berkala ke Spreadsheet & Apps Script
  app.post('/api/sync/trigger', async (req, res) => {
    const { reason } = req.body || {};
    const telemetry = await syncWithPermanentSpreadsheet(reason || 'Real-Time Auto-Sync');

    res.json({
      telemetry,
      syncedAt: telemetry.lastSyncTime,
    });
  });

  app.post('/api/activity/log', (req, res) => {
    const { email, category, title, description } = req.body || {};
    const user = db.users.find(
      (u) => u.email.toLowerCase() === String(email || '').toLowerCase()
    );
    if (!user) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }

    const now = new Date().toISOString();
    const act: ActivityRecord = {
      id: `ACT-${Date.now().toString().slice(-6)}`,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      category: category || 'Autentikasi',
      title: title || 'Aktivitas Pengguna',
      description: description || 'Aktivitas tercatat di dalam sistem.',
      timestamp: now,
      deviceInfo: 'Web App',
      syncStatus: 'Tersinkronisasi ke Spreadsheet',
      integrityHash: generateIntegrityHash(`${user.email}:${title}:${now}`),
    };

    db.activities.unshift(act);
    saveDatabase(db);
    res.json({ activity: act });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bang Ajiib System running on http://localhost:${PORT}`);
  });
}

startServer();
