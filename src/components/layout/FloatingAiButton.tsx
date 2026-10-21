import React, { useState } from 'react';
import { Sparkles, X, CornerDownLeft, Database } from 'lucide-react';
import { ConnectionConfig } from '@shared/types/database';
import { DatabaseIcon } from '../icons/DatabaseIcon';
import { BorderBeam } from '../magicui/border-beam';
import { ShinyButton } from '../magicui/shiny-button';
import { AnimatedGradientText } from '../magicui/animated-gradient-text';

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
          <div className="absolute right-0 bottom-full mb-3 w-[440px] max-w-[calc(100vw-3rem)] bg-white rounded-3xl shadow-2xl border border-zinc-200/90 p-5 z-40 animate-in fade-in slide-in-from-bottom-2 duration-150 overflow-hidden">
            {/* Magic UI Border Beam on the AI Popover */}
            <BorderBeam size={180} duration={10} colorFrom="#FACC15" colorTo="#8B5CF6" borderWidth={2} />

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between pb-3 mb-3 border-b border-zinc-150">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300/80 text-amber-900 flex items-center justify-center flex-shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4 fill-amber-400 text-amber-600 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <AnimatedGradientText className="text-xs font-bold text-zinc-900">
                      <span>Assistente IA & SQL</span>
                    </AnimatedGradientText>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-950 border border-amber-300">
                      Beta
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500">Execução rápida e futura análise preditiva</p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Connection Pill */}
            {activeConnection && (
              <div className="relative z-10 mb-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-700 text-[11px] font-mono">
                <DatabaseIcon type={activeConnection.type} className="w-3.5 h-3.5 text-zinc-500" />
                <span className="font-semibold text-zinc-800 truncate">{activeConnection.name}</span>
                <span className="ml-auto text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-950 font-bold border border-amber-300">
                  {activeConnection.type}
                </span>
              </div>
            )}

            {/* Prompt / Query Form */}
            <form onSubmit={handleSubmit} className="relative z-10 space-y-3">
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
                className="w-full p-3 text-xs bg-zinc-50 focus:bg-white border border-zinc-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-2xl font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none resize-none transition-all"
                autoFocus
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-zinc-400 font-mono">Ctrl+Enter para enviar</span>

                <ShinyButton
                  type="submit"
                  disabled={!activeConnection || !promptText.trim() || isLoading}
                  className="py-1.5 px-4 text-xs font-bold"
                >
                  <span>Executar</span>
                  <CornerDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                </ShinyButton>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Floating Action Button (FAB) with Magic UI Shimmer Effect */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Assistente IA / SQL Rápido"
        className={`relative h-10 px-4 rounded-full flex items-center gap-2 shadow-xl transition-all active:scale-95 cursor-pointer overflow-hidden group ${
          isOpen
            ? 'bg-amber-400 text-zinc-950 ring-2 ring-amber-300 font-bold'
            : 'bg-zinc-950 hover:bg-zinc-900 text-white hover:shadow-2xl font-semibold'
        }`}
      >
        {/* Shimmer sweep animation */}
        <span
          className="pointer-events-none absolute inset-0 block h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent"
          style={{ backgroundSize: '200% 100%' }}
        />
        <Sparkles className="relative z-10 w-4 h-4 fill-amber-400 text-amber-400 group-hover:rotate-12 transition-transform" />
        <span className="relative z-10 text-xs tracking-tight">Assistente IA</span>
      </button>
    </div>
  );
};
export default FloatingAiButton;
