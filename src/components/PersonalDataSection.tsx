import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Copy, Check } from 'lucide-react';
import { PERMANENT_LINKS, type UserRecord } from '../constants/config.ts';

interface PersonalDataSectionProps {
  profile: UserRecord;
  onMasukSystemClick?: () => void;
}

export const PersonalDataSection: React.FC<PersonalDataSectionProps> = ({
  profile,
  onMasukSystemClick,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyPassword = async () => {
    const pwd = profile.password || '';
    if (!pwd || pwd === '-') return;
    try {
      await navigator.clipboard.writeText(pwd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = pwd;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      <div className="pb-4 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-900">Data Pribadi Pengguna</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <div className="text-slate-500">Nama Lengkap</div>
          <div className="font-semibold text-slate-900 mt-0.5">{profile.name}</div>
        </div>

        <div>
          <div className="text-slate-500">Email Terdaftar</div>
          <div className="font-mono text-slate-900 mt-0.5 break-all">{profile.email}</div>
        </div>

        <div>
          <div className="text-slate-500">Password</div>
          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-slate-900 break-all">
              {profile.password || '-'}
            </span>
            {profile.password && profile.password !== '-' && (
              <button
                type="button"
                onClick={handleCopyPassword}
                title="Salin Password"
                className={`px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors inline-flex items-center gap-1 cursor-pointer shrink-0 ${
                  copied
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tombol Aksi MASUK SYSTEM di bawah informasi Data Pribadi Pengguna */}
      <div className="pt-4 border-t border-slate-100 flex justify-start sm:justify-end">
        <motion.a
          href={PERMANENT_LINKS.MASUK_SYSTEM_TARGET_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onMasukSystemClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <span>MASUK SYSTEM</span>
          <ArrowUpRight className="w-4 h-4 shrink-0" />
        </motion.a>
      </div>
    </section>
  );
};
