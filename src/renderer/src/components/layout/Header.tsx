import React from 'react';
import { Database, Plus, Sparkles, FolderArchive, Layers, RefreshCw } from 'lucide-react';
import { ConnectionConfig } from '@shared/types/database';

interface HeaderProps {
  activeConnection: ConnectionConfig | null;
  onOpenNewConnection: () => void;
  onOpenSamples: () => void;
  onRefreshSchema: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeConnection,
  onOpenNewConnection,
  onOpenSamples,
  onRefreshSchema,
  isLoading
}) => {
  return (
    <header className="h-16 px-6 flex items-center justify-between z-10">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-2xl bg-white shadow-nocra-card border border-purple-100 flex items-center justify-center p-2 relative group cursor-pointer transition-transform hover:scale-105">
          <svg viewBox="0 0 32 32" className="w-full h-full" fill="none">
            <path
              d="M16 3L28 10V22L16 29L4 22V10L16 3Z"
              stroke="url(#nocra-grad)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <circle cx="16" cy="16" r="4.5" fill="url(#nocra-grad)" />
            <defs>
              <linearGradient id="nocra-grad" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
                <stop stopColor="#8B5CF6" />
                <stop offset="0.5" stopColor="#EC4899" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-900">DadData</h1>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
              v1.0 Pro
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Bancos Modernos & Legados (DBF, Paradox, Access, HFSQL)</p>
        </div>
      </div>

      {/* Active Database Badge Pill */}
      {activeConnection && (
        <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-md shadow-sm border border-slate-200/80">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-800">{activeConnection.name}</span>
          <span className="text-[10px] uppercase px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
            {activeConnection.type}
          </span>
          <button
            onClick={onRefreshSchema}
            disabled={isLoading}
            title="Recarregar Tabelas"
            className="p-1 hover:bg-slate-100 rounded-full transition-colors ml-1 text-slate-500"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex items-center gap-3">
        {/* Samples Button */}
        <button
          onClick={onOpenSamples}
          className="h-10 px-4 rounded-full bg-white/80 hover:bg-white text-slate-700 border border-slate-200/80 hover:border-purple-300 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm hover:shadow"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
          <span>Bancos de Amostra</span>
        </button>

        {/* New Connection Button */}
        <button
          onClick={onOpenNewConnection}
          className="h-10 px-5 rounded-full bg-[#121217] hover:bg-black text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Conexão</span>
        </button>
      </div>
    </header>
  );
};
