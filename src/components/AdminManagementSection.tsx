import React, { useState } from 'react';
import { UserPlus, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff, Trash2 } from 'lucide-react';
import { type UserRecord, type UserRole, type AccountStatus } from '../constants/config.ts';

interface AdminManagementSectionProps {
  users: UserRecord[];
  currentAdminEmail: string;
  onCreateUser: (newUser: {
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
  }) => Promise<void>;
  onUpdateUserAdmin: (payload: {
    targetEmail: string;
    role: UserRole;
    status: AccountStatus;
  }) => Promise<void>;
  onDeleteUserAdmin: (targetEmail: string) => Promise<void>;
}

export const AdminManagementSection: React.FC<AdminManagementSectionProps> = ({
  users,
  currentAdminEmail,
  onCreateUser,
  onUpdateUserAdmin,
  onDeleteUserAdmin,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const [newUserForm, setNewUserForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'user' as UserRole,
    department: '',
    position: '',
    nik: '',
    phone: '',
    address: '',
    personalNotes: '',
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);
    try {
      await onCreateUser(newUserForm);
      setFeedback({
        type: 'success',
        message: `Data user (${newUserForm.email}) berhasil disimpan ke database dan Spreadsheet.`,
      });
      setNewUserForm({
        email: '',
        name: '',
        password: '',
        role: 'user',
        department: '',
        position: '',
        nik: '',
        phone: '',
        address: '',
        personalNotes: '',
      });
      setShowAddForm(false);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal mendaftarkan pengguna.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async (targetEmail: string) => {
    setFeedback(null);
    setDeletingEmail(targetEmail);
    try {
      await onDeleteUserAdmin(targetEmail);
      setFeedback({
        type: 'success',
        message: `Data user (${targetEmail}) berhasil dihapus dari aplikasi dan Spreadsheet.`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Gagal menghapus data pengguna.',
      });
    } finally {
      setDeletingEmail(null);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Manajemen Pengguna (Khusus Admin)</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPasswords((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            {showPasswords ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Sembunyikan Password</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Tampilkan Password</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'Tutup' : 'Tambah Email'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Email *</label>
              <input
                type="email"
                required
                placeholder="email@domain.com"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Nama *</label>
              <input
                type="text"
                required
                placeholder="Nama lengkap"
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Password *</label>
              <input
                type="text"
                required
                placeholder="Masukkan password..."
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Role *</label>
              <select
                value={newUserForm.role}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan ke Spreadsheet</span>
              )}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
              <th className="py-2.5 pr-4">Email</th>
              <th className="py-2.5 px-4">Nama</th>
              <th className="py-2.5 px-4">Password</th>
              <th className="py-2.5 px-4">Role</th>
              <th className="py-2.5 px-4">Status Akun</th>
              <th className="py-2.5 pl-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {users.map((u) => {
              const isSelf = u.email.toLowerCase() === currentAdminEmail.toLowerCase();
              const isDeleting = deletingEmail === u.email;
              return (
                <tr key={u.id}>
                  <td className="py-3 pr-4 font-mono text-slate-900">{u.email}</td>
                  <td className="py-3 px-4 font-medium text-slate-800">{u.name}</td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    {showPasswords ? u.password || '-' : '••••••••'}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        onUpdateUserAdmin({
                          targetEmail: u.email,
                          role: e.target.value as UserRole,
                          status: u.status,
                        })
                      }
                      className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 cursor-pointer"
                    >
                      <option value="admin">Admin</option>
                      <option value="user">User</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={u.status}
                      onChange={(e) =>
                        onUpdateUserAdmin({
                          targetEmail: u.email,
                          role: u.role,
                          status: e.target.value as AccountStatus,
                        })
                      }
                      className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 cursor-pointer"
                    >
                      <option value="Aktif & Terverifikasi">Aktif &amp; Terverifikasi</option>
                      <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                      <option value="Dibekukan Sementara">Dibekukan Sementara</option>
                    </select>
                  </td>
                  <td className="py-3 pl-4 text-right">
                    <button
                      type="button"
                      disabled={isSelf || isDeleting}
                      onClick={() => handleDeleteClick(u.email)}
                      title={
                        isSelf
                          ? 'Akun Admin aktif tidak dapat dihapus'
                          : 'Hapus data pengguna ini dari aplikasi dan Spreadsheet'
                      }
                      className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeleting ? 'Menghapus...' : 'Hapus Data'}</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
