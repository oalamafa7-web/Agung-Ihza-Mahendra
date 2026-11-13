import React, { useMemo } from 'react';
import { Session, SOPTemplate } from '../types';
import { stats, tplOf, fmtD, fmtN, pctTxt, cls } from '../utils/sopUtils';
import {
  Upload,
  Layers,
  Users,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  ArrowUpDown,
  Trash2,
  CheckSquare,
  Square,
  BookOpen,
  Download,
  RotateCcw,
  Sparkles,
  ChevronRight,
  FolderOpen,
  Shirt,
  Calendar,
  Factory,
  FileSpreadsheet,
  Flame,
  Lock,
} from 'lucide-react';

interface HomeViewProps {
  sessions: Session[];
  templates: SOPTemplate[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTemplateFilter: string;
  onTemplateFilterChange: (key: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  isSelectionMode: boolean;
  onToggleSelectionMode: () => void;
  selectedSessionIds: string[];
  onToggleSelectSession: (id: string) => void;
  onSelectAllSessions: (ids: string[]) => void;
  onDeleteSessions: (ids: string[]) => void;
  onDeleteAllSessions?: () => void;
  onOpenSession: (id: string) => void;
  onTriggerUpload: () => void;
  onOpenTemplates: () => void;
  onBackup: () => void;
  onRestore: () => void;
  onLoadDemo: () => void;
  onOpenGoogleSheets?: () => void;
  onOpenFirebase?: () => void;
  isFirebaseSignedIn?: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  sessions,
  templates,
  searchQuery,
  onSearchChange,
  selectedTemplateFilter,
  onTemplateFilterChange,
  sortBy,
  onSortChange,
  isSelectionMode,
  onToggleSelectionMode,
  selectedSessionIds,
  onToggleSelectSession,
  onSelectAllSessions,
  onDeleteSessions,
  onDeleteAllSessions,
  onOpenSession,
  onTriggerUpload,
  onOpenTemplates,
  onBackup,
  onRestore,
  onLoadDemo,
  onOpenGoogleSheets,
  onOpenFirebase,
  isFirebaseSignedIn,
}) => {
  // Compute global stats
  const sessionStats = useMemo(() => {
    return sessions.map((s) => ({
      s,
      st: stats(s, templates),
      t: tplOf(s, templates),
    }));
  }, [sessions, templates]);

  const totalCheckPoints = sessionStats.reduce((acc, x) => acc + x.st.total, 0);
  const totalDoneCheckPoints = sessionStats.reduce((acc, x) => acc + x.st.done, 0);
  const totalOperators = sessionStats.reduce((acc, x) => acc + x.st.opCount, 0);
  const uniqueLinesCount = new Set(sessions.map((s) => s.line)).size;
  const avgCompliance = totalCheckPoints > 0 ? totalDoneCheckPoints / totalCheckPoints : 0;

  // Filtered and sorted sessions
  const filteredSessions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = sessionStats.filter(({ s, t }) => {
      if (selectedTemplateFilter && s.tpl !== selectedTemplateFilter) return false;
      if (!q) return true;
      const searchable = [
        s.factory || '',
        s.line,
        s.file,
        s.style,
        s.date,
        fmtD(s.date),
        t.name,
        s.fileName,
        s.sheet,
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(q);
    });

    if (sortBy === 'factory') {
      result.sort((a, b) => {
        const facCompare = (a.s.factory || 'Factory 1').localeCompare(
          b.s.factory || 'Factory 1',
          'id',
          { numeric: true }
        );
        if (facCompare !== 0) return facCompare;
        return a.s.line.localeCompare(b.s.line, 'id', { numeric: true });
      });
    } else if (sortBy === 'line') {
      result.sort((a, b) => a.s.line.localeCompare(b.s.line, 'id', { numeric: true }));
    } else if (sortBy === 'low') {
      result.sort((a, b) => a.st.pct - b.st.pct);
    } else if (sortBy === 'high') {
      result.sort((a, b) => b.st.pct - a.st.pct);
    } else {
      // Newest first by date or creation time
      result.sort(
        (a, b) =>
          (b.s.date || '').localeCompare(a.s.date || '') || b.s.created - a.s.created
      );
    }

    return result;
  }, [sessionStats, searchQuery, selectedTemplateFilter, sortBy]);

  const allFilteredSelected =
    filteredSessions.length > 0 &&
    filteredSessions.every(({ s }) => selectedSessionIds.includes(s.id));

  const handleSelectAllToggle = () => {
    if (allFilteredSelected) {
      onSelectAllSessions([]);
    } else {
      onSelectAllSessions(filteredSessions.map(({ s }) => s.id));
    }
  };

  const getStatusColor = (pct: number) => {
    const status = cls(pct);
    if (status === 'g') return { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    if (status === 'y') return { bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50 text-amber-800 border-amber-200' };
    return { bg: 'bg-rose-500', text: 'text-rose-700', light: 'bg-rose-50 text-rose-800 border-rose-200' };
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <section className="bg-gradient-to-br from-white via-blue-50/40 to-slate-100 p-6 sm:p-8 rounded-3xl border border-blue-200/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Audit SOP sewing otomatis & terukur
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Performance Assessment SOP
          </h1>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Upload database line Excel harian untuk memetakan kepatuhan operator terhadap SOP teknis garment, menganalisis output per jam, dan mengekspor laporan komprehensif.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {sessions.length === 0 && (
            <button
              onClick={onLoadDemo}
              className="px-4 py-3 rounded-2xl bg-white border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-sm shadow-xs transition flex items-center gap-2 active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Muat Data Contoh
            </button>
          )}

          {onOpenGoogleSheets && (
            <button
              onClick={onOpenGoogleSheets}
              className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg transition flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-5 h-5" />
              Google Sheets
            </button>
          )}

          <button
            onClick={onTriggerUpload}
            className="px-6 py-3 rounded-2xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg transition flex items-center gap-2.5 active:scale-95 cursor-pointer"
          >
            <Upload className="w-5 h-5" />
            Upload File Excel
          </button>
        </div>
      </section>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sessions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Sesi</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FolderOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{sessions.length}</div>
          <div className="text-xs text-slate-500 mt-1">Sesi line terdaftar</div>
        </div>

        {/* Unique Lines */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jumlah Line</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{uniqueLinesCount}</div>
          <div className="text-xs text-slate-500 mt-1">Line sewing aktif</div>
        </div>

        {/* Total Operators */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Operator</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">{fmtN(totalOperators)}</div>
          <div className="text-xs text-slate-500 mt-1">Operator teraudit</div>
        </div>

        {/* Average Compliance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rata-rata Compliance</span>
            <div className={`p-2 rounded-xl ${totalCheckPoints ? getStatusColor(avgCompliance).light : 'bg-slate-50 text-slate-500'}`}>
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl sm:text-3xl font-black mt-2 ${totalCheckPoints ? getStatusColor(avgCompliance).text : 'text-slate-400'}`}>
            {totalCheckPoints ? pctTxt(avgCompliance) : '-'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {fmtN(totalDoneCheckPoints)} / {fmtN(totalCheckPoints)} poin tercapai
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari berdasarkan line, nomor file, style, tanggal..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Template Filter */}
          <div className="relative flex items-center">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <select
              value={selectedTemplateFilter}
              onChange={(e) => onTemplateFilterChange(e.target.value)}
              className="pl-8 pr-8 py-2 text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 appearance-none cursor-pointer"
            >
              <option value="">Semua Template Produk</option>
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort selector */}
          <div className="relative flex items-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="pl-8 pr-8 py-2 text-xs sm:text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 appearance-none cursor-pointer"
            >
              <option value="new">Tanggal Terbaru</option>
              <option value="factory">Factory (A-Z)</option>
              <option value="line">Nama Line (A-Z)</option>
              <option value="low">Compliance Terendah</option>
              <option value="high">Compliance Tertinggi</option>
            </select>
          </div>

          {/* Selection mode toggle */}
          {sessions.length > 0 && (
            <button
              onClick={onToggleSelectionMode}
              className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition ${
                isSelectionMode
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {isSelectionMode ? 'Selesai Pilih' : 'Pilih Banyak'}
            </button>
          )}

          {/* Delete all sessions quick button */}
          {onDeleteAllSessions && sessions.length > 0 && !isSelectionMode && (
            <button
              onClick={onDeleteAllSessions}
              className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition flex items-center gap-1.5"
              title="Hapus seluruh sesi"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hapus Semua</span>
            </button>
          )}
        </div>
      </div>

      {/* Batch selection sticky bar */}
      {isSelectionMode && (
        <div className="sticky top-20 z-30 bg-blue-50 border-2 border-blue-400 p-3 sm:p-4 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-700" />
            <span className="font-extrabold text-blue-950 text-sm sm:text-base">
              {selectedSessionIds.length} Sesi Terpilih
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllToggle}
              className="px-3 py-1.5 rounded-lg bg-white border border-blue-300 text-blue-900 hover:bg-blue-100 font-bold text-xs"
            >
              {allFilteredSelected ? 'Batal Pilih Semua' : `Pilih Semua (${filteredSessions.length})`}
            </button>
            <button
              onClick={() => onDeleteSessions(selectedSessionIds)}
              disabled={selectedSessionIds.length === 0}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus ({selectedSessionIds.length})
            </button>
            <button
              onClick={onToggleSelectionMode}
              className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-2xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-bold text-slate-900 text-lg">
              {sessions.length > 0 ? 'Tidak Ada Sesi yang Cocok' : 'Belum Ada Sesi Audit Line'}
            </h3>
            <p className="text-slate-500 text-xs sm:text-sm">
              {sessions.length > 0
                ? 'Coba sesuaikan kata kunci pencarian atau ganti filter template produk.'
                : 'Upload file Excel laporan line harian atau muat data contoh untuk memulai.'}
            </p>
          </div>
          {sessions.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={onLoadDemo}
                className="px-5 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-bold text-xs sm:text-sm flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Muat 2 Data Contoh (T-Shirt & Legging)
              </button>
              <button
                onClick={onTriggerUpload}
                className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload File Excel
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map(({ s, st, t }) => {
            const isPicked = selectedSessionIds.includes(s.id);
            const statusConfig = getStatusColor(st.pct);

            return (
              <div
                key={s.id}
                onClick={() => {
                  if (isSelectionMode) {
                    onToggleSelectSession(s.id);
                  } else {
                    onOpenSession(s.id);
                  }
                }}
                className={`group bg-white rounded-2xl p-5 border-2 transition-all cursor-pointer shadow-xs hover:shadow-md relative overflow-hidden flex flex-col justify-between ${
                  isPicked
                    ? 'border-blue-600 bg-blue-50/40'
                    : 'border-slate-200 hover:border-blue-400'
                }`}
              >
                {/* Top border indicator */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${statusConfig.bg}`}
                />

                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pt-1">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200/90 flex items-center gap-1">
                          <Factory className="w-3 h-3 text-blue-600" />
                          {s.factory || 'Factory 1'}
                        </span>
                        <span className="text-2xl font-black text-slate-900 tracking-tight group-hover:text-blue-700 transition">
                          {s.line}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{fmtD(s.date)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                        {t.name}
                      </span>

                      {isSelectionMode ? (
                        <div className="text-blue-700 p-1">
                          {isPicked ? (
                            <CheckSquare className="w-5 h-5 fill-blue-600 text-white" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSessions([s.id]);
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-xl transition flex items-center gap-1 shadow-2xs"
                          title="Hapus sesi ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {s.file && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px]">
                        PO: {s.file}
                      </span>
                    )}
                    {s.style && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] flex items-center gap-1">
                        <Shirt className="w-3 h-3 text-slate-400" />
                        {s.style}
                      </span>
                    )}
                    {s.ownerId && (
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 ${
                          s.isShared
                            ? 'bg-orange-50 text-orange-800 border border-orange-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.isShared ? (
                          <>
                            <Users className="w-3 h-3" />
                            Tim
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" />
                            Pribadi
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 flex items-center justify-between">
                    <span>{st.opCount} operator</span>
                    <span>{st.procCount} proses SOP</span>
                  </div>

                  {/* Progress Bar & Percentage */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600">Compliance SOP</span>
                      <span className={statusConfig.text}>{pctTxt(st.pct)}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${statusConfig.bg}`}
                        style={{ width: `${Math.min(100, Math.max(2, st.pct * 100))}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 flex justify-between">
                      <span>☑ {fmtN(st.done)} tercapai</span>
                      <span>☐ {fmtN(st.pending)} belum</span>
                    </div>
                  </div>
                </div>

                {/* Card footer CTA */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-700 group-hover:translate-x-0.5 transition">
                  <span>Buka Lembar Audit</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Bar: Templates & Backup/Restore */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
        <div className="flex flex-wrap items-center gap-2">
          {onOpenFirebase && (
            <button
              onClick={onOpenFirebase}
              className="px-4 py-2.5 rounded-xl bg-white border border-orange-300 hover:bg-orange-50 font-semibold text-slate-800 flex items-center gap-2 shadow-2xs transition cursor-pointer"
              title="Kelola login Google & sinkronisasi Cloud Firestore"
            >
              <Flame className={`w-4 h-4 ${isFirebaseSignedIn ? 'text-orange-600' : 'text-slate-400'}`} />
              Firebase Firestore
            </button>
          )}
          <button
            onClick={onOpenTemplates}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 flex items-center gap-2 shadow-2xs transition cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            Kelola Template SOP ({templates.length})
          </button>
          {sessions.length > 0 && (
            <button
              onClick={onLoadDemo}
              className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs transition hidden sm:flex"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              Tambah Data Demo
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackup}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 flex items-center gap-2 shadow-2xs transition"
            title="Download cadangan data lengkap sesi & template"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Backup Data (.json)
          </button>
          <button
            onClick={onRestore}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-800 flex items-center gap-2 shadow-2xs transition"
            title="Pulihkan data sesi & template dari file JSON"
          >
            <RotateCcw className="w-4 h-4 text-slate-600" />
            Restore Data
          </button>
        </div>
      </div>
    </div>
  );
};
