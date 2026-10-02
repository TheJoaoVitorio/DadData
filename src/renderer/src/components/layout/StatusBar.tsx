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
      <footer className="h-8 bg-[#0C1818] border-t border-[#1E3B3A] px-4 flex items-center justify-between text-[11px] text-[#64837E] select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#1E3B3A]" />
          <span>Nenhum banco de dados conectado</span>
        </div>
        <span className="font-mono text-[10px] text-[#64837E]">DadData Client Pronto</span>
      </footer>
    );
  }

  return (
    <footer className="h-8 bg-[#0C1818] text-slate-200 border-t border-[#1E3B3A] px-4 flex items-center justify-between text-[11px] font-medium select-none z-30">
      {/* Left: Active Connection Pill */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 font-bold text-white">
          <span className="w-2 h-2 rounded-full bg-[#00F566] animate-pulse" />
          <span>{activeConnection.name}</span>
        </div>
        <span className="text-[10px] uppercase font-bold px-2 py-0.2 rounded-full bg-[#183434] text-[#00F566] font-mono border border-[#1E3B3A]">
          {activeConnection.type}
        </span>
        {selectedTable && (
          <span className="text-[10px] text-[#8EA8A3] font-mono border-l border-[#1E3B3A] pl-2">
            tabela: <strong className="text-white">{selectedTable}</strong>
          </span>
        )}
      </div>

      {/* Center: Result Metrics */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#162E2E] text-slate-300 font-semibold border border-[#1E3B3A]">
          <span className="text-[#00F566] font-mono font-bold">●</span>
          <span>Resultado</span>
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
          <span className="text-[#64837E]">linhas:</span>
          <span className="font-bold text-[#00F566]">{rowCount}</span>
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
          <Clock className="w-3 h-3 text-[#00F566]" />
          <span>{latencySec}s</span>
        </div>
      </div>

      {/* Right: Download / Export Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsExportOpen(!isExportOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#183434] hover:bg-[#1E3B3A] border border-[#1E3B3A] text-slate-200 hover:text-white text-[11px] font-semibold transition-all shadow-sm active:scale-95"
        >
          <Download className="w-3 h-3 text-[#00F566]" />
          <span>Exportar</span>
          <ChevronDown className="w-3 h-3 text-[#64837E]" />
        </button>

        {isExportOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setIsExportOpen(false)} />
            <div className="absolute right-0 bottom-full mb-1 w-44 bg-[#162E2E] border border-[#1E3B3A] rounded-xl p-1.5 shadow-2xl z-40 space-y-1">
              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportCsv();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 text-slate-300 hover:bg-[#1E3B3A] hover:text-[#00F566] transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#00F566]" />
                <span>Exportar CSV</span>
              </button>

              <button
                onClick={() => {
                  setIsExportOpen(false);
                  onExportExcel();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 text-slate-300 hover:bg-[#1E3B3A] hover:text-[#00F566] transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#00F566]" />
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
