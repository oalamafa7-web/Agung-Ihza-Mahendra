import React, { useState, useEffect } from 'react';
import { Factory, Calendar, Clock, Database } from 'lucide-react';

interface HeaderProps {
  sessionCount: number;
}

export const Header: React.FC<HeaderProps> = ({ sessionCount }) => {
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

        <div className="flex items-center space-x-3 text-xs sm:text-sm">
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>{sessionCount} Sesi Aktif</span>
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
