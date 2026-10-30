import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, RefreshCw, ShieldAlert } from 'lucide-react';
import { UNREGISTERED_EMAIL_MESSAGE } from '../constants/config.ts';

interface LoginViewProps {
  onLoginSuccess: (email: string) => Promise<void>;
}

const WhatsAppLogoSvg: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.461 3.484 1.336 5.008L2 22l5.156-1.352a9.927 9.927 0 0 0 4.875 1.289h.004c5.512 0 9.965-4.453 9.965-9.969 0-2.664-1.035-5.168-2.918-7.051A9.907 9.907 0 0 0 12.031 2zm5.824 14.273c-.246.691-1.434 1.324-1.992 1.406-.512.078-1.16.109-1.871-.117-.434-.137-.988-.32-1.703-.629-2.996-1.293-4.953-4.312-5.102-4.512-.148-.199-1.219-1.621-1.219-3.094 0-1.473.77-2.195 1.043-2.496.273-.301.598-.375.797-.375.199 0 .398.004.574.012.184.008.43-.07.672.512.246.598.844 2.066.918 2.215.074.148.125.324.023.523-.098.199-.148.324-.297.496-.148.176-.312.391-.449.523-.148.148-.305.309-.133.605.176.297.777 1.281 1.668 2.074 1.145 1.02 2.109 1.336 2.406 1.484.297.148.473.125.648-.074.176-.199.746-.871.945-1.168.199-.297.398-.246.672-.148.273.098 1.742.82 2.039.969.297.148.496.223.57.348.074.125.074.719-.172 1.41z" />
  </svg>
);

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenWhatsApp = () => {
    const text = `Halo admin, saya ingin meminta kode akses ke BANG AJIIB SYSTEM.`;
    window.open(`https://wa.me/6289635888337?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMsg(UNREGISTERED_EMAIL_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    try {
      await onLoginSuccess(trimmedEmail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : UNREGISTERED_EMAIL_MESSAGE;
      setErrorMsg(
        msg.includes('Unexpected token') || msg.includes('belum terdaftar')
          ? UNREGISTERED_EMAIL_MESSAGE
          : msg
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-6"
      >
        <div className="space-y-1.5 text-center">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm mx-auto mb-3">
            BA
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Bang Ajiib System</h1>
          <p className="text-xs text-slate-500">Masuk menggunakan email yang terdaftar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700">
              Alamat Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="Masukkan email terdaftar..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 transition-colors"
            />
          </div>

          {/* Notifikasi Elegan saat Email Tidak Terdaftar */}
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white tracking-tight">
                      Akses Belum Terdaftar
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{errorMsg}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <WhatsAppLogoSvg className="w-4 h-4" />
                    <span>Hubungi Owner via WhatsApp</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileTap={{ scale: 0.985 }}
            className="w-full min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <span>Masuk</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </form>

        {/* Logo & Tombol WhatsApp pada Tampilan Login */}
        <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-2">
          <motion.button
            type="button"
            onClick={handleOpenWhatsApp}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            title="Hubungi Owner via WhatsApp"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            <span className="w-6 h-6 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0">
              <WhatsAppLogoSvg className="w-3.5 h-3.5" />
            </span>
            <span>Minta Kode Akses via WhatsApp</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
