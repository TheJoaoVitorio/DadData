import React from 'react';
import {
  FileSpreadsheet,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  Database,
  ChevronDown
} from 'lucide-react';
import { ConnectionConfig, QueryResult } from '@shared/types/database';
import { DatabaseIcon } from '../icons/DatabaseIcon';

interface StatusBarProps {
  activeConnection: ConnectionConfig | null;
  queryResult: QueryResult | null;
  isLoading: boolean;
  selectedTable: string | null;
  onExportCsv: () => void;
  onExportExcel: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activeConnection,
  queryResult,
  isLoading,
  selectedTable,
  onExportCsv,
  onExportExcel
}) => {
  const [isExportOpen, setIsExportOpen] = React.useState(false);
  const rowCount = queryResult?.rowCount ?? 0;
  const executionTimeMs = queryResult?.executionTimeMs ?? 0;
  const latencySec = (executionTimeMs / 1000).toFixed(3);

  if (!activeConnection) {
    return (
      <footer className="h-8 bg-slate-100 border-t border-slate-200/80 px-4 flex items-center justify-between text-[11px] text-slate-500 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-300" />
          <span>Nenhum banco de dados conectado</span>
        </div>
        <span>Pronto</span>
      </footer>
    );
  }

  return (
    <footer className="h-8 bg-[#38BDF8] text-slate-900 px-4 flex items-center justify-between text-[11px] font-medium select-none shadow-sm z-30">
      {/* Left: Active Connection Pill */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 font-bold">
          <CheckCircle2 className="w-3.5 h-3.5 text-slate-900" />
          <span>{activeConnection.name}</span>
        </div>
        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-white/40 text-slate-950 font-mono">
          {activeConnection.type}
        </span>
      </div>

      {/* Center: Result Metrics (Beekeeper Studio Signature) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/30 text-slate-950 font-semibold cursor-pointer hover:bg-white/40">
          <span>Result 1</span>
          <ChevronDown className="w-3 h-3 opacity-70" />
        </div>

        <div className="flex items-center gap-1">
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-slate-900" fill="currentColor">
            <rect x="2" y="2" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.2" />
            <line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.2" />
            <line x1="6" y1="2" x2="6" y2="14" stroke="currentColor" strokeWidth="1.2" />
            <line x1="10" y1="2" x2="10" y2="14" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <span className="font-semibold">{rowCount}</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-slate-800 text-[12px] font-bold">⊘</span>
          <span>0</span>
        </div>

        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-900" />
          <span>{latencySec} seconds</span>
        </div>
      </div>

      {/* Right: Download / Export Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsExportOpen(!isExportOpen)}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-900 hover:bg-black text-white text-[11px] font-semibold transition-all shadow-sm active:scale-95"
        >
          <Download className="w-3 h-3" />
          <span>Download</span>
          <ChevronDown className="w-3 h-3 opacity-80" />
        </button>

        {isExportOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsExportOpen(false)} />
            <div className="absolute right-0 bottom-full mb-1.5 w-44 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 text-xs">
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportCsv();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-2 text-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" />
                <span>Exportar CSV</span>
              </button>
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportExcel();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-2 text-slate-700"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Exportar Excel (.xlsx)</span>
              </button>
            </div>
          </>
        )}
      </div>
    </footer>
  );
};
