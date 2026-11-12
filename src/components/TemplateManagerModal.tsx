import React, { useState } from 'react';
import { SOPTemplate, SOPBlock, SOPItem } from '../types';
import { cleanT, norm } from '../utils/sopUtils';
import { BUILTIN_TEMPLATES } from '../data/builtinTemplates';
import {
  X,
  BookOpen,
  Plus,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  CheckCircle2,
  Info,
  AlertCircle,
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: SOPTemplate[];
  onUpdateTemplates: (templates: SOPTemplate[]) => void;
  onTriggerUpload: () => void;
  sessionUsage: Record<string, number>;
}

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  isOpen,
  onClose,
  templates,
  onUpdateTemplates,
  onTriggerUpload,
  sessionUsage,
}) => {
  const [expandedKey, setExpandedKey] = useState<string | null>(templates[0]?.key || null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // Form state for creating custom template
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newBlocks, setNewBlocks] = useState<{ title: string; mapping: string; itemsText: string }[]>([
    {
      title: 'Heat Seal Label - HTL',
      mapping: 'Heat transfer main-label(HT main label)',
      itemsText:
        'Standard waktu 8 detik, Suhu 165%, Pressure Gap 2 Kg | PSO\nCold feel : copot saat dingin dan Hot Feel : dicopot saat masih panas | PSO\nLabel selalu dipegang ditangan kiri | IE',
    },
  ]);

  const [formError, setFormError] = useState<string>('');
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

  if (!isOpen) return null;

  const handleToggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const handleDeleteTemplate = (key: string, name: string) => {
    const usage = sessionUsage[key] || 0;
    const message =
      usage > 0
        ? `Template "${name}" saat ini sedang digunakan oleh ${usage} sesi. Yakin ingin menghapus?`
        : `Apakah Anda yakin ingin menghapus template "${name}"?`;

    setConfirmModal({
      isOpen: true,
      title: `Hapus Template ${name}?`,
      message,
      confirmLabel: 'Hapus Template',
      isDestructive: true,
      onConfirm: () => onUpdateTemplates(templates.filter((t) => t.key !== key)),
    });
  };

  const handleResetBuiltin = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Template ke Standar Pabrik?',
      message: 'Kembalikan template T-Shirt & Legging ke versi bawaan standar pabrik?',
      confirmLabel: 'Ya, Reset',
      isDestructive: false,
      onConfirm: () => {
        const updated = [...templates];
        BUILTIN_TEMPLATES.forEach((builtin) => {
          const idx = updated.findIndex((t) => norm(t.name) === norm(builtin.name));
          if (idx >= 0) {
            updated[idx] = { ...JSON.parse(JSON.stringify(builtin)), key: updated[idx].key };
          } else {
            updated.push(JSON.parse(JSON.stringify(builtin)));
          }
        });
        onUpdateTemplates(updated);
      },
    });
  };

  const handleAddBlockField = () => {
    setNewBlocks((prev) => [
      ...prev,
      {
        title: '',
        mapping: '',
        itemsText: 'Item checkpoint 1 | IE\nItem checkpoint 2 | PSO',
      },
    ]);
  };

  const handleRemoveBlockField = (index: number) => {
    setNewBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveNewTemplate = () => {
    setFormError('');
    if (!newTemplateName.trim()) {
      setFormError('Mohon masukkan nama produk/template.');
      return;
    }
    const blocks: SOPBlock[] = [];
    for (const b of newBlocks) {
      if (!b.title.trim()) continue;
      const items: SOPItem[] = b.itemsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          const parts = line.split('|');
          const instruction = parts[0]?.trim() || '';
          const pic = (parts[1]?.trim() || 'IE').toUpperCase();
          return [instruction, pic] as SOPItem;
        });

      blocks.push({
        t: b.title.trim(),
        m: b.mapping.trim(),
        i: items,
      });
    }

    if (blocks.length === 0) {
      setFormError('Mohon masukkan minimal 1 proses SOP.');
      return;
    }

    const created: SOPTemplate = {
      key: 'tpl_' + norm(newTemplateName) + '_' + Date.now(),
      name: newTemplateName.trim(),
      blocks,
    };

    onUpdateTemplates([...templates, created]);
    setIsCreating(false);
    setNewTemplateName('');
    setFormError('');
    setExpandedKey(created.key);
  };

  const getPicColor = (pic: string) => {
    const p = norm(pic);
    if (p.includes('pso')) return 'bg-amber-100 text-amber-900 border-amber-300';
    if (p.includes('ie')) return 'bg-blue-100 text-blue-900 border-blue-300';
    if (p.includes('qc')) return 'bg-pink-100 text-pink-900 border-pink-300';
    if (p.includes('mekanik') || p.includes('mech')) return 'bg-indigo-100 text-indigo-900 border-indigo-300';
    return 'bg-slate-100 text-slate-800 border-slate-300';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/30 rounded-xl text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Template SOP Garment</h2>
              <p className="text-xs text-slate-400">
                Kelola standar operasional prosedur per jenis garment (T-Shirt, Legging, dsb.)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 border border-blue-200/80 rounded-xl p-4 text-xs sm:text-sm text-blue-900">
            <div className="flex items-start space-x-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Format Import SOP Otomatis dari Excel:</p>
                <p className="text-blue-700 text-xs mt-0.5">
                  Buat sheet dengan nama produk (misal "Polo" / "Jogger"), lalu sertakan baris header:{' '}
                  <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">No. | Nama Proses | PIC</code>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetBuiltin}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs flex items-center gap-1.5 shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                Reset Standar
              </button>
              <button
                onClick={() => {
                  onClose();
                  onTriggerUpload();
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-700 text-white hover:bg-blue-800 font-medium text-xs flex items-center gap-1.5 shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Import Excel
              </button>
            </div>
          </div>

          {/* Action to create new template */}
          {!isCreating ? (
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Daftar Template ({templates.length})</h3>
              <button
                onClick={() => setIsCreating(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Buat Template Baru
              </button>
            </div>
          ) : (
            /* Create new template form */
            <div className="bg-white p-5 rounded-2xl border-2 border-blue-600/40 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" /> Tambah Template SOP Baru
                </h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Batal
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Produk / Garment:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Polo Shirt, Jacket Hoodie, Trackpants"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm bg-slate-50"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Daftar Proses SOP & Check Point:</label>
                  <button
                    onClick={handleAddBlockField}
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Proses
                  </button>
                </div>

                {newBlocks.map((b, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}.</span>
                      <input
                        type="text"
                        placeholder="Nama Proses SOP (mis: Join Shoulder - Overlock)"
                        value={b.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBlocks((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, title: val } : item))
                          );
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-blue-600"
                      />
                      <input
                        type="text"
                        placeholder="Nama di Database (opsional)"
                        value={b.mapping}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBlocks((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, mapping: val } : item))
                          );
                        }}
                        className="w-48 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-blue-600"
                      />
                      {newBlocks.length > 1 && (
                        <button
                          onClick={() => handleRemoveBlockField(idx)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Hapus Proses"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 mb-1">
                        Daftar checkpoint (1 baris per item, pisahkan instruksi & PIC dengan tanda <b>|</b>, misal:
                        "Standard RPM 5500 | Mekanik"):
                      </div>
                      <textarea
                        rows={3}
                        value={b.itemsText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBlocks((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, itemsText: val } : item))
                          );
                        }}
                        className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono bg-white focus:outline-blue-600"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveNewTemplate}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold shadow-xs"
                >
                  Simpan Template
                </button>
              </div>
            </div>
          )}

          {/* List of Templates */}
          <div className="space-y-3">
            {templates.map((tpl) => {
              const isExpanded = expandedKey === tpl.key;
              const usage = sessionUsage[tpl.key] || 0;
              const totalItems = tpl.blocks.reduce((acc, b) => acc + b.i.length, 0);

              return (
                <div
                  key={tpl.key}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                >
                  <div
                    onClick={() => handleToggleExpand(tpl.key)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/80 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {tpl.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base">{tpl.name}</h4>
                          {tpl.builtin && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                              Bawaan Pabrik
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {tpl.blocks.length} Proses SOP • {totalItems} Total Check Point • Digunakan di {usage} Sesi
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(tpl.key, tpl.name);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Hapus template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded block view */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50/40 space-y-4">
                      {tpl.blocks.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Belum ada proses di template ini.</p>
                      ) : (
                        tpl.blocks.map((block, bi) => (
                          <div
                            key={bi}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                              <span className="font-semibold text-xs sm:text-sm text-slate-900">
                                {bi + 1}. {cleanT(block.t)}
                              </span>
                              {block.m && (
                                <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
                                  Database: {block.m}
                                </span>
                              )}
                            </div>

                            <div className="space-y-1.5 pl-2">
                              {block.i.map(([instruction, pic], ii) => (
                                <div
                                  key={ii}
                                  className="text-xs flex items-start justify-between gap-3 text-slate-700 py-0.5"
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      {ii + 1}.
                                    </span>
                                    <span>{instruction}</span>
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getPicColor(
                                      pic
                                    )}`}
                                  >
                                    {pic}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
          >
            Tutup
          </button>
        </div>
      </div>

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
