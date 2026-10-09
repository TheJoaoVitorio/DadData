import React, { useState } from 'react';
import { Play, Copy, Trash2, Check, Terminal, ChevronDown, ChevronRight, Code } from 'lucide-react';

interface SqlEditorProps {
  query: string;
  onQueryChange: (query: string) => void;
  onExecute: (query: string) => void;
  isLoading: boolean;
  tableName?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  height?: number;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  query,
  onQueryChange,
  onExecute,
  isLoading,
  isCollapsed = false,
  onToggleCollapse,
  height
}) => {
  const [copied, setCopied] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onExecute(query);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const insertSnippet = (snippet: string) => {
    onQueryChange(query + (query.endsWith(' ') || query === '' ? '' : ' ') + snippet);
  };

  // First line preview for collapsed view
  const firstLinePreview = query
    ? query.trim().split('\n')[0].slice(0, 75) + (query.length > 75 ? '...' : '')
    : 'Nenhuma consulta inserida...';

  // Collapsed View (Accordion/Dropdown mode)
  if (isCollapsed) {
    return (
      <div className="rounded-xl bg-white text-zinc-900 px-3 py-1.5 shadow-xs border border-zinc-200/90 flex items-center justify-between gap-3 select-none flex-shrink-0 transition-all">
        <div
          onClick={onToggleCollapse}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 flex-1 min-w-0"
          title="Clique para expandir o Editor SQL"
        >
          <button
            type="button"
            className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
            <Terminal className="w-3.5 h-3.5 text-amber-500" />
            <span>Editor SQL</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 truncate max-w-xl hidden sm:inline">
            {firstLinePreview}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onToggleCollapse}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
          >
            Expandir
          </button>

          <button
            onClick={() => onExecute(query)}
            disabled={isLoading || !query.trim()}
            title="Executar Consulta (Ctrl+Enter)"
            className="h-7 px-3 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-40"
          >
            <Play className={`w-3 h-3 fill-current ${isLoading ? 'animate-spin' : ''}`} />
            <span>Executar</span>
          </button>
        </div>
      </div>
    );
  }

  // Expanded View
  return (
    <div
      style={height ? { height: `${height}px` } : undefined}
      className="rounded-2xl bg-white text-zinc-900 p-3 shadow-xs border border-zinc-200/90 flex flex-col relative select-none flex-shrink-0 transition-all"
    >
      {/* Editor Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-150 flex-shrink-0">
        <div className="flex items-center gap-2">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title="Recolher Editor SQL (ver apenas Grid de Dados)"
              className="p-1 -ml-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 tracking-wide">
            <Terminal className="w-3.5 h-3.5 text-amber-500" />
            <span>Editor SQL / NoSQL</span>
          </div>
        </div>

        {/* Quick Snippets */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {['SELECT *', 'WHERE', 'ORDER BY', 'COUNT(*)', 'LIMIT 100'].map(snippet => (
            <button
              key={snippet}
              onClick={() => insertSnippet(snippet)}
              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 hover:bg-amber-100 hover:text-amber-900 hover:border-amber-300 text-zinc-600 border border-zinc-200 transition-colors"
            >
              {snippet}
            </button>
          ))}
        </div>
      </div>

      {/* Code Textarea - Controlled by Tab State */}
      <div className="relative flex-1 min-h-0 bg-zinc-50 border border-zinc-200/80 rounded-xl p-2.5 focus-within:bg-white focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all overflow-hidden flex flex-col">
        <textarea
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="w-full flex-1 bg-transparent text-zinc-900 font-mono text-xs leading-relaxed resize-none focus:outline-none placeholder-zinc-400"
          placeholder="Escreva sua consulta SQL aqui (ex: SELECT * FROM clientes)..."
        />
      </div>

      {/* Bottom Action Bar */}
      <div className="pt-2 mt-2 border-t border-zinc-150 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-zinc-700 text-xs flex items-center gap-1.5 transition-colors font-medium"
          >
            {copied ? <Check className="w-3 h-3 text-amber-600" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>

          <button
            onClick={() => onQueryChange('')}
            className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-zinc-200 text-zinc-700 text-xs flex items-center gap-1.5 transition-colors font-medium"
          >
            <Trash2 className="w-3 h-3" />
            <span>Limpar</span>
          </button>
        </div>

        {/* AbacatePay Signature Yellow Execute Button */}
        <button
          onClick={() => onExecute(query)}
          disabled={isLoading || !query.trim()}
          className="h-8 px-4 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:hover:bg-[#FACC15]"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Executando...' : 'Executar'}</span>
          <span className="text-[10px] opacity-75 font-mono ml-0.5">(Ctrl+Enter)</span>
        </button>
      </div>
    </div>
  );
};
export default SqlEditor;
