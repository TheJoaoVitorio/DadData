import React, { useState } from 'react';
import { Sparkles, Terminal, FileSpreadsheet, Download, Plus, ArrowRight } from 'lucide-react';
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
  const [promptText, setPromptText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) return;
    onExecuteQuery(promptText);
    setPromptText('');
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4 pt-1 z-20 flex flex-col items-center">
      {/* Quick Action Chips (Matches Image 5: Write code, Generate image, etc.) */}
      <div className="flex items-center gap-2 mb-2 select-none overflow-x-auto max-w-full py-1">
        <button
          onClick={() => onExecuteQuery('SELECT * FROM ')}
          className="px-3 py-1 rounded-full bg-white/80 hover:bg-white text-slate-700 border border-slate-200/70 text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <span className="text-purple-600 font-mono">&lt; &gt;</span>
          <span>SELECT *</span>
        </button>

        <button
          onClick={onOpenAddRow}
          className="px-3 py-1 rounded-full bg-white/80 hover:bg-white text-slate-700 border border-slate-200/70 text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-3 h-3 text-emerald-600" />
          <span>Inserir Linha</span>
        </button>

        <button
          onClick={onExportCsv}
          className="px-3 py-1 rounded-full bg-white/80 hover:bg-white text-slate-700 border border-slate-200/70 text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Download className="w-3 h-3 text-sky-600" />
          <span>Exportar CSV</span>
        </button>

        <button
          onClick={onExportExcel}
          className="px-3 py-1 rounded-full bg-white/80 hover:bg-white text-slate-700 border border-slate-200/70 text-[11px] font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
          <span>Exportar Excel</span>
        </button>
      </div>

      {/* Signature Nocra Floating Query Bar with Iridescent Glow */}
      <div className="w-full nocra-gradient-ring rounded-2xl">
        <form
          onSubmit={handleSubmit}
          className="bg-white/95 backdrop-blur-xl rounded-2xl p-2 px-3.5 shadow-nocra-float flex items-center gap-3 border border-white/60"
        >
          {/* Sparkles Brand Icon */}
          <div className="w-7 h-7 rounded-xl bg-purple-100/70 text-purple-700 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>

          {/* Quick Input Text */}
          <input
            type="text"
            placeholder={
              activeConnection
                ? `Digite consulta SQL em ${activeConnection.name}... (ex: SELECT * FROM clientes WHERE saldo > 1000)`
                : 'Conecte-se a um banco de dados para executar consultas...'
            }
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            disabled={!activeConnection}
            className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
          />

          {/* Engine Pill Badge */}
          {activeConnection && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 text-slate-700 text-[11px] font-mono select-none">
              <DatabaseIcon type={activeConnection.type} className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-semibold uppercase">{activeConnection.type}</span>
            </div>
          )}

          {/* Generate / Run Button */}
          <button
            type="submit"
            disabled={isLoading || !promptText.trim() || !activeConnection}
            className="px-4 py-2 rounded-xl bg-[#121217] hover:bg-black text-white text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-md disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Executar</span>
          </button>
        </form>
      </div>
    </div>
  );
};
