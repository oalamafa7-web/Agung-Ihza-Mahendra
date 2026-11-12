import React, { useState } from 'react';
import {
  X,
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  ExternalLink,
  Table as TableIcon,
  Save,
  Key,
  Globe,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  MAIN_TABLE_NAME,
  fetchAllSessions,
  sanitizeUrl,
} from '../lib/supabaseClient';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  sessionCount: number;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  sessionCount,
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form input state
  const [inputUrl, setInputUrl] = useState<string>(() => {
    return SUPABASE_URL !== 'https://supabase.co' ? SUPABASE_URL : '';
  });
  const [inputKey, setInputKey] = useState<string>(() => {
    return SUPABASE_ANON_KEY !== '[TEMPEL_ANON_PUBLIC_KEY_ANDA_DI_SINI]' ? SUPABASE_ANON_KEY : '';
  });
  const [inputTable, setInputTable] = useState<string>(MAIN_TABLE_NAME);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSaveCredentials = () => {
    const cleanUrl = sanitizeUrl(inputUrl);
    const cleanKey = inputKey.trim();
    const cleanTable = (inputTable.trim() || 'sop_sessions');

    localStorage.setItem('sopa_custom_supabase_url', cleanUrl);
    localStorage.setItem('sopa_custom_supabase_key', cleanKey);
    localStorage.setItem('sopa_custom_supabase_table', cleanTable);

    setSaveSuccess(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const handleClearCredentials = () => {
    localStorage.removeItem('sopa_custom_supabase_url');
    localStorage.removeItem('sopa_custom_supabase_key');
    localStorage.removeItem('sopa_custom_supabase_table');
    window.location.reload();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const res = await fetchAllSessions();
    setTesting(false);

    if (res.error) {
      setTestResult({
        success: false,
        message: `Koneksi gagal: ${res.error}. Pastikan URL dan Anon Key valid, tabel '${inputTable || MAIN_TABLE_NAME}' sudah dibuat di Supabase, dan RLS policy mengizinkan akses.`,
      });
    } else {
      setTestResult({
        success: true,
        message: `Koneksi Berhasil! Terhubung ke tabel '${inputTable || MAIN_TABLE_NAME}'. Ditemukan ${res.data?.length || 0} data sesi di database cloud.`,
      });
      onRefresh();
    }
  };

  const sqlCode = `-- Jalankan di SQL Editor Supabase:
CREATE TABLE IF NOT EXISTS public.${inputTable || MAIN_TABLE_NAME} (
  id TEXT PRIMARY KEY,
  factory TEXT DEFAULT 'Factory 1',
  line TEXT NOT NULL,
  date TEXT,
  file TEXT,
  style TEXT,
  file_name TEXT,
  sheet TEXT,
  ops JSONB DEFAULT '[]'::jsonb,
  hours JSONB DEFAULT '[]'::jsonb,
  tpl TEXT,
  map JSONB DEFAULT '{}'::jsonb,
  checks JSONB DEFAULT '{}'::jsonb,
  bdate JSONB DEFAULT '{}'::jsonb,
  created BIGINT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.${inputTable || MAIN_TABLE_NAME} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public anon access" ON public.${inputTable || MAIN_TABLE_NAME}
  FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.${inputTable || MAIN_TABLE_NAME};`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl text-emerald-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">Pengaturan Database Supabase</h2>
                {isSupabaseConfigured ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/40">
                    Cloud Aktif
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-500/40">
                    Penyimpanan Lokal (Standby)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Hubungkan database cloud agar seluruh pengguna melihat dan mengupdate data secara bersamaan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
          {/* Form Kredensial */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-600" /> Masukkan Kredensial Supabase Anda
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-blue-600" /> Project URL:
                </label>
                <input
                  type="text"
                  placeholder="https://abcdefghijkl.supabase.co"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-amber-600" /> Anon Public Key:
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1 flex items-center gap-1">
                  <TableIcon className="w-3.5 h-3.5 text-indigo-600" /> Nama Tabel Utama:
                </label>
                <input
                  type="text"
                  placeholder="sop_sessions"
                  value={inputTable}
                  onChange={(e) => setInputTable(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveCredentials}
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saveSuccess ? 'Tersimpan! Memuat...' : 'Simpan & Hubungkan'}</span>
                </button>

                {isSupabaseConfigured && (
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                    <span>{testing ? 'Menguji...' : 'Uji Koneksi'}</span>
                  </button>
                )}
              </div>

              {(localStorage.getItem('sopa_custom_supabase_url') || localStorage.getItem('sopa_custom_supabase_key')) && (
                <button
                  type="button"
                  onClick={handleClearCredentials}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                >
                  Reset ke Bawaan
                </button>
              )}
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* SQL Setup Instruction */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                  Struktur Kolom Tabel `{inputTable || MAIN_TABLE_NAME}`
                </h4>
                <p className="text-[11px] text-slate-500">
                  Jalankan query ini di <b>SQL Editor</b> Supabase Anda jika tabel belum ada:
                </p>
              </div>
              <button
                onClick={copySql}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs flex items-center gap-1 cursor-pointer transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? 'Tersalin!' : 'Salin SQL'}</span>
              </button>
            </div>

            <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 leading-relaxed">
              {sqlCode}
            </pre>
          </div>

          {/* Guide for Netlify */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-1.5">
            <h5 className="font-bold flex items-center gap-1.5 text-blue-950">
              <ExternalLink className="w-3.5 h-3.5 text-blue-700" />
              Menghubungkan ke Netlify (Deploy Otomatis):
            </h5>
            <p className="text-blue-800 leading-relaxed">
              Buka dashboard <b>Netlify &gt; Site configuration &gt; Environment variables</b>, lalu tambahkan:
            </p>
            <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] text-blue-950">
              <li><b>VITE_SUPABASE_URL</b> = URL project Supabase Anda</li>
              <li><b>VITE_SUPABASE_ANON_KEY</b> = Anon public key Anda</li>
              <li><b>VITE_SUPABASE_TABLE</b> = {inputTable || MAIN_TABLE_NAME}</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
