import React, { useState } from 'react';
import { Terminal, FileSpreadsheet, Download, Plus, ArrowRight, CornerDownLeft } from 'lucide-react';
import { ConnectionConfig } from '@shared/types/database';
import { DatabaseIcon } from '../icons/DatabaseIcon';

interface FloatingPromptBarProps {
  activeConnection: ConnectionConfig | null;
  onExecuteQuery: (query: string) => void;
  onOpenAddRow: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  isLoading: boolean;
}

export const FloatingPromptBar: React.FC<FloatingPromptBarProps> = ({
  activeConnection,
  onExecuteQuery,
  onOpenAddRow,
  onExportCsv,
  onExportExcel,
  isLoading
}) => {
  const [commandText, setCommandText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandText.trim()) return;
    onExecuteQuery(commandText);
    setCommandText('');
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-2 pt-1 z-20 flex flex-col items-center select-none">
      {/* Quick Action Chips - Minimalist & Developer Friendly */}
      <div className="flex items-center gap-2 mb-2 overflow-x-auto max-w-full py-0.5">
        <button
          onClick={() => onExecuteQuery('SELECT * FROM ')}
          className="px-3 py-1 rounded-full bg-white hover:bg-amber-50 text-zinc-800 hover:text-amber-950 border border-zinc-200 hover:border-amber-300 text-[11px] font-semibold flex items-center gap-1.5 shadow-xs transition-all"
        >
          <span className="text-amber-600 font-mono font-bold">&lt;&gt;</span>
          <span>SELECT *</span>
        </button>

        <button
          onClick={onOpenAddRow}
          className="px-3 py-1 rounded-full bg-white hover:bg-amber-50 text-zinc-800 hover:text-amber-950 border border-zinc-200 hover:border-amber-300 text-[11px] font-semibold flex items-center gap-1.5 shadow-xs transition-all"
        >
          <Plus className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
          <span>Inserir Linha</span>
        </button>

        <button
          onClick={onExportCsv}
          className="px-3 py-1 rounded-full bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-[11px] font-semibold flex items-center gap-1.5 shadow-xs transition-all"
        >
          <Download className="w-3.5 h-3.5 text-zinc-500" />
          <span>Exportar CSV</span>
        </button>

        <button
          onClick={onExportExcel}
          className="px-3 py-1 rounded-full bg-white hover:bg-amber-50 text-zinc-800 hover:text-amber-950 border border-zinc-200 hover:border-amber-300 text-[11px] font-semibold flex items-center gap-1.5 shadow-xs transition-all"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
          <span>Exportar Excel</span>
        </button>
      </div>

      {/* Clean Light Developer Command Bar */}
      <div className="w-full">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-2 px-3.5 shadow-md flex items-center gap-3 border border-zinc-200/90"
        >
          {/* Terminal Developer Icon */}
          <div className="w-7 h-7 rounded-xl bg-amber-100 border border-amber-200/80 text-amber-800 flex items-center justify-center flex-shrink-0">
            <Terminal className="w-4 h-4 stroke-[2.2]" />
          </div>

          {/* Quick Input Text */}
          <input
            type="text"
            placeholder={
              activeConnection
                ? `Executar SQL rápido em ${activeConnection.name}... (ex: SELECT * FROM clientes WHERE saldo > 0)`
                : 'Conecte-se a um banco de dados para executar consultas...'
            }
            value={commandText}
            onChange={e => setCommandText(e.target.value)}
            disabled={!activeConnection}
            className="flex-1 bg-transparent text-xs text-zinc-900 placeholder-zinc-400 font-mono focus:outline-none"
          />

          {/* Engine Pill Badge */}
          {activeConnection && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 text-[11px] font-mono select-none">
              <DatabaseIcon type={activeConnection.type} className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-semibold uppercase">{activeConnection.type}</span>
            </div>
          )}

          {/* Run Command Button (Yellow CTA) */}
          <button
            type="submit"
            disabled={!activeConnection || !commandText.trim() || isLoading}
            className="h-8 px-3.5 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 disabled:hover:bg-[#FACC15] text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 flex-shrink-0"
          >
            <span>Executar</span>
            <CornerDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </form>
      </div>
    </div>
  );
};
export default FloatingPromptBar;
