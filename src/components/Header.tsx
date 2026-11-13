import React, { useState, useEffect } from 'react';
import { Factory, Clock, Database, FileSpreadsheet, Flame } from 'lucide-react';

interface HeaderProps {
  sessionCount: number;
  isCloudConnected?: boolean;
  onOpenDatabaseConfig?: () => void;
  onOpenGoogleSheets?: () => void;
  firebaseUserEmail?: string | null;
  onOpenFirebase?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sessionCount,
  isCloudConnected = false,
  onOpenDatabaseConfig,
  onOpenGoogleSheets,
  firebaseUserEmail,
  onOpenFirebase,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleString('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white shadow-md border-b border-blue-900/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
            <Factory className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent">
                SOP Assessment
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Line Production
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Audit & Kepatuhan SOP Sewing Garment
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 text-xs sm:text-sm">
          {onOpenFirebase && (
            <button
              onClick={onOpenFirebase}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-semibold shadow-xs cursor-pointer transition active:scale-95 ${
                firebaseUserEmail
                  ? 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-400/50 text-orange-200'
                  : 'bg-slate-800/70 hover:bg-slate-700/70 border-slate-600 text-slate-200'
              }`}
              title={
                firebaseUserEmail
                  ? `Terhubung ke Firebase (${firebaseUserEmail})`
                  : 'Login Google & Sinkronisasi Firebase Firestore'
              }
            >
              <Flame
                className={`w-4 h-4 ${
                  firebaseUserEmail ? 'text-orange-400' : 'text-slate-400'
                }`}
              />
              <span className="hidden sm:inline">
                {firebaseUserEmail ? 'Firebase Sync' : 'Firebase'}
              </span>
            </button>
          )}

          {onOpenGoogleSheets && (
            <button
              onClick={onOpenGoogleSheets}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-600/30 hover:bg-teal-600/50 border border-teal-400/40 text-teal-200 font-semibold shadow-xs cursor-pointer transition active:scale-95"
              title="Impor atau ekspor data dengan Google Sheets"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline">Google Sheets</span>
            </button>
          )}

          {isCloudConnected ? (
            <button
              onClick={onOpenDatabaseConfig}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-semibold shadow-xs cursor-pointer transition active:scale-95"
              title="Klik untuk melihat status koneksi Supabase"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Supabase Cloud</span>
            </button>
          ) : (
            <button
              onClick={onOpenDatabaseConfig}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 text-xs cursor-pointer transition"
              title="Klik untuk menghubungkan database Supabase"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Penyimpanan Lokal</span>
            </button>
          )}

          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>{sessionCount} Sesi</span>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 font-mono text-xs">
            <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>{timeStr || 'Memuat waktu...'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
