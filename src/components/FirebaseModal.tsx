import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  firebaseProjectConfig,
  getQuotaConsoleUrl,
  signInWithFirebaseGoogle,
  signOutFirebase,
} from '../lib/firebase';
import {
  X,
  Flame,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Users,
  Lock,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface FirebaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  authReady: boolean;
  sessionCount: number;
  defaultShared: boolean;
  onToggleDefaultShared: (shared: boolean) => void;
  onSyncLocalToFirestore: () => Promise<void>;
  firestoreError: string | null;
  isQuotaError: boolean;
}

export const FirebaseModal: React.FC<FirebaseModalProps> = ({
  isOpen,
  onClose,
  user,
  authReady,
  sessionCount,
  defaultShared,
  onToggleDefaultShared,
  onSyncLocalToFirestore,
  firestoreError,
  isQuotaError,
}) => {
  const [isBusy, setIsBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsBusy(true);
    setErrMsg(null);
    setStatusMsg(null);
    try {
      await signInWithFirebaseGoogle();
      setStatusMsg('Berhasil masuk dengan akun Google & terhubung ke Firestore.');
    } catch (err: any) {
      setErrMsg(err?.message || 'Gagal login dengan Google.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    setIsBusy(true);
    setErrMsg(null);
    setStatusMsg(null);
    try {
      await signOutFirebase();
      setStatusMsg('Anda telah keluar dari Firebase Auth.');
    } catch (err: any) {
      setErrMsg(err?.message || 'Gagal keluar.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSync = async () => {
    setIsBusy(true);
    setErrMsg(null);
    setStatusMsg(null);
    try {
      await onSyncLocalToFirestore();
      setStatusMsg('Seluruh sesi lokal berhasil disinkronkan ke Cloud Firestore.');
    } catch (err: any) {
      setErrMsg(err?.message || 'Gagal menyinkronkan data ke Firestore.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg">
                Firebase Cloud & Firestore Sync
              </h2>
              <p className="text-xs text-amber-100">
                Project: {firebaseProjectConfig.projectId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-sm">
          {/* Status card */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Status Autentikasi & Database
              </span>
              {user && user.emailVerified ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Terhubung Real-Time
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <Lock className="w-3.5 h-3.5" />
                  Belum Login
                </span>
              )}
            </div>

            {!authReady ? (
              <div className="flex items-center gap-2 text-xs text-slate-600 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                Memeriksa sesi Firebase Auth...
              </div>
            ) : user ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {user.displayName || 'Auditor'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={isBusy}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Masuk dengan akun Google untuk menyimpan dan menyinkronkan seluruh hasil audit SOP, template custom, dan data output operator ke <b>Cloud Firestore</b> secara real-time.
                </p>
                <button
                  onClick={handleSignIn}
                  disabled={isBusy}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-sm transition cursor-pointer"
                >
                  {isBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                      />
                    </svg>
                  )}
                  Login dengan Google (Firebase)
                </button>
              </div>
            )}
          </div>

          {/* Visibility / Sharing preference */}
          <div className="p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs sm:text-sm">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Mode Visibilitas Sesi Baru di Firestore</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onToggleDefaultShared(true)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  defaultShared
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Bagikan ke Tim
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Semua auditor terverifikasi dapat melihat & mengisi checklist.
                </p>
              </button>
              <button
                type="button"
                onClick={() => onToggleDefaultShared(false)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  !defaultShared
                    ? 'border-slate-900 bg-slate-100 text-slate-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Pribadi (Saya Saja)
                </div>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Hanya akun Anda yang dapat membaca & mengedit sesi ini.
                </p>
              </button>
            </div>
          </div>

          {/* Sync action */}
          {user && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-orange-50/70 border border-orange-200">
              <div className="text-xs text-orange-950">
                <p className="font-bold">Sinkronisasi Data ({sessionCount} sesi)</p>
                <p className="text-orange-800/90">
                  Unggah seluruh sesi yang ada di browser Anda ke Firestore.
                </p>
              </div>
              <button
                onClick={handleSync}
                disabled={isBusy}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                {isBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Sinkronkan Sekarang
              </button>
            </div>
          )}

          {/* Error / Quota notice */}
          {(firestoreError || errMsg) && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">
                    {isQuotaError ? 'Kuota Harian Firestore Tercapai' : 'Terjadi Kesalahan Firestore'}
                  </p>
                  <p className="break-words">{errMsg || firestoreError}</p>
                  {isQuotaError && (
                    <div className="pt-1 space-y-1">
                      <p>
                        Kuota gratis harian (Spark plan Enterprise edition) akan direset besok.
                      </p>
                      <a
                        href={getQuotaConsoleUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-rose-700 underline"
                      >
                        Buka Firebase Console Database
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Database ID: <code className="font-mono">{firebaseProjectConfig.firestoreDatabaseId}</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
