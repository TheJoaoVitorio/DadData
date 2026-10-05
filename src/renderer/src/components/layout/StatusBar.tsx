import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Clock,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { ConnectionConfig, QueryResult } from '@shared/types/database';

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
  const [isExportOpen, setIsExportOpen] = useState(false);
  const rowCount = queryResult?.rowCount ?? 0;
  const executionTimeMs = queryResult?.executionTimeMs ?? 0;
  const latencySec = (executionTimeMs / 1000).toFixed(3);

  if (!activeConnection) {
    return (
      <footer className="h-8 bg-white border-t border-zinc-200/80 px-4 flex items-center justify-between text-[11px] text-zinc-400 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-zinc-300" />
          <span>Nenhum banco de dados conectado</span>
        </div>
        <span className="font-mono text-[10px] text-zinc-400">DadData Pronto</span>
      </footer>
    );
  }

  return (
    <footer className="h-8 bg-white text-zinc-600 border-t border-zinc-200/80 px-4 flex items-center justify-between text-[11px] font-medium select-none z-30">
      {/* Left: Active Connection Pill */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 font-bold text-zinc-900">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>{activeConnection.name}</span>
        </div>
        <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-950 font-mono border border-amber-300/60">
          {activeConnection.type}
        </span>
        {selectedTable && (
          <span className="text-[10px] text-zinc-500 font-mono border-l border-zinc-200 pl-2">
            tabela: <strong className="text-zinc-800">{selectedTable}</strong>
          </span>
        )}
      </div>

      {/* Center: Result Metrics */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-semibold border border-zinc-200">
          <span className="text-amber-500 font-mono font-bold">●</span>
          <span>Resultado</span>
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px] text-zinc-600">
          <span className="text-zinc-400">linhas:</span>
          <span className="font-bold text-amber-700">{rowCount}</span>
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px] text-zinc-600">
          <Clock className="w-3 h-3 text-amber-500" />
          <span>{latencySec}s</span>
        </div>
      </div>

      {/* Right: Download / Export Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsExportOpen(!isExportOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-zinc-800 text-[11px] font-semibold transition-all shadow-xs active:scale-95"
        >
          <Download className="w-3 h-3 text-amber-600" />
          <span>Exportar</span>
          <ChevronDown className="w-3 h-3 text-zinc-400" />
        </button>

        {isExportOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsExportOpen(false)} />
            <div className="absolute right-0 bottom-full mb-1 w-44 bg-white border border-zinc-200 rounded-xl p-1.5 shadow-xl z-40 space-y-1">
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportCsv();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 hover:bg-amber-50 hover:text-amber-950 text-zinc-800 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-zinc-500" />
                <span>Exportar CSV</span>
              </button>
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportExcel();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 hover:bg-amber-50 hover:text-amber-950 text-zinc-800 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                <span>Exportar Excel (.xlsx)</span>
              </button>
            </div>
          </>
        )}
      </div>
    </footer>
  );
};
export default StatusBar;
