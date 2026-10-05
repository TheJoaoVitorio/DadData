import React, { useState } from 'react';
import { Play, Copy, Trash2, Check, Terminal } from 'lucide-react';

interface SqlEditorProps {
  query: string;
  onQueryChange: (query: string) => void;
  onExecute: (query: string) => void;
  isLoading: boolean;
  tableName?: string;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  query,
  onQueryChange,
  onExecute,
  isLoading
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

  return (
    <div className="rounded-2xl bg-white text-zinc-900 p-4 shadow-sm border border-zinc-200/90 flex flex-col relative group">
      {/* Editor Header */}
      <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-zinc-150 select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-zinc-900 tracking-wide">Editor SQL / NoSQL</span>
        </div>

        {/* Quick Snippets */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
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
      <div className="relative flex-1 min-h-[100px] max-h-[220px] bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 focus-within:bg-white focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
        <textarea
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="w-full h-full min-h-[100px] bg-transparent text-zinc-900 font-mono text-xs leading-relaxed resize-none focus:outline-none placeholder-zinc-400"
          placeholder="Escreva sua consulta SQL aqui (ex: SELECT * FROM clientes)..."
        />
      </div>

      {/* Bottom Action Bar */}
      <div className="pt-3 mt-2.5 border-t border-zinc-150 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-zinc-700 text-xs flex items-center gap-1.5 transition-colors font-medium"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-amber-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>

          <button
            onClick={() => onQueryChange('')}
            className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-zinc-200 text-zinc-700 text-xs flex items-center gap-1.5 transition-colors font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        </div>

        {/* AbacatePay Signature Yellow Execute Button */}
        <button
          onClick={() => onExecute(query)}
          disabled={isLoading || !query.trim()}
          className="px-5 py-2 rounded-xl bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:hover:bg-[#FACC15]"
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
