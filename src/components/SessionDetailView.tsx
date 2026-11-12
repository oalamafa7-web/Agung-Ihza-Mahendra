import React, { useState, useMemo } from 'react';
import { Session, SOPTemplate } from '../types';
import {
  stats,
  tplOf,
  sopOps,
  cleanT,
  fmtD,
  fmtN,
  pctTxt,
  cls,
  key,
  norm,
  procs,
} from '../utils/sopUtils';
import {
  ArrowLeft,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  Clock,
  Shirt,
  Calendar,
  Factory,
  AlertTriangle,
  RotateCcw,
  Eye,
  EyeOff,
  UserCheck,
  CheckSquare,
  Square,
  BarChart3,
  ListChecks,
  Table as TableIcon,
  Search,
  ExternalLink,
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

interface SessionDetailViewProps {
  session: Session;
  templates: SOPTemplate[];
  onBack: () => void;
  onUpdateSession: (updated: Session) => void;
  onDeleteSession: (id: string) => void;
  onExportExcel: (session: Session) => void;
}

export const SessionDetailView: React.FC<SessionDetailViewProps> = ({
  session,
  templates,
  onBack,
  onUpdateSession,
  onDeleteSession,
  onExportExcel,
}) => {
  const [activeTab, setActiveTab] = useState<'dash' | 'check' | 'out' | 'data'>('dash');
  const [showAllBlocks, setShowAllBlocks] = useState<boolean>(false);
  const [dataSearch, setDataSearch] = useState<string>('');

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
    onConfirm: () => {},
  });

  const currentTemplate = useMemo(() => tplOf(session, templates), [session, templates]);
  const currentStats = useMemo(() => stats(session, templates), [session, templates]);
  const databaseProcesses = useMemo(() => procs(session), [session]);

  const getStatusColor = (pct: number) => {
    const status = cls(pct);
    if (status === 'g') return { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    if (status === 'y') return { bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50 text-amber-800 border-amber-200' };
    return { bg: 'bg-rose-500', text: 'text-rose-700', light: 'bg-rose-50 text-rose-800 border-rose-200' };
  };

  const getPicBadge = (pic: string) => {
    const p = norm(pic);
    if (p.includes('pso')) return 'bg-amber-100 text-amber-900 border-amber-300';
    if (p.includes('ie')) return 'bg-blue-100 text-blue-900 border-blue-300';
    if (p.includes('qc')) return 'bg-pink-100 text-pink-900 border-pink-300';
    if (p.includes('mekanik') || p.includes('mech')) return 'bg-indigo-100 text-indigo-900 border-indigo-300';
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  // Toggle single cell
  const handleToggleCheck = (bi: number, ii: number, name: string) => {
    const k = key(bi, ii, name);
    const updatedChecks = { ...session.checks };
    if (updatedChecks[k]) {
      delete updatedChecks[k];
    } else {
      updatedChecks[k] = 1;
    }
    onUpdateSession({ ...session, checks: updatedChecks });
  };

  // Batch toggle all checkpoints for one operator in a block
  const handleToggleOperatorAll = (bi: number, name: string) => {
    const block = currentTemplate.blocks[bi];
    if (!block) return;
    const itemKeys = block.i.map((_, ii) => key(bi, ii, name));
    const allChecked = itemKeys.every((k) => session.checks[k]);
    const updatedChecks = { ...session.checks };

    itemKeys.forEach((k) => {
      if (allChecked) {
        delete updatedChecks[k];
      } else {
        updatedChecks[k] = 1;
      }
    });

    onUpdateSession({ ...session, checks: updatedChecks });
  };

  // Batch toggle all operators for one checkpoint row
  const handleToggleRowAll = (bi: number, ii: number) => {
    const blockStat = currentStats.blocks[bi];
    if (!blockStat) return;
    const rowKeys = blockStat.ops.map((name) => key(bi, ii, name));
    const allChecked = rowKeys.every((k) => session.checks[k]);
    const updatedChecks = { ...session.checks };

    rowKeys.forEach((k) => {
      if (allChecked) {
        delete updatedChecks[k];
      } else {
        updatedChecks[k] = 1;
      }
    });

    onUpdateSession({ ...session, checks: updatedChecks });
  };

  // Batch toggle all for entire block
  const handleToggleBlockAll = (bi: number) => {
    const blockStat = currentStats.blocks[bi];
    if (!blockStat) return;
    const allKeys: string[] = [];
    blockStat.ops.forEach((n) => {
      blockStat.b.i.forEach((_, ii) => {
        allKeys.push(key(bi, ii, n));
      });
    });

    const allChecked = allKeys.every((k) => session.checks[k]);
    const updatedChecks = { ...session.checks };

    allKeys.forEach((k) => {
      if (allChecked) {
        delete updatedChecks[k];
      } else {
        updatedChecks[k] = 1;
      }
    });

    onUpdateSession({ ...session, checks: updatedChecks });
  };

  // Reset all checks in current session
  const handleResetSessionChecks = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Checklist Sesi?',
      message: 'Reset semua centang SOP di sesi ini? Seluruh data checklist akan dikosongkan.',
      confirmLabel: 'Ya, Reset',
      isDestructive: true,
      onConfirm: () => onUpdateSession({ ...session, checks: {} }),
    });
  };

  // Process Mapping change
  const handleProcessMapChange = (bi: number, mappedProcess: string) => {
    const updatedMap = { ...(session.map || {}) };
    updatedMap[bi] = mappedProcess;

    // Clear checks for this block as operators will change
    const updatedChecks = { ...session.checks };
    Object.keys(updatedChecks).forEach((k) => {
      if (k.startsWith(`${bi}|`)) {
        delete updatedChecks[k];
      }
    });

    onUpdateSession({ ...session, map: updatedMap, checks: updatedChecks });
  };

  // Block Start Date change
  const handleBlockDateChange = (bi: number, dateVal: string) => {
    const updatedBDate = { ...(session.bdate || {}) };
    updatedBDate[bi] = dateVal;
    onUpdateSession({ ...session, bdate: updatedBDate });
  };

  // Template switch
  const handleTemplateChange = (newTplKey: string) => {
    if (Object.keys(session.checks).length > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Ganti Template SOP?',
        message: 'Mengganti template SOP akan mereset checklist penilaian sesi ini karena daftar proses berbeda. Anda yakin ingin melanjutkan?',
        confirmLabel: 'Ganti Template',
        isDestructive: true,
        onConfirm: () => {
          onUpdateSession({
            ...session,
            tpl: newTplKey,
            map: {},
            checks: {},
            bdate: {},
          });
        },
      });
      return;
    }
    onUpdateSession({
      ...session,
      tpl: newTplKey,
      map: {},
      checks: {},
      bdate: {},
    });
  };

  // Jump to block in checklist
  const handleJumpToBlock = (bi: number) => {
    setActiveTab('check');
    setTimeout(() => {
      const el = document.getElementById(`blk-${bi}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Calculations for Output tab
  const activeOps = useMemo(() => sopOps(session, currentStats), [session, currentStats]);

  const processOutputSummary = useMemo(() => {
    const groups: Record<string, { ops: Set<string>; target: number; actual: number }> = {};
    activeOps.forEach((o) => {
      if (!groups[o.process]) {
        groups[o.process] = { ops: new Set(), target: 0, actual: 0 };
      }
      groups[o.process].ops.add(o.name);
      groups[o.process].target += o.target || 0;
      groups[o.process].actual += o.actual || 0;
    });
    return groups;
  }, [activeOps]);

  const hourlyChartData = useMemo(() => {
    if (!session.hours || session.hours.length === 0) return [];
    return session.hours.map((label, colIdx) => {
      const total = activeOps.reduce((sum, o) => sum + (o.h[colIdx] || 0), 0);
      return { label, value: total };
    });
  }, [session.hours, activeOps]);

  const maxHourlyValue = useMemo(() => {
    return Math.max(1, ...hourlyChartData.map((d) => d.value));
  }, [hourlyChartData]);

  // PIC compliance stats
  const picStats = useMemo(() => {
    const picData: Record<string, { tot: number; done: number }> = {};
    currentStats.active.forEach((blockStat) => {
      blockStat.b.i.forEach(([_, pic], ii) => {
        const k = pic || 'Lainnya';
        if (!picData[k]) picData[k] = { tot: 0, done: 0 };
        blockStat.ops.forEach((n) => {
          picData[k].tot++;
          if (session.checks[key(blockStat.bi, ii, n)]) {
            picData[k].done++;
          }
        });
      });
    });
    return picData;
  }, [currentStats.active, session.checks]);

  // Filtered raw data
  const filteredRawOps = useMemo(() => {
    const q = dataSearch.toLowerCase().trim();
    if (!q) return activeOps;
    return activeOps.filter((o) =>
      [o.seq, o.process, o.machine, o.counter, o.mc, o.uid, o.name].join(' ').toLowerCase().includes(q)
    );
  }, [activeOps, dataSearch]);

  const blocksToRender = showAllBlocks ? currentStats.blocks : currentStats.active;
  const unmappedCount = currentStats.blocks.length - currentStats.active.length;

  return (
    <div className="space-y-6">
      {/* Session Top Header Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold transition flex items-center gap-1.5 text-xs sm:text-sm active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Daftar Sesi</span>
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Manual Factory Input Field */}
                <div className="inline-flex items-center bg-slate-100 hover:bg-slate-200/80 border border-slate-300 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 rounded-xl px-2.5 py-1 transition shadow-2xs">
                  <Factory className="w-4 h-4 text-blue-700 mr-1.5 shrink-0" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mr-1">
                    Factory:
                  </span>
                  <input
                    type="text"
                    list="factory-presets-detail"
                    placeholder="Factory 1"
                    value={session.factory ?? 'Factory 1'}
                    onChange={(e) => onUpdateSession({ ...session, factory: e.target.value })}
                    className="font-bold text-slate-900 text-xs sm:text-sm bg-transparent focus:outline-none w-24 sm:w-28"
                    title="Edit nama Factory manual (misal: Factory 1, Factory 2, Plant A)"
                  />
                  <datalist id="factory-presets-detail">
                    <option value="Factory 1" />
                    <option value="Factory 2" />
                    <option value="Factory 3" />
                    <option value="Factory 4" />
                    <option value="Factory A" />
                    <option value="Factory B" />
                  </datalist>
                </div>

                {/* Line number with inline edit */}
                <div className="inline-flex items-center gap-1.5">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Line
                  </span>
                  <input
                    type="text"
                    value={session.line}
                    onChange={(e) => onUpdateSession({ ...session, line: e.target.value })}
                    className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight bg-transparent border-b-2 border-dashed border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:bg-white px-1.5 py-0 w-24 sm:w-28 rounded transition focus:outline-none"
                    title="Ubah nomor/nama Line manual"
                  />
                </div>

                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                  {currentTemplate.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                {session.file && <span>PO: <b>{session.file}</b></span>}
                {session.style && <span>• Style: <b>{session.style}</b></span>}
                <span>• File: {session.fileName} ({session.sheet})</span>
              </div>
            </div>
          </div>

          {/* Quick Session Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date input */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="date"
                value={session.date}
                onChange={(e) => onUpdateSession({ ...session, date: e.target.value })}
                className="bg-transparent focus:outline-none cursor-pointer"
              />
            </div>

            {/* Template Selector */}
            <select
              value={session.tpl}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  SOP: {t.name}
                </option>
              ))}
            </select>

            {/* Export Excel */}
            <button
              onClick={() => onExportExcel(session)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
              title="Download Hasil Audit ke format Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>

            {/* Delete Session */}
            <button
              onClick={() => onDeleteSession(session.id)}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition"
              title="Hapus sesi ini"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 sm:space-x-2 border-b border-slate-200 pt-2 overflow-x-auto">
          {[
            { id: 'dash', label: 'Dashboard Analitik', icon: BarChart3 },
            { id: 'check', label: 'Lembar Checklist SOP', icon: ListChecks },
            { id: 'out', label: 'Output & Produksi', icon: Clock },
            { id: 'data', label: 'Data Database', icon: TableIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-t-xl flex items-center gap-2 transition cursor-pointer border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-blue-50/60'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT */}

      {/* 1. DASHBOARD */}
      {activeTab === 'dash' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Operator</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{currentStats.opCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">di line produksi</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Proses SOP</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{currentStats.procCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">proses aktif</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Check Point</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{fmtN(currentStats.total)}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">standar audit</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase">Sudah Sesuai (☑)</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{fmtN(currentStats.done)}</div>
              <div className="text-[11px] text-emerald-700 mt-0.5">poin centang</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-rose-500 uppercase">Belum (☐)</span>
              <div className="text-2xl font-black text-rose-600 mt-1">{fmtN(currentStats.pending)}</div>
              <div className="text-[11px] text-rose-600 mt-0.5">poin tersisa</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">% Compliance</span>
              <div className={`text-2xl font-black mt-1 ${getStatusColor(currentStats.pct).text}`}>
                {pctTxt(currentStats.pct)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">rata-rata line</div>
            </div>
          </div>

          {/* Compliance per Process & Compliance per PIC */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Process compliance */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Compliance per Proses SOP</h3>
                <span className="text-xs text-slate-400">Klik untuk lompat ke checklist</span>
              </div>

              {currentStats.active.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic">
                  Belum ada proses yang cocok dengan SOP <b>{currentTemplate.name}</b>. Silakan periksa tab Checklist untuk menghubungkan nama proses database.
                </div>
              ) : (
                <div className="space-y-3">
                  {currentStats.active.map((x) => {
                    const status = getStatusColor(x.pct);
                    return (
                      <div
                        key={x.bi}
                        onClick={() => handleJumpToBlock(x.bi)}
                        className="group p-2.5 rounded-xl hover:bg-slate-50 transition cursor-pointer space-y-1.5 border border-transparent hover:border-slate-200"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 group-hover:text-blue-700 flex items-center gap-1.5">
                            <span className="text-slate-400 font-mono">{x.bi + 1}.</span>
                            {cleanT(x.b.t)}
                          </span>
                          <span className={`font-bold ${status.text}`}>
                            {pctTxt(x.pct)}{' '}
                            <span className="text-[11px] text-slate-400 font-normal">
                              ({x.done}/{x.tot})
                            </span>
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${status.bg}`}
                            style={{ width: `${Math.min(100, Math.max(3, x.pct * 100))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* PIC Compliance Breakdown */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Compliance per PIC Divisi</h3>
                <span className="text-xs text-slate-400">PSO • IE • QC • Mekanik</span>
              </div>

              <div className="space-y-3">
                {Object.entries(picStats).map(([pic, data]) => {
                  const pct = data.tot ? data.done / data.tot : 0;
                  const status = getStatusColor(pct);
                  return (
                    <div key={pic} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-bold border text-[11px] ${getPicBadge(pic)}`}>
                          {pic}
                        </span>
                        <span className={`font-bold ${status.text}`}>
                          {pctTxt(pct)}{' '}
                          <span className="text-[11px] text-slate-400 font-normal">
                            ({data.done}/{data.tot})
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${status.bg}`}
                          style={{ width: `${Math.min(100, Math.max(3, pct * 100))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  <b>Standar Evaluasi:</b> Hijau (≥90% kepatuhan), Kuning (60%–89%), Merah (&lt;60% memerlukan tindak lanjut pelatihan operator).
                </p>
              </div>
            </div>
          </div>

          {/* Compliance per Operator (ranked from lowest to highest) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Peringkat Kepatuhan per Operator</h3>
                <p className="text-xs text-slate-400">Diurutkan dari compliance terendah ke tertinggi</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {currentStats.per.length} Operator
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...currentStats.per]
                .sort((a, b) => a.done / (a.tot || 1) - b.done / (b.tot || 1))
                .map((op, idx) => {
                  const pct = op.tot ? op.done / op.tot : 0;
                  const status = getStatusColor(pct);
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition space-y-1.5 bg-slate-50/50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs sm:text-sm text-slate-900">{op.name}</div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {op.proc.join(', ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-extrabold text-xs sm:text-sm ${status.text}`}>
                            {pctTxt(pct)}
                          </span>
                          <div className="text-[10px] text-slate-400">
                            {op.done}/{op.tot} poin
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${status.bg}`}
                          style={{ width: `${Math.min(100, Math.max(3, pct * 100))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* 2. CHECKLIST */}
      {activeTab === 'check' && (
        <div className="space-y-6">
          {/* Quick jump chips bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Navigasi Cepat Proses SOP
              </span>
              <div className="flex items-center gap-2">
                {unmappedCount > 0 && (
                  <button
                    onClick={() => setShowAllBlocks(!showAllBlocks)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs flex items-center gap-1.5 transition"
                  >
                    {showAllBlocks ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showAllBlocks ? 'Sembunyikan Unmapped' : `Atur Mapping (${unmappedCount})`}</span>
                  </button>
                )}
                <button
                  onClick={handleResetSessionChecks}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Centang</span>
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {blocksToRender.map((x) => {
                const status = x.tot ? cls(x.pct) : 'n';
                const dotColor =
                  status === 'g'
                    ? 'bg-emerald-500'
                    : status === 'y'
                    ? 'bg-amber-500'
                    : status === 'r'
                    ? 'bg-rose-500'
                    : 'bg-slate-300';
                return (
                  <button
                    key={x.bi}
                    onClick={() => handleJumpToBlock(x.bi)}
                    className="px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 whitespace-nowrap flex items-center gap-1.5 transition shrink-0"
                  >
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span>
                      {x.bi + 1}. {cleanT(x.b.t).split(' - ')[0].slice(0, 24)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guidance Callout */}
          <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-blue-700 shrink-0" />
              <span>
                <b>Tips Audit:</b> Ketuk <b>kotak checkbox</b> untuk checklist individual • Ketuk <b>nama operator</b> di kolom atas untuk centang semua poin operator • Ketuk <b>nomor</b> baris untuk centang semua operator di poin itu.
              </span>
            </div>
          </div>

          {/* List of Blocks */}
          {blocksToRender.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs sm:text-sm">
              Tidak ada proses yang cocok. Klik tombol "Atur Mapping" di atas untuk menghubungkan nama proses SOP ke proses di database.
            </div>
          ) : (
            blocksToRender.map((x) => {
              const status = getStatusColor(x.pct);
              return (
                <div
                  key={x.bi}
                  id={`blk-${x.bi}`}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden scroll-mt-28"
                >
                  {/* Block Header */}
                  <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-700 text-white font-black text-xs flex items-center justify-center">
                          {x.bi + 1}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                          {cleanT(x.b.t)}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        {/* Process Mapping Selector */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">Link Database:</span>
                          <select
                            value={x.p || ''}
                            onChange={(e) => handleProcessMapChange(x.bi, e.target.value)}
                            className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600 max-w-[260px]"
                          >
                            <option value="">— Tidak Terhubung —</option>
                            {databaseProcesses.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Start Date */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">Tgl Mulai:</span>
                          <input
                            type="date"
                            value={(session.bdate || {})[x.bi] || ''}
                            onChange={(e) => handleBlockDateChange(x.bi, e.target.value)}
                            className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-600"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Block Summary Stat & Action */}
                    <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0">
                      <div className="text-right">
                        <div className={`text-xl font-black ${status.text}`}>
                          {x.tot > 0 ? pctTxt(x.pct) : '-'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {x.done}/{x.tot} check • {x.ops.length} operator
                        </div>
                      </div>

                      {x.ops.length > 0 && (
                        <button
                          onClick={() => handleToggleBlockAll(x.bi)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-bold text-xs text-slate-700 transition"
                        >
                          Check Semua
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Checklist Matrix Table */}
                  {x.ops.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 italic bg-white">
                      Belum ada operator terhubung. Pilih proses database di atas untuk memetakan operator ke proses SOP ini.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900 text-white">
                            <th className="sticky left-0 z-20 bg-slate-900 w-12 px-3 py-2.5 text-center font-bold border-r border-slate-800">
                              No
                            </th>
                            <th className="sticky left-12 z-20 bg-slate-900 min-w-[280px] sm:min-w-[340px] px-3.5 py-2.5 font-bold border-r border-slate-800">
                              Standar SOP & Check Point
                            </th>
                            <th className="w-20 px-3 py-2.5 text-center font-bold border-r border-slate-800">
                              PIC
                            </th>
                            {x.ops.map((name) => (
                              <th
                                key={name}
                                onClick={() => handleToggleOperatorAll(x.bi, name)}
                                className="min-w-[120px] max-w-[160px] px-3 py-2.5 text-center font-bold hover:bg-slate-800 cursor-pointer transition select-none border-r border-slate-800 group"
                                title="Klik untuk centang / batal semua untuk operator ini"
                              >
                                <div className="truncate font-bold text-white group-hover:text-blue-300">
                                  {name}
                                </div>
                                <span className="text-[10px] text-slate-400 group-hover:text-blue-300 font-normal">
                                  (klik batch)
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200">
                          {x.b.i.map(([instruction, pic], ii) => (
                            <tr key={ii} className="hover:bg-blue-50/30 transition">
                              {/* Row number (click to check all for row) */}
                              <td
                                onClick={() => handleToggleRowAll(x.bi, ii)}
                                className="sticky left-0 z-10 bg-white hover:bg-blue-100/60 font-bold text-slate-600 text-center px-3 py-2 border-r border-slate-200 cursor-pointer select-none transition"
                                title="Klik untuk centang / batal semua operator di baris ini"
                              >
                                {ii + 1}
                              </td>

                              {/* Instruction text */}
                              <td className="sticky left-12 z-10 bg-white font-medium text-slate-800 px-3.5 py-2 border-r border-slate-200">
                                {instruction}
                              </td>

                              {/* PIC badge */}
                              <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${getPicBadge(pic)}`}>
                                  {pic}
                                </span>
                              </td>

                              {/* Operator Checkbox Cells */}
                              {x.ops.map((name) => {
                                const isChecked = !!session.checks[key(x.bi, ii, name)];
                                return (
                                  <td
                                    key={name}
                                    onClick={() => handleToggleCheck(x.bi, ii, name)}
                                    className={`px-3 py-2 text-center cursor-pointer select-none transition border-r border-slate-200 ${
                                      isChecked
                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-center">
                                      {isChecked ? (
                                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                                      ) : (
                                        <Square className="w-5 h-5 text-slate-300" />
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>

                        {/* Footer with Operator % Compliance */}
                        <tfoot>
                          <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-700">
                            <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-center border-r border-slate-200">
                              #
                            </td>
                            <td className="sticky left-12 z-10 bg-slate-100 px-3.5 py-2 border-r border-slate-200">
                              % Compliance per Operator
                            </td>
                            <td className="px-3 py-2 text-center border-r border-slate-200">-</td>
                            {x.ops.map((name) => {
                              const doneCount = x.b.i.filter((_, ii) => session.checks[key(x.bi, ii, name)]).length;
                              const pct = x.b.i.length ? doneCount / x.b.i.length : 0;
                              const stat = getStatusColor(pct);
                              return (
                                <td
                                  key={name}
                                  className={`px-3 py-2 text-center border-r border-slate-200 font-extrabold ${stat.text}`}
                                >
                                  {pctTxt(pct)}
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. OUTPUT & PRODUCTION */}
      {activeTab === 'out' && (
        <div className="space-y-6">
          {/* Hourly Production Bar Chart */}
          {hourlyChartData.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Output per Jam (Proses SOP)</h3>
                  <p className="text-xs text-slate-400">Total produksi seluruh operator proses SOP per jam kerja</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800">
                  {fmtN(hourlyChartData.reduce((acc, h) => acc + h.value, 0))} Pcs Total
                </span>
              </div>

              <div className="h-56 pt-6 flex items-end gap-2 sm:gap-4 overflow-x-auto pb-2">
                {hourlyChartData.map((h, i) => {
                  const barHeight = Math.max(6, (h.value / maxHourlyValue) * 100);
                  return (
                    <div key={i} className="flex-1 min-w-[50px] flex flex-col items-center justify-end h-full">
                      <span className="text-[11px] font-bold text-slate-800 mb-1">
                        {fmtN(h.value)}
                      </span>
                      <div className="w-full bg-slate-100 rounded-t-lg overflow-hidden h-full flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-blue-700 to-blue-500 rounded-t-lg transition-all duration-500 shadow-xs"
                          style={{ height: `${barHeight}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-2 text-center font-mono whitespace-nowrap">
                        {h.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Process Summary Table */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Ringkasan Output per Proses</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="px-3.5 py-2.5">Proses Database</th>
                    <th className="px-3.5 py-2.5 text-right">Operator</th>
                    <th className="px-3.5 py-2.5 text-right">Target Qty</th>
                    <th className="px-3.5 py-2.5 text-right">Actual Qty</th>
                    <th className="px-3.5 py-2.5 text-right">Pencapaian (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(processOutputSummary).map(([procName, data], idx) => {
                    const achv = data.target > 0 ? data.actual / data.target : 0;
                    const status = getStatusColor(achv);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3.5 py-2.5 font-semibold text-slate-900">{procName}</td>
                        <td className="px-3.5 py-2.5 text-right">{data.ops.size}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono">{fmtN(data.target)}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold">{fmtN(data.actual)}</td>
                        <td className={`px-3.5 py-2.5 text-right font-bold ${status.text}`}>
                          {data.target > 0 ? pctTxt(achv) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operator Output Table */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Output per Operator Individual</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="px-3 py-2.5">Counter</th>
                    <th className="px-3.5 py-2.5">Nama Operator</th>
                    <th className="px-3.5 py-2.5">Proses</th>
                    <th className="px-3 py-2.5">Mesin</th>
                    <th className="px-3 py-2.5 text-right">Target</th>
                    <th className="px-3 py-2.5 text-right">Actual</th>
                    <th className="px-3 py-2.5 text-right">Achievement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeOps.map((op, idx) => {
                    const achv = (op.target || 0) > 0 ? (op.actual || 0) / (op.target || 1) : 0;
                    const status = getStatusColor(achv);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-slate-500">{op.counter || '-'}</td>
                        <td className="px-3.5 py-2 font-bold text-slate-900">{op.name}</td>
                        <td className="px-3.5 py-2 text-slate-700">{op.process}</td>
                        <td className="px-3 py-2 text-slate-600">{op.machine}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtN(op.target)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{fmtN(op.actual)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${status.text}`}>
                          {(op.target || 0) > 0 ? pctTxt(achv) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. RAW DATABASE */}
      {activeTab === 'data' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <h3 className="font-bold text-slate-900 text-sm">Data Mentah Line Sewing (Excel Source)</h3>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari operator, proses, mesin, NIK..."
                value={dataSearch}
                onChange={(e) => setDataSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900 text-white font-bold">
                <tr>
                  <th className="px-3 py-2.5">Seq</th>
                  <th className="px-3 py-2.5">Proses</th>
                  <th className="px-3 py-2.5">Mesin</th>
                  <th className="px-3 py-2.5">Counter</th>
                  <th className="px-3 py-2.5">MC Code</th>
                  <th className="px-3 py-2.5">User ID</th>
                  <th className="px-3 py-2.5">Nama Operator</th>
                  <th className="px-3 py-2.5 text-right">Target</th>
                  <th className="px-3 py-2.5 text-right">Actual</th>
                  <th className="px-3 py-2.5 text-right">Avg</th>
                  <th className="px-3 py-2.5 text-right">WT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRawOps.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-6 text-center text-slate-400 italic">
                      Tidak ada baris yang sesuai dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredRawOps.map((op, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-slate-400">{op.seq || idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{op.process}</td>
                      <td className="px-3 py-2 text-slate-600">{op.machine}</td>
                      <td className="px-3 py-2 font-mono text-slate-600">{op.counter || '-'}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{op.mc || '-'}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{op.uid || '-'}</td>
                      <td className="px-3 py-2 font-bold text-slate-900">{op.name}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtN(op.target)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-blue-700">{fmtN(op.actual)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtN(op.avg)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtN(op.wt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
