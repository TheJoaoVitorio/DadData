import React, { useState } from 'react';
import { Sparkles, X, CornerDownLeft, Database } from 'lucide-react';
import { ConnectionConfig } from '@shared/types/database';
import { DatabaseIcon } from '../icons/DatabaseIcon';

interface FloatingAiButtonProps {
  activeConnection: ConnectionConfig | null;
  onExecuteQuery: (query: string) => void;
  isLoading: boolean;
}

export const FloatingAiButton: React.FC<FloatingAiButtonProps> = ({
  activeConnection,
  onExecuteQuery,
  isLoading
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [promptText, setPromptText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) return;
    onExecuteQuery(promptText.trim());
    setPromptText('');
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-11 right-6 z-40 select-none">
      {/* Expanded Popover Card */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 bottom-full mb-3 w-[420px] max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-zinc-200/90 p-4 z-40 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-150">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-amber-100 border border-amber-300/80 text-amber-900 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 fill-amber-400 text-amber-600" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900">Assistente IA & SQL</h4>
                  <p className="text-[10px] text-zinc-500">Execução rápida e futura análise preditiva</p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Connection Pill */}
            {activeConnection && (
              <div className="mb-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-700 text-[11px] font-mono">
                <DatabaseIcon type={activeConnection.type} className="w-3.5 h-3.5 text-zinc-500" />
                <span className="font-semibold text-zinc-800 truncate">{activeConnection.name}</span>
                <span className="ml-auto text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-950 font-bold border border-amber-300">
                  {activeConnection.type}
                </span>
              </div>
            )}

            {/* Prompt / Query Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    handleSubmit(e);
                  }
                }}
                rows={3}
                placeholder={
                  activeConnection
                    ? `Escreva um comando SQL rápido ou instrução (ex: SELECT * FROM clientes LIMIT 50)...`
                    : 'Conecte-se a um banco de dados para executar consultas...'
                }
                disabled={!activeConnection}
                className="w-full p-2.5 text-xs bg-zinc-50 focus:bg-white border border-zinc-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none resize-none transition-all"
                autoFocus
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-zinc-400 font-mono">Ctrl+Enter para enviar</span>

                <button
                  type="submit"
                  disabled={!activeConnection || !promptText.trim() || isLoading}
                  className="h-8 px-4 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-40"
                >
                  <span>Executar</span>
                  <CornerDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Assistente IA / SQL Rápido"
        className={`h-9 px-3.5 rounded-full flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
          isOpen
            ? 'bg-amber-400 text-zinc-950 ring-2 ring-amber-300'
            : 'bg-zinc-950 hover:bg-zinc-800 text-white hover:shadow-xl'
        }`}
      >
        <Sparkles className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
        <span className="text-xs font-bold tracking-tight">Assistente IA</span>
      </button>
    </div>
  );
};
export default FloatingAiButton;
