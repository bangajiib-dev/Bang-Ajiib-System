import React from 'react';
import { RefreshCw, ExternalLink, ShieldCheck, Lock, Database } from 'lucide-react';
import {
  PERMANENT_LINKS,
  type ActivityRecord,
  type SyncTelemetry,
  type UserRecord,
  type UserRole,
} from '../constants/config.ts';

interface SystemSummary {
  totalUsers: number;
  adminCount: number;
  regularUserCount: number;
  verifiedCount: number;
  pendingCount: number;
  suspendedCount: number;
  encryptedFieldsCount: number;
  totalActivities: number;
}

interface VisualAnalyticsSectionProps {
  role: UserRole;
  personalProfile: UserRecord;
  summary: SystemSummary;
  activities: ActivityRecord[];
  telemetry: SyncTelemetry;
  secondsToNextSync: number;
  isSyncing: boolean;
  onTriggerSync: () => Promise<void>;
}

export const VisualAnalyticsSection: React.FC<VisualAnalyticsSectionProps> = ({
  role,
  personalProfile,
  summary,
  activities,
  telemetry,
  secondsToNextSync,
  isSyncing,
  onTriggerSync,
}) => {
  const categoryCounts = {
    Autentikasi: activities.filter((a) => a.category === 'Autentikasi').length,
    'Pembaruan Data': activities.filter((a) => a.category === 'Pembaruan Data').length,
    Sinkronisasi: activities.filter((a) => a.category === 'Sinkronisasi').length,
    Keamanan: activities.filter((a) => a.category === 'Keamanan').length,
  };

  const maxCatCount = Math.max(1, ...Object.values(categoryCounts));

  return (
    <section className="space-y-4">
      {/* Simple 3-Column Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Status Akun</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-base font-bold text-slate-900 mt-2 truncate">
            {personalProfile.status}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Role: <span className="font-semibold text-slate-800 uppercase">{role}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Keamanan &amp; Privasi</span>
            <Lock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-base font-bold text-slate-900 mt-2">Terenkripsi AES-256</div>
          <div className="text-xs text-slate-500 mt-1">
            Data antar-user terisolasi penuh
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Sinkronisasi Otomatis</span>
            <Database className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-2">
            {secondsToNextSync} detik
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {role === 'admin'
              ? `${summary.totalUsers} Pengguna Terdaftar`
              : `${summary.totalActivities} Aktivitas Tersimpan`}
          </div>
        </div>
      </div>

      {/* Simple Visual Summary & Permanent Links */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Ringkasan Visual &amp; Status Sinkronisasi Real-Time
            </h2>
            <p className="text-xs text-slate-500">
              Pemantauan aktivitas dan koneksi permanen database Spreadsheet
            </p>
          </div>

          <button
            type="button"
            onClick={onTriggerSync}
            disabled={isSyncing}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data'}</span>
          </button>
        </div>

        {/* Visual Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.entries(categoryCounts) as [keyof typeof categoryCounts, number][]).map(
            ([category, count]) => {
              const widthPct = count === 0 ? 4 : Math.max(12, Math.round((count / maxCatCount) * 100));
              return (
                <div key={category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">{category}</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {count}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            }
          )}
        </div>

        {/* Permanent Links Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={PERMANENT_LINKS.SPREADSHEET_EDIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <span>Database Spreadsheet Permanen</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span aria-hidden="true">·</span>
            <a
              href={PERMANENT_LINKS.APPS_SCRIPT_EXEC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <span>Endpoint Apps Script Permanen</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <span className="font-mono text-[11px] text-slate-400 tabular-nums">
            Update: {new Date(telemetry.lastSyncTime).toLocaleTimeString('id-ID')}
          </span>
        </div>
      </div>
    </section>
  );
};
