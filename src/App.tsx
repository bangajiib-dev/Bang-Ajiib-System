/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut } from 'lucide-react';
import {
  PERMANENT_LINKS,
  UNREGISTERED_EMAIL_MESSAGE,
  fetchUsersDirectlyFromAppsScript,
  pushUsersDirectlyToAppsScript,
  buildDirectTelemetry,
  type UserRecord,
  type ActivityRecord,
  type SyncTelemetry,
  type UserRole,
  type AccountStatus,
} from './constants/config.ts';
import { LoginView } from './components/LoginView.tsx';
import { VisualAnalyticsSection } from './components/VisualAnalyticsSection.tsx';
import { PersonalDataSection } from './components/PersonalDataSection.tsx';
import { AdminManagementSection } from './components/AdminManagementSection.tsx';

interface DashboardPayload {
  role: UserRole;
  personalProfile: UserRecord;
  personalActivities: ActivityRecord[];
  allUsers?: UserRecord[];
  allActivities?: ActivityRecord[];
  telemetry: SyncTelemetry;
  systemSummary: {
    totalUsers: number;
    adminCount: number;
    regularUserCount: number;
    verifiedCount: number;
    pendingCount: number;
    suspendedCount: number;
    encryptedFieldsCount: number;
    totalActivities: number;
  };
}

function buildPayloadFromUsersList(
  email: string,
  users: UserRecord[]
): DashboardPayload | null {
  const currentUser = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!currentUser) return null;

  const telemetry = buildDirectTelemetry(users.length);

  if (currentUser.role === 'admin') {
    return {
      role: 'admin',
      personalProfile: currentUser,
      personalActivities: [],
      allUsers: users,
      allActivities: [],
      telemetry,
      systemSummary: {
        totalUsers: users.length,
        adminCount: users.filter((u) => u.role === 'admin').length,
        regularUserCount: users.filter((u) => u.role === 'user').length,
        verifiedCount: users.filter((u) => u.status === 'Aktif & Terverifikasi').length,
        pendingCount: users.filter((u) => u.status === 'Menunggu Verifikasi').length,
        suspendedCount: users.filter((u) => u.status === 'Dibekukan Sementara').length,
        encryptedFieldsCount: users.length * 5,
        totalActivities: 0,
      },
    };
  }

  return {
    role: 'user',
    personalProfile: currentUser,
    personalActivities: [],
    telemetry,
    systemSummary: {
      totalUsers: 1,
      adminCount: 0,
      regularUserCount: 1,
      verifiedCount: currentUser.status === 'Aktif & Terverifikasi' ? 1 : 0,
      pendingCount: currentUser.status === 'Menunggu Verifikasi' ? 1 : 0,
      suspendedCount: 0,
      encryptedFieldsCount: 5,
      totalActivities: 0,
    },
  };
}

export default function App() {
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(() => {
    return localStorage.getItem('bang_ajiib_session_email');
  });
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [secondsToNextSync, setSecondsToNextSync] = useState(15);

  const fetchDashboardData = useCallback(async (email: string) => {
    try {
      const res = await fetch(`/api/dashboard?email=${encodeURIComponent(email)}`);
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        if (!res.ok) {
          localStorage.removeItem('bang_ajiib_session_email');
          setLoggedInEmail(null);
          setDashboardData(null);
          return;
        }
        const data: DashboardPayload = await res.json();
        setDashboardData(data);
        return;
      }
    } catch {
      // Fallback langsung ke Google Apps Script jika server sedang tidak merespons JSON
    }

    // Fallback langsung membaca dari Google Apps Script
    try {
      const users = await fetchUsersDirectlyFromAppsScript();
      const payload = buildPayloadFromUsersList(email, users);
      if (!payload) {
        localStorage.removeItem('bang_ajiib_session_email');
        setLoggedInEmail(null);
        setDashboardData(null);
        return;
      }
      setDashboardData(payload);
    } catch {
      // Pertahankan state saat ini jika jaringan sibuk
    }
  }, []);

  useEffect(() => {
    if (loggedInEmail) {
      fetchDashboardData(loggedInEmail);
    }
  }, [loggedInEmail, fetchDashboardData]);

  // Sinkronisasi Otomatis Berkala setiap 15 detik
  useEffect(() => {
    if (!loggedInEmail) return;

    const timer = setInterval(() => {
      setSecondsToNextSync((prev) => {
        if (prev <= 1) {
          fetch('/api/sync/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requesterEmail: loggedInEmail,
              reason: 'Auto-Sync Interval',
              logActivity: false,
            }),
          })
            .then(() => {
              fetchDashboardData(loggedInEmail);
            })
            .catch(() => {
              fetchDashboardData(loggedInEmail);
            });
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loggedInEmail, fetchDashboardData]);

  const handleLoginSuccess = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();

    // Coba melalui endpoint API terlebih dahulu
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || UNREGISTERED_EMAIL_MESSAGE);
        }
        localStorage.setItem('bang_ajiib_session_email', cleanEmail);
        setLoggedInEmail(cleanEmail);
        await fetchDashboardData(cleanEmail);
        return;
      }
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        !err.message.includes('Unexpected token') &&
        !err.message.includes('Failed to fetch')
      ) {
        throw err;
      }
    }

    // Jika di-deploy statis (tanpa Express /api), verifikasi langsung ke Google Apps Script (Sheet DataUser)
    const users = await fetchUsersDirectlyFromAppsScript();
    const matchedUser = users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!matchedUser) {
      throw new Error(UNREGISTERED_EMAIL_MESSAGE);
    }

    if (matchedUser.status === 'Dibekukan Sementara') {
      throw new Error(`Akun "${cleanEmail}" sedang dinonaktifkan sementara.`);
    }

    localStorage.setItem('bang_ajiib_session_email', cleanEmail);
    setLoggedInEmail(cleanEmail);
    const payload = buildPayloadFromUsersList(cleanEmail, users);
    setDashboardData(payload);
  };

  const handleLogout = async () => {
    if (loggedInEmail) {
      try {
        await fetch('/api/activity/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: loggedInEmail,
            category: 'Autentikasi',
            title: 'Logout Sesi Pengguna',
            description: `Pengguna ${loggedInEmail} keluar dari sistem.`,
          }),
        });
      } catch {
        // Lanjutkan logout
      }
    }
    localStorage.removeItem('bang_ajiib_session_email');
    setLoggedInEmail(null);
    setDashboardData(null);
  };

  const handleManualSync = async () => {
    if (!loggedInEmail || isSyncing) return;
    setIsSyncing(true);
    try {
      await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterEmail: loggedInEmail,
          reason: 'Manual Sync',
          logActivity: true,
        }),
      }).catch(() => {});
      setSecondsToNextSync(15);
      await fetchDashboardData(loggedInEmail);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateUserByAdmin = async (newUser: {
    email: string;
    name: string;
    password: string;
    role: UserRole;
    department: string;
    position: string;
    nik: string;
    phone: string;
    address: string;
    personalNotes: string;
  }) => {
    if (!loggedInEmail) return;
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterEmail: loggedInEmail,
          ...newUser,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Gagal mendaftarkan pengguna baru.');
        }
        setSecondsToNextSync(15);
        await fetchDashboardData(loggedInEmail);
        return;
      }
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        !err.message.includes('Unexpected token') &&
        !err.message.includes('Failed to fetch')
      ) {
        throw err;
      }
    }

    // Fallback langsung ke Google Apps Script
    const currentUsers = await fetchUsersDirectlyFromAppsScript();
    const cleanEmail = newUser.email.trim().toLowerCase();
    if (currentUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error(`Email "${cleanEmail}" sudah terdaftar.`);
    }
    const now = new Date().toISOString();
    const created: UserRecord = {
      id: `USR-${String(currentUsers.length + 1).padStart(3, '0')}`,
      email: cleanEmail,
      name: newUser.name.trim() || cleanEmail.split('@')[0],
      password: newUser.password.trim(),
      role: newUser.role,
      department: '-',
      position: newUser.role === 'admin' ? 'Admin' : 'User',
      status: 'Aktif & Terverifikasi',
      nik: '-',
      phone: '-',
      address: '-',
      personalNotes: '-',
      securityClearance: newUser.role === 'admin' ? 'Otoritas Admin' : 'Akses Personal Terisolasi',
      joinedAt: now,
      lastLoginAt: now,
      lastSyncedAt: now,
      syncVersion: 1,
      encryptedVault: {
        passwordCipher: '-',
        nikCipher: '-',
        phoneCipher: '-',
        addressCipher: '-',
        notesCipher: '-',
        keyFingerprint: cleanEmail.slice(0, 8).toUpperCase(),
        algorithm: 'AES-256-GCM',
      },
    };
    const updatedList = [...currentUsers, created];
    await pushUsersDirectlyToAppsScript(updatedList, `Create User: ${cleanEmail}`);
    setSecondsToNextSync(15);
    await fetchDashboardData(loggedInEmail);
  };

  const handleUpdateUserByAdmin = async (payload: {
    targetEmail: string;
    role: UserRole;
    status: AccountStatus;
  }) => {
    if (!loggedInEmail) return;
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterEmail: loggedInEmail,
          ...payload,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json') && res.ok) {
        setSecondsToNextSync(15);
        await fetchDashboardData(loggedInEmail);
        return;
      }
    } catch {
      // Fallback langsung ke Google Apps Script
    }

    const currentUsers = await fetchUsersDirectlyFromAppsScript();
    const updatedList = currentUsers.map((u) =>
      u.email.toLowerCase() === payload.targetEmail.toLowerCase()
        ? { ...u, role: payload.role, status: payload.status }
        : u
    );
    await pushUsersDirectlyToAppsScript(updatedList, `Update User: ${payload.targetEmail}`);
    setSecondsToNextSync(15);
    await fetchDashboardData(loggedInEmail);
  };

  const handleDeleteUserByAdmin = async (targetEmail: string) => {
    if (!loggedInEmail) return;
    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterEmail: loggedInEmail,
          targetEmail,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Gagal menghapus data pengguna.');
        }
        setSecondsToNextSync(15);
        await fetchDashboardData(loggedInEmail);
        return;
      }
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        !err.message.includes('Unexpected token') &&
        !err.message.includes('Failed to fetch')
      ) {
        throw err;
      }
    }

    // Fallback langsung ke Google Apps Script
    const currentUsers = await fetchUsersDirectlyFromAppsScript();
    const updatedList = currentUsers.filter(
      (u) => u.email.toLowerCase() !== targetEmail.toLowerCase()
    );
    await pushUsersDirectlyToAppsScript(updatedList, `Delete User: ${targetEmail}`);
    setSecondsToNextSync(15);
    await fetchDashboardData(loggedInEmail);
  };

  const handleMasukSystemClick = () => {
    if (loggedInEmail) {
      fetch('/api/activity/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loggedInEmail,
          category: 'Autentikasi',
          title: 'Akses MASUK SYSTEM',
          description: `Pengguna mengakses tautan MASUK SYSTEM (${PERMANENT_LINKS.MASUK_SYSTEM_TARGET_URL}).`,
        }),
      }).catch(() => {});
    }
  };

  return (
    <AnimatePresence mode="wait">
      {!loggedInEmail || !dashboardData ? (
        <motion.div
          key="login-screen"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <LoginView onLoginSuccess={handleLoginSuccess} />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard-screen"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-screen bg-slate-50 text-slate-900 flex flex-col"
        >
          {/* Simple Top Header with Top-Right Logout Button */}
          <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/aistudio/image_db0b13c8.png"
                  alt="Logo Bang Ajiib System"
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                />
                <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
                  Bang Ajiib System
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-xs font-mono text-slate-500">
                  {dashboardData.personalProfile.email}
                </span>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Logout"
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </header>

          {/* Simplified Single-Column Main Container */}
          <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
            {/* Simple Welcome Box */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="space-y-1">
                <div className="text-xs text-slate-500">
                  Selamat datang,{' '}
                  <span className="font-semibold text-slate-800 uppercase">
                    {dashboardData.role}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-slate-900">
                  {dashboardData.personalProfile.name}
                </h1>
              </div>
            </section>

            {/* 1. Real-Time Visual Summary & Sync (Hanya ditampilkan untuk Admin) */}
            {dashboardData.role === 'admin' && (
              <VisualAnalyticsSection
                role={dashboardData.role}
                personalProfile={dashboardData.personalProfile}
                summary={dashboardData.systemSummary}
                activities={
                  dashboardData.allActivities || dashboardData.personalActivities
                }
                telemetry={dashboardData.telemetry}
                secondsToNextSync={secondsToNextSync}
                isSyncing={isSyncing}
                onTriggerSync={handleManualSync}
              />
            )}

            {/* 2. Personal Profile Data + Tombol MASUK SYSTEM di bawah informasi data pribadi */}
            <PersonalDataSection
              profile={dashboardData.personalProfile}
              onMasukSystemClick={handleMasukSystemClick}
            />

            {/* 3. Admin Management (Only for Admin role) */}
            {dashboardData.role === 'admin' && dashboardData.allUsers && (
              <AdminManagementSection
                users={dashboardData.allUsers}
                currentAdminEmail={dashboardData.personalProfile.email}
                onCreateUser={handleCreateUserByAdmin}
                onUpdateUserAdmin={handleUpdateUserByAdmin}
                onDeleteUserAdmin={handleDeleteUserByAdmin}
              />
            )}
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
