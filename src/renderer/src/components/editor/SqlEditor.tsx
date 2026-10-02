import React, { useState, useEffect } from 'react';
import { Play, Copy, Trash2, Check, Sparkles, Terminal } from 'lucide-react';

interface SqlEditorProps {
  initialQuery?: string;
  onExecute: (query: string) => void;
  isLoading: boolean;
  tableName?: string;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  initialQuery = 'SELECT * FROM clients LIMIT 50;',
  onExecute,
  isLoading,
  tableName
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (tableName) {
      setQuery(`SELECT * FROM "${tableName}" LIMIT 100;`);
    }
  }, [tableName]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to execute
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
    setQuery(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + snippet);
  };

  return (
    <div className="rounded-3xl bg-[#121217] text-white p-5 shadow-2xl border border-white/[0.08] flex flex-col relative overflow-hidden group">
      {/* Glow decorative aura inside editor */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Editor Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-slate-300">Editor SQL / NoSQL</span>
        </div>

        {/* Quick Snippets */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['SELECT *', 'WHERE', 'ORDER BY', 'COUNT(*)', 'LIMIT 100'].map(snippet => (
            <button
              key={snippet}
              onClick={() => insertSnippet(snippet)}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 border border-white/10 transition-colors"
            >
              {snippet}
            </button>
          ))}
        </div>
      </div>

      {/* Code Textarea */}
      <div className="relative flex-1 min-h-[120px] max-h-[220px]">
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="w-full h-full min-h-[120px] bg-transparent text-slate-100 font-mono text-xs leading-relaxed resize-none focus:outline-none placeholder-slate-600"
          placeholder="Escreva sua consulta SQL aqui (ex: SELECT * FROM clientes)..."
        />
      </div>

      {/* Bottom Action Bar (matching Nocra Card Image 2) */}
      <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>

          <button
            onClick={() => setQuery('')}
            className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-red-400 text-xs flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        </div>

        {/* Execute Button */}
        <button
          onClick={() => onExecute(query)}
          disabled={isLoading || !query.trim()}
          className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-nocra-glow transition-all active:scale-95 disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Executando...' : 'Executar'}</span>
          <span className="text-[10px] opacity-75 font-mono ml-0.5">(Ctrl+Enter)</span>
        </button>
      </div>
    </div>
  );
};
