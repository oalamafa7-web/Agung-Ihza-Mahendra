import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Session, SOPTemplate } from '../types';
import {
  initGoogleAuth,
  googleSignIn,
  googleSignOut,
  getGoogleAccessToken,
  clearGoogleAccessToken,
} from '../lib/googleAuth';
import {
  listGoogleSpreadsheets,
  getSpreadsheetMetadata,
  importFromGoogleSheet,
  createGoogleSheetFromSession,
  updateExistingGoogleSheet,
  DriveSpreadsheetFile,
  SpreadsheetMetadata,
  GoogleAuthExpiredError,
} from '../utils/googleSheetsService';
import { ConfirmationModal } from './ConfirmationModal';
import {
  X,
  FileSpreadsheet,
  Search,
  RefreshCw,
  LogOut,
  CheckSquare,
  Square,
  Download,
  Upload,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Link as LinkIcon,
  Plus,
} from 'lucide-react';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: SOPTemplate[];
  sessions: Session[];
  activeSession?: Session | null;
  initialMode?: 'import' | 'export';
  onImportSuccess: (
    newSessions: Session[],
    newTemplates: SOPTemplate[],
    sheetTitle: string
  ) => void;
  onLinkSessionToSheet?: (
    sessionId: string,
    spreadsheetId: string,
    spreadsheetUrl: string
  ) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  templates,
  sessions,
  activeSession = null,
  initialMode = 'import',
  onImportSuccess,
  onLinkSessionToSheet,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [mode, setMode] = useState<'import' | 'export'>(initialMode);
  const [files, setFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);

  const [manualUrlOrId, setManualUrlOrId] = useState<string>('');
  const [selectedMetadata, setSelectedMetadata] =
    useState<SpreadsheetMetadata | null>(null);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Export state
  const [exportSessionId, setExportSessionId] = useState<string>(
    activeSession?.id || sessions[0]?.id || ''
  );
  const [targetUpdateSheetId, setTargetUpdateSheetId] = useState<string>('');
  const [exportedResult, setExportedResult] = useState<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    title: string;
  } | null>(null);

  const [statusMessage, setStatusMessage] = useState<{
    type: 'error' | 'success' | 'info';
    text: string;
  } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Konfirmasi',
    onConfirm: () => {},
  });

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (activeSession?.id) {
      setExportSessionId(activeSession.id);
      if (activeSession.googleSheetId) {
        setTargetUpdateSheetId(activeSession.googleSheetId);
      }
    } else if (!exportSessionId && sessions[0]?.id) {
      setExportSessionId(sessions[0].id);
    }
  }, [activeSession, sessions, isOpen]);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (authUser, token) => {
        setUser(authUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      (authUser) => {
        setUser(authUser);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen && !needsAuth && accessToken) {
      loadDriveFiles();
    }
  }, [isOpen, needsAuth, accessToken]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setStatusMessage(null);
    try {
      const res = await googleSignIn();
      setUser(res.user);
      setAccessToken(res.accessToken);
      setNeedsAuth(false);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Gagal masuk dengan Google. Pastikan pop-up diizinkan.',
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setFiles([]);
    setSelectedMetadata(null);
    setExportedResult(null);
  };

  const handleAuthError = (err: unknown) => {
    if (err instanceof GoogleAuthExpiredError) {
      clearGoogleAccessToken();
      setAccessToken(null);
      setNeedsAuth(true);
      setStatusMessage({
        type: 'error',
        text: 'Sesi token Google berakhir. Silakan klik "Sign in with Google" lagi.',
      });
      return true;
    }
    return false;
  };

  const loadDriveFiles = async (queryOverride?: string) => {
    const token = accessToken || (await getGoogleAccessToken());
    if (!token) {
      setNeedsAuth(true);
      return;
    }

    setIsLoadingFiles(true);
    setStatusMessage(null);
    try {
      const list = await listGoogleSpreadsheets(
        token,
        queryOverride !== undefined ? queryOverride : searchQuery
      );
      setFiles(list);
    } catch (err: any) {
      if (!handleAuthError(err)) {
        setStatusMessage({
          type: 'error',
          text: `Gagal memuat daftar Google Sheets: ${err?.message || 'Unknown error'}`,
        });
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleInspectSpreadsheet = async (idOrUrl: string) => {
    const token = accessToken || (await getGoogleAccessToken());
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    if (!idOrUrl.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Masukkan URL atau Spreadsheet ID Google Sheets terlebih dahulu.',
      });
      return;
    }

    setIsLoadingMeta(true);
    setStatusMessage(null);
    try {
      const meta = await getSpreadsheetMetadata(token, idOrUrl);
      setSelectedMetadata(meta);
      setSelectedTabs(meta.sheets.map((s) => s.title));
    } catch (err: any) {
      if (!handleAuthError(err)) {
        setStatusMessage({
          type: 'error',
          text: `Tidak dapat membaca Google Sheet tersebut: ${err?.message || 'Periksa izin akses atau ID file.'}`,
        });
      }
    } finally {
      setIsLoadingMeta(false);
    }
  };

  const handleToggleTab = (title: string) => {
    setSelectedTabs((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const handleImportSelected = async () => {
    if (!selectedMetadata) return;
    const token = accessToken || (await getGoogleAccessToken());
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    if (selectedTabs.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Pilih minimal 1 tab sheet untuk diimpor.',
      });
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const result = await importFromGoogleSheet(
        token,
        selectedMetadata.spreadsheetId,
        templates,
        selectedTabs
      );

      if (result.sessions.length === 0 && result.newTemplates.length === templates.length) {
        setStatusMessage({
          type: 'info',
          text: 'Tab yang dipilih tidak memiliki kolom tabel database produksi (Process & User Name) maupun format tabel SOP (No. | Proses | PIC).',
        });
        setIsProcessing(false);
        return;
      }

      onImportSuccess(result.sessions, result.newTemplates, result.metadata.title);
      setStatusMessage({
        type: 'success',
        text: `Berhasil mengimpor ${result.sessions.length} sesi dari "${result.metadata.title}".`,
      });
    } catch (err: any) {
      if (!handleAuthError(err)) {
        setStatusMessage({
          type: 'error',
          text: `Gagal mengimpor data: ${err?.message || 'Unknown error'}`,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedExportSession =
    sessions.find((s) => s.id === exportSessionId) || null;

  const handleCreateNewSpreadsheet = async () => {
    if (!selectedExportSession) return;
    const token = accessToken || (await getGoogleAccessToken());
    if (!token) {
      setNeedsAuth(true);
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    setExportedResult(null);
    try {
      const res = await createGoogleSheetFromSession(
        token,
        selectedExportSession,
        templates
      );
      setExportedResult(res);
      setTargetUpdateSheetId(res.spreadsheetId);
      if (onLinkSessionToSheet) {
        onLinkSessionToSheet(
          selectedExportSession.id,
          res.spreadsheetId,
          res.spreadsheetUrl
        );
      }
      setStatusMessage({
        type: 'success',
        text: `Spreadsheet baru "${res.title}" berhasil dibuat di Google Drive Anda!`,
      });
      loadDriveFiles();
    } catch (err: any) {
      if (!handleAuthError(err)) {
        setStatusMessage({
          type: 'error',
          text: `Gagal membuat Google Sheet: ${err?.message || 'Unknown error'}`,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const requestOverwriteExistingSheet = () => {
    if (!selectedExportSession) return;
    if (!targetUpdateSheetId.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Pilih atau masukkan ID / URL Google Spreadsheet tujuan yang akan diperbarui.',
      });
      return;
    }

    const matchedFile = files.find((f) => f.id === targetUpdateSheetId);
    const targetName = matchedFile
      ? `"${matchedFile.name}"`
      : `Spreadsheet (${targetUpdateSheetId.slice(0, 18)}...)`;

    setConfirmModal({
      isOpen: true,
      title: 'Timpa & Perbarui Data di Google Sheets?',
      message: `Anda akan menimpa tab Summary, Checklist, Operator, dan Database pada ${targetName} dengan data audit terbaru dari Line ${selectedExportSession.line}.\n\nData lama pada keempat tab tersebut akan digantikan. Lanjutkan?`,
      confirmLabel: 'Ya, Perbarui Google Sheet',
      onConfirm: () => executeOverwriteExistingSheet(),
    });
  };

  const executeOverwriteExistingSheet = async () => {
    if (!selectedExportSession) return;
    const token = accessToken || (await getGoogleAccessToken());
    if (!token) {
      setNeedsAuth(true);
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    setExportedResult(null);
    try {
      const res = await updateExistingGoogleSheet(
        token,
        targetUpdateSheetId,
        selectedExportSession,
        templates
      );
      setExportedResult(res);
      if (onLinkSessionToSheet) {
        onLinkSessionToSheet(
          selectedExportSession.id,
          res.spreadsheetId,
          res.spreadsheetUrl
        );
      }
      setStatusMessage({
        type: 'success',
        text: `Google Sheet "${res.title}" berhasil diperbarui dengan data checklist & output terbaru!`,
      });
    } catch (err: any) {
      if (!handleAuthError(err)) {
        setStatusMessage({
          type: 'error',
          text: `Gagal memperbarui Google Sheet: ${err?.message || 'Unknown error'}`,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl text-emerald-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Integrasi Google Sheets
              </h2>
              <p className="text-xs text-emerald-200/80">
                Impor data line produksi langsung dari Google Sheets & ekspor laporan audit ke Google Drive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
          {needsAuth ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 text-center space-y-5 shadow-2xs">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold text-slate-900">
                  Hubungkan Akun Google Anda
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Masuk dengan akun Google untuk membaca file spreadsheet produksi dari Google Drive serta membuat atau memperbarui laporan hasil audit SOP secara langsung.
                </p>
              </div>

              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={isLoggingIn}
                  className="inline-flex items-center gap-3 px-5 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-semibold text-sm shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  ) : (
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="w-5 h-5 block"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  )}
                  <span>{isLoggingIn ? 'Menghubungkan...' : 'Sign in with Google'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Connected Account Bar */}
              <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Google User'}
                      className="w-9 h-9 rounded-full border border-slate-200"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm">
                      {(user?.displayName || user?.email || 'G')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900">
                      {user?.displayName || 'Akun Google Terhubung'}
                    </div>
                    <div className="text-[11px] text-slate-500">{user?.email}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </div>

              {/* Mode Switch Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setMode('import');
                    setStatusMessage(null);
                  }}
                  className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                    mode === 'import'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  <span>Impor dari Google Sheets</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('export');
                    setStatusMessage(null);
                  }}
                  className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                    mode === 'export'
                      ? 'bg-white text-blue-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Ekspor / Sync ke Google Sheets</span>
                </button>
              </div>

              {/* Status Alert */}
              {statusMessage && (
                <div
                  className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                    statusMessage.type === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : statusMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-blue-50 border-blue-200 text-blue-900'
                  }`}
                >
                  {statusMessage.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{statusMessage.text}</span>
                </div>
              )}

              {/* IMPORT MODE */}
              {mode === 'import' && (
                <div className="space-y-4">
                  {/* Paste URL / ID */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-emerald-600" />
                      Buka via Link atau ID Google Sheets:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Tempel link https://docs.google.com/spreadsheets/d/... atau ID"
                        value={manualUrlOrId}
                        onChange={(e) => setManualUrlOrId(e.target.value)}
                        className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleInspectSpreadsheet(manualUrlOrId)}
                        disabled={isLoadingMeta}
                        className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition shrink-0"
                      >
                        {isLoadingMeta ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                        <span>Muat Sheet</span>
                      </button>
                    </div>
                  </div>

                  {/* Browse Drive Spreadsheets */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700">
                        Pilih dari Google Drive Anda:
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Cari nama file..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') loadDriveFiles();
                            }}
                            className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => loadDriveFiles()}
                          disabled={isLoadingFiles}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                          title="Muat ulang daftar file"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    {isLoadingFiles ? (
                      <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                        <span>Memuat daftar Google Sheets dari Drive...</span>
                      </div>
                    ) : files.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 italic">
                        Tidak ditemukan Google Spreadsheet yang cocok di Drive Anda.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                        {files.map((f) => {
                          const isSelected =
                            selectedMetadata?.spreadsheetId === f.id;
                          return (
                            <div
                              key={f.id}
                              onClick={() => handleInspectSpreadsheet(f.id)}
                              className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition ${
                                isSelected
                                  ? 'bg-emerald-50 border-l-4 border-l-emerald-600'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-900 truncate">
                                    {f.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {f.modifiedTime
                                      ? `Diubah: ${new Date(
                                          f.modifiedTime
                                        ).toLocaleString('id-ID')}`
                                      : f.id}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[11px] font-semibold text-emerald-700 shrink-0">
                                {isSelected ? 'Terpilih' : 'Pilih'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Sheet Tab Selector */}
                  {selectedMetadata && (
                    <div className="bg-white p-4 rounded-2xl border-2 border-emerald-500/40 space-y-3 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                            {selectedMetadata.title}
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Pilih tab sheet yang berisi data produksi line atau template SOP ({selectedTabs.length}/{selectedMetadata.sheets.length} dipilih):
                          </p>
                        </div>
                        <a
                          href={selectedMetadata.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                        >
                          <span>Buka Sheet</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedMetadata.sheets.map((tab) => {
                          const checked = selectedTabs.includes(tab.title);
                          return (
                            <button
                              key={tab.sheetId}
                              type="button"
                              onClick={() => handleToggleTab(tab.title)}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                                checked
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {checked ? (
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-slate-400" />
                              )}
                              <span>{tab.title}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleImportSelected}
                          disabled={isProcessing || selectedTabs.length === 0}
                          className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          <span>
                            {isProcessing
                              ? 'Mengimpor Data...'
                              : `Impor ${selectedTabs.length} Tab ke Aplikasi`}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* EXPORT MODE */}
              {mode === 'export' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        1. Pilih Sesi Audit yang Akan Diekspor / Disinkronkan:
                      </label>
                      {sessions.length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 italic">
                          Belum ada sesi audit untuk diekspor. Silakan impor data terlebih dahulu.
                        </div>
                      ) : (
                        <select
                          value={exportSessionId}
                          onChange={(e) => {
                            const newId = e.target.value;
                            setExportSessionId(newId);
                            const found = sessions.find((s) => s.id === newId);
                            setTargetUpdateSheetId(found?.googleSheetId || '');
                          }}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                          {sessions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.factory || 'Factory 1'} • {s.line} ({s.date || 'No Date'}) — {s.ops.length} Operator
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {selectedExportSession && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                        {/* Option A: Create New Spreadsheet */}
                        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 flex flex-col justify-between space-y-3">
                          <div className="space-y-1">
                            <h4 className="text-xs sm:text-sm font-bold text-blue-950 flex items-center gap-1.5">
                              <Plus className="w-4 h-4 text-blue-700" />
                              Buat Google Sheet Baru
                            </h4>
                            <p className="text-[11px] text-blue-800 leading-relaxed">
                              Membuat file Google Spreadsheet baru di Drive Anda berisi 4 tab lengkap (Summary, Checklist, Operator, Database).
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleCreateNewSpreadsheet}
                            disabled={isProcessing}
                            className="w-full py-2.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="w-4 h-4" />
                            )}
                            <span>Buat Spreadsheet Baru</span>
                          </button>
                        </div>

                        {/* Option B: Update Existing Spreadsheet */}
                        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex flex-col justify-between space-y-3">
                          <div className="space-y-2">
                            <h4 className="text-xs sm:text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                              <RefreshCw className="w-4 h-4 text-emerald-700" />
                              Perbarui Google Sheet yang Ada
                            </h4>
                            <p className="text-[11px] text-emerald-800 leading-relaxed">
                              Memperbarui spreadsheet yang sudah ada dengan hasil checklist & output terbaru.
                            </p>
                            <select
                              value={targetUpdateSheetId}
                              onChange={(e) => setTargetUpdateSheetId(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            >
                              <option value="">— Pilih Spreadsheet dari Drive —</option>
                              {files.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Atau tempel ID / URL Google Sheet..."
                              value={targetUpdateSheetId}
                              onChange={(e) => setTargetUpdateSheetId(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-[11px] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={requestOverwriteExistingSheet}
                            disabled={isProcessing || !targetUpdateSheetId.trim()}
                            className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            <span>Perbarui Spreadsheet Ini</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {exportedResult && (
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-emerald-900">
                          <div className="font-bold">{exportedResult.title}</div>
                          <div className="text-[11px] text-emerald-700">
                            Siap dibuka dan dibagikan ke tim produksi Anda.
                          </div>
                        </div>
                        <a
                          href={exportedResult.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                        >
                          <span>Buka di Google Sheets</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Mandatory Confirmation Dialog for Mutating / Overwriting Google Sheets */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={false}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
