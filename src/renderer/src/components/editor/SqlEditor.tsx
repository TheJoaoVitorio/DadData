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
    <div className="rounded-2xl bg-[#112323] text-white p-4 shadow-abacate-card border border-[#1E3B3A] flex flex-col relative overflow-hidden group">
      {/* Editor Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1E3B3A] select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#00F566]" />
          <span className="text-xs font-bold text-white tracking-wide">Editor SQL / NoSQL</span>
        </div>

        {/* Quick Snippets */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['SELECT *', 'WHERE', 'ORDER BY', 'COUNT(*)', 'LIMIT 100'].map(snippet => (
            <button
              key={snippet}
              onClick={() => insertSnippet(snippet)}
              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#183434] hover:bg-[#1E3B3A] text-[#8EA8A3] hover:text-[#00F566] border border-[#1E3B3A] transition-colors"
            >
              {snippet}
            </button>
          ))}
        </div>
      </div>

      {/* Code Textarea - Controlled by Tab State */}
      <div className="relative flex-1 min-h-[110px] max-h-[200px]">
        <textarea
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="w-full h-full min-h-[110px] bg-transparent text-slate-100 font-mono text-xs leading-relaxed resize-none focus:outline-none placeholder-[#64837E]"
          placeholder="Escreva sua consulta SQL aqui (ex: SELECT * FROM clientes)..."
        />
      </div>

      {/* Bottom Action Bar */}
      <div className="pt-3 mt-1 border-t border-[#1E3B3A] flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-[#183434] hover:bg-[#1E3B3A] border border-[#1E3B3A] text-[#8EA8A3] hover:text-white text-xs flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#00F566]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>

          <button
            onClick={() => onQueryChange('')}
            className="px-3 py-1.5 rounded-lg bg-[#183434] hover:bg-[#1E3B3A] border border-[#1E3B3A] text-[#8EA8A3] hover:text-rose-400 text-xs flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        </div>

        {/* AbacatePay Signature Execute Button */}
        <button
          onClick={() => onExecute(query)}
          disabled={isLoading || !query.trim()}
          className="px-5 py-2 rounded-xl bg-[#00F566] hover:bg-[#00DF61] text-[#0C1818] text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:hover:bg-[#00F566]"
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
