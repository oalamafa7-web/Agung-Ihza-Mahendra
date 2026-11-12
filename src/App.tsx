import React, { useState, useEffect, useRef } from 'react';
import { Session, SOPTemplate } from './types';
import { BUILTIN_TEMPLATES, DEMO_SESSIONS } from './data/builtinTemplates';
import { parseExcelFiles } from './utils/excelParser';
import { exportSessionToExcel } from './utils/excelExporter';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { SessionDetailView } from './components/SessionDetailView';
import { TemplateManagerModal } from './components/TemplateManagerModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { fmtD } from './utils/sopUtils';
import { RotateCcw, CheckCircle2, AlertCircle, X } from 'lucide-react';

const LS_SESSIONS = 'sopa_sessions_v1';
const LS_TEMPLATES = 'sopa_templates_v1';

interface ToastState {
  show: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  canUndo?: boolean;
}

export default function App() {
  // Load from localStorage or defaults
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const saved = localStorage.getItem(LS_SESSIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((s: Session) => ({
            ...s,
            factory: s.factory || 'Factory 1',
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load sessions from localStorage', e);
    }
    // Seed with realistic demo sessions on first run so user doesn't face an empty blank screen
    return DEMO_SESSIONS;
  });

  const [templates, setTemplates] = useState<SOPTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(LS_TEMPLATES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load templates from localStorage', e);
    }
    return BUILTIN_TEMPLATES;
  });

  // App routing / view state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTemplateFilter, setSelectedTemplateFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('new');

  // Batch selection state
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);

  // Trash buffer for undoing deletion
  const [trashBuffer, setTrashBuffer] = useState<Session[]>([]);

  // Toast state
  const [toast, setToast] = useState<ToastState>({ show: false, message: '' });
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hidden file inputs
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonRestoreInputRef = useRef<HTMLInputElement | null>(null);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_SESSIONS, JSON.stringify(sessions));
    } catch (err) {
      showToast('⚠️ Penyimpanan browser penuh! Lakukan Backup Data lalu hapus beberapa sesi lama.', 'error');
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_TEMPLATES, JSON.stringify(templates));
    } catch (err) {
      console.error('Failed to save templates', err);
    }
  }, [templates]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', canUndo = false) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ show: true, message, type, canUndo });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, message: '' });
      if (canUndo) setTrashBuffer([]);
    }, canUndo ? 8000 : 3500);
  };

  // Upload Excel handler
  const handleExcelFiles = async (files: FileList | File[]) => {
    try {
      const fileArray = Array.from(files);
      const { sessions: newSessions, newTemplates } = await parseExcelFiles(fileArray, templates);

      let addedCount = 0;
      let updatedCount = 0;

      const currentSessions = [...sessions];

      newSessions.forEach((s) => {
        const dupIdx = currentSessions.findIndex(
          (x) => x.line === s.line && x.file === s.file && x.date === s.date && x.tpl === s.tpl
        );

        if (dupIdx >= 0) {
          // Keep existing checklist data, update operator & output data
          currentSessions[dupIdx] = {
            ...currentSessions[dupIdx],
            ops: s.ops,
            hours: s.hours,
            fileName: s.fileName,
            sheet: s.sheet,
          };
          updatedCount++;
        } else {
          currentSessions.unshift(s);
          addedCount++;
        }
      });

      setSessions(currentSessions);
      setTemplates(newTemplates);

      showToast(
        `✅ Berhasil memproses Excel: ${addedCount} sesi baru ditambahkan, ${updatedCount} sesi diperbarui.`,
        'success'
      );
    } catch (err) {
      console.error(err);
      showToast('❌ Gagal memproses file Excel. Pastikan format tabel memiliki kolom yang sesuai.', 'error');
    }
  };

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Ya, Hapus',
    isDestructive: true,
    onConfirm: () => {},
  });

  // Delete sessions with Undo
  const executeDeleteSessions = (ids: string[]) => {
    const toDelete = sessions.filter((s) => ids.includes(s.id));
    if (toDelete.length === 0) return;

    setSessions((prev) => prev.filter((s) => !ids.includes(s.id)));
    setTrashBuffer(toDelete);
    setSelectedSessionIds([]);
    setIsSelectionMode(false);

    if (activeSessionId && ids.includes(activeSessionId)) {
      setActiveSessionId(null);
    }

    showToast(`🗑️ ${toDelete.length} sesi dihapus`, 'info', true);
  };

  const handleDeleteSessions = (ids: string[]) => {
    const toDelete = sessions.filter((s) => ids.includes(s.id));
    if (toDelete.length === 0) return;

    const title =
      toDelete.length === 1
        ? `Hapus Sesi Line ${toDelete[0].line}?`
        : `Hapus ${toDelete.length} Sesi Terpilih?`;

    const message =
      toDelete.length === 1
        ? `Apakah Anda yakin ingin menghapus sesi Line ${toDelete[0].line} (${fmtD(toDelete[0].date)})?\nSemua checklist dan data output sesi ini akan dihapus.`
        : `Apakah Anda yakin ingin menghapus ${toDelete.length} sesi terpilih?\nSemua checklist dan data output dari sesi-sesi tersebut akan dihapus.`;

    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmLabel: 'Hapus Sesi',
      isDestructive: true,
      onConfirm: () => executeDeleteSessions(ids),
    });
  };

  const handleDeleteAllSessions = () => {
    if (sessions.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Semua Sesi?',
      message: `Apakah Anda yakin ingin menghapus seluruh ${sessions.length} sesi yang ada?\nSemua data penilaian akan dibersihkan. Anda tetap dapat mengurungkan (Undo) tindakan ini jika berubah pikiran.`,
      confirmLabel: 'Hapus Semua Sesi',
      isDestructive: true,
      onConfirm: () => executeDeleteSessions(sessions.map((s) => s.id)),
    });
  };

  const handleUndoDelete = () => {
    if (trashBuffer.length === 0) return;
    setSessions((prev) => [...trashBuffer, ...prev]);
    const restoredCount = trashBuffer.length;
    setTrashBuffer([]);
    setToast({ show: false, message: '' });
    setTimeout(() => {
      showToast(`↩️ Berhasil mengembalikan ${restoredCount} sesi.`, 'success');
    }, 200);
  };

  // Backup data
  const handleBackup = () => {
    const data = {
      version: 1,
      appName: 'Performance Assessment SOP',
      exportedAt: new Date().toISOString(),
      sessions,
      templates,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_SOP_Assessment_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 500);
    showToast('💾 Cadangan data (Backup) berhasil diunduh.', 'success');
  };

  // Restore data
  const handleRestoreFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      let sessionCount = 0;

      if (data.templates && Array.isArray(data.templates)) {
        const mergedTemplates = [...templates];
        data.templates.forEach((t: SOPTemplate) => {
          const idx = mergedTemplates.findIndex((x) => x.key === t.key);
          if (idx >= 0) mergedTemplates[idx] = t;
          else mergedTemplates.push(t);
        });
        setTemplates(mergedTemplates);
      }

      if (data.sessions && Array.isArray(data.sessions)) {
        const mergedSessions = [...sessions];
        data.sessions.forEach((s: Session) => {
          const idx = mergedSessions.findIndex((x) => x.id === s.id);
          if (idx >= 0) mergedSessions[idx] = s;
          else mergedSessions.push(s);
          sessionCount++;
        });
        setSessions(mergedSessions);
      }

      showToast(`♻️ Berhasil memulihkan ${sessionCount} sesi dari file backup.`, 'success');
    } catch (err) {
      showToast('❌ File backup tidak valid atau rusak.', 'error');
    }
  };

  // Load demo data
  const handleLoadDemo = () => {
    const merged = [...DEMO_SESSIONS];
    sessions.forEach((s) => {
      if (!merged.some((m) => m.id === s.id)) {
        merged.push(s);
      }
    });
    setSessions(merged);
    showToast('✨ 2 Sesi Demo (Line 01 T-Shirt & Line 04 Legging) berhasil dimuat!', 'success');
  };

  // Current session
  const currentSession = sessions.find((s) => s.id === activeSessionId);

  // Template usage map
  const templateUsage = templates.reduce((acc, t) => {
    acc[t.key] = sessions.filter((s) => s.tpl === t.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-900 font-sans antialiased flex flex-col">
      {/* Top Header */}
      <Header sessionCount={sessions.length} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeSessionId && currentSession ? (
          <SessionDetailView
            session={currentSession}
            templates={templates}
            onBack={() => setActiveSessionId(null)}
            onUpdateSession={(updated) => {
              setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            }}
            onDeleteSession={(id) => handleDeleteSessions([id])}
            onExportExcel={(s) => exportSessionToExcel(s, templates)}
          />
        ) : (
          <HomeView
            sessions={sessions}
            templates={templates}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedTemplateFilter={selectedTemplateFilter}
            onTemplateFilterChange={setSelectedTemplateFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            isSelectionMode={isSelectionMode}
            onToggleSelectionMode={() => {
              setIsSelectionMode(!isSelectionMode);
              setSelectedSessionIds([]);
            }}
            selectedSessionIds={selectedSessionIds}
            onToggleSelectSession={(id) => {
              setSelectedSessionIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              );
            }}
            onSelectAllSessions={setSelectedSessionIds}
            onDeleteSessions={handleDeleteSessions}
            onDeleteAllSessions={handleDeleteAllSessions}
            onOpenSession={(id) => setActiveSessionId(id)}
            onTriggerUpload={() => excelFileInputRef.current?.click()}
            onOpenTemplates={() => setIsTemplateModalOpen(true)}
            onBackup={handleBackup}
            onRestore={() => jsonRestoreInputRef.current?.click()}
            onLoadDemo={handleLoadDemo}
          />
        )}
      </main>

      {/* Template Manager Modal */}
      <TemplateManagerModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        templates={templates}
        onUpdateTemplates={setTemplates}
        onTriggerUpload={() => excelFileInputRef.current?.click()}
        sessionUsage={templateUsage}
      />

      {/* In-App Confirmation Modal (Bypasses iFrame sandbox restrictions) */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Hidden File Inputs */}
      <input
        ref={excelFileInputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.csv"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleExcelFiles(e.target.files);
          }
          e.target.value = '';
        }}
      />

      <input
        ref={jsonRestoreInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleRestoreFile(e.target.files[0]);
          }
          e.target.value = '';
        }}
      />

      {/* Toast Notification with Undo */}
      {toast.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs sm:text-sm font-semibold max-w-[92vw] animate-in fade-in slide-in-from-bottom-4 duration-200">
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="truncate">{toast.message}</span>
          {toast.canUndo && (
            <button
              onClick={handleUndoDelete}
              className="ml-2 px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Urungkan
            </button>
          )}
          <button
            onClick={() => setToast({ show: false, message: '' })}
            className="p-1 text-slate-400 hover:text-white rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
