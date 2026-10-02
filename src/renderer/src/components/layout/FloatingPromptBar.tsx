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
    <div className="w-full max-w-4xl mx-auto px-4 pb-3 pt-1 z-20 flex flex-col items-center select-none">
      {/* Quick Action Chips - Developer First, No AI Cliches */}
      <div className="flex items-center gap-2 mb-2 overflow-x-auto max-w-full py-0.5">
        <button
          onClick={() => onExecuteQuery('SELECT * FROM ')}
          className="px-3 py-1 rounded-full bg-white hover:bg-[#F2F6F4] text-[#142929] border border-[#D3DDD8] text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <span className="text-[#047857] font-mono font-bold">&lt;&gt;</span>
          <span>SELECT *</span>
        </button>

        <button
          onClick={onOpenAddRow}
          className="px-3 py-1 rounded-full bg-white hover:bg-[#F2F6F4] text-[#142929] border border-[#D3DDD8] text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5 text-[#047857] stroke-[2.5]" />
          <span>Inserir Linha</span>
        </button>

        <button
          onClick={onExportCsv}
          className="px-3 py-1 rounded-full bg-white hover:bg-[#F2F6F4] text-[#142929] border border-[#D3DDD8] text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5 text-[#64837E]" />
          <span>Exportar CSV</span>
        </button>

        <button
          onClick={onExportExcel}
          className="px-3 py-1 rounded-full bg-white hover:bg-[#F2F6F4] text-[#142929] border border-[#D3DDD8] text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#047857]" />
          <span>Exportar Excel</span>
        </button>
      </div>

      {/* AbacatePay Developer Command Bar (Clean, High-Contrast, Petroleum & Lime) */}
      <div className="w-full">
        <form
          onSubmit={handleSubmit}
          className="bg-[#112323] rounded-2xl p-2 px-3.5 shadow-abacate-float flex items-center gap-3 border border-[#1E3B3A]"
        >
          {/* Terminal Developer Icon */}
          <div className="w-7 h-7 rounded-xl bg-[#1A3838] border border-[#224444] text-[#00F566] flex items-center justify-center flex-shrink-0">
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
            className="flex-1 bg-transparent text-xs text-white placeholder-[#64837E] font-mono focus:outline-none"
          />

          {/* Engine Pill Badge */}
          {activeConnection && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#183434] border border-[#1E3B3A] text-[#00F566] text-[11px] font-mono select-none">
              <DatabaseIcon type={activeConnection.type} className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-semibold uppercase">{activeConnection.type}</span>
            </div>
          )}

          {/* Run Command Button (AbacatePay Neon) */}
          <button
            type="submit"
            disabled={!activeConnection || !commandText.trim() || isLoading}
            className="h-8 px-3.5 rounded-xl bg-[#00F566] hover:bg-[#00DF61] disabled:opacity-40 disabled:hover:bg-[#00F566] text-[#0C1818] font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 flex-shrink-0"
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
