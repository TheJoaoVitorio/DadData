import React, { useState, useMemo } from 'react';
import {
  Play,
  Copy,
  Trash2,
  Check,
  Terminal,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Table as TableIcon,
  PlusCircle,
  Edit3
} from 'lucide-react';
import { DatabaseType, ColumnInfo } from '../../types/database';
import { BorderBeam } from '../magicui/border-beam';
import { ShinyButton } from '../magicui/shiny-button';
import { validateSql } from '../../utils/sql-validator';
import { formatSql } from '../../utils/sql-formatter';
import {
  generateSelectTemplate,
  generateInsertTemplate,
  generateUpdateTemplate,
  generateDeleteTemplate
} from '../../utils/sql-templates';

interface SqlEditorProps {
  query: string;
  onQueryChange: (query: string) => void;
  onExecute: (query: string) => void;
  isLoading: boolean;
  tableName?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  height?: number;
  dbType?: DatabaseType | string;
  columnsMeta?: ColumnInfo[];
}

export const SqlEditor: React.FC<SqlEditorProps> = ({
  query,
  onQueryChange,
  onExecute,
  isLoading,
  tableName,
  isCollapsed = false,
  onToggleCollapse,
  height,
  dbType,
  columnsMeta = []
}) => {
  const [copied, setCopied] = useState(false);
  const [formatted, setFormatted] = useState(false);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  // Live syntax validation
  const validation = useMemo(() => {
    return validateSql(query, dbType);
  }, [query, dbType]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter: Execute query
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onExecute(query);
    }
    // Ctrl+Shift+F or Alt+Shift+F: Format SQL
    if ((e.ctrlKey || e.metaKey || e.altKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault();
      handleFormatSql();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormatSql = () => {
    if (!query.trim()) return;
    const formattedQuery = formatSql(query, dbType);
    onQueryChange(formattedQuery);
    setFormatted(true);
    setTimeout(() => setFormatted(false), 2000);
  };

  const insertSnippet = (snippet: string) => {
    onQueryChange(query + (query.endsWith(' ') || query === '' ? '' : ' ') + snippet);
  };

  // DML Template Generators
  const handleGenerateDml = (operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE') => {
    const targetTable = tableName || 'tabela';
    let newSql = '';

    switch (operation) {
      case 'SELECT':
        newSql = generateSelectTemplate(targetTable, dbType);
        break;
      case 'INSERT':
        newSql = generateInsertTemplate(targetTable, dbType, columnsMeta);
        break;
      case 'UPDATE':
        newSql = generateUpdateTemplate(targetTable, dbType, columnsMeta);
        break;
      case 'DELETE':
        newSql = generateDeleteTemplate(targetTable, dbType, columnsMeta);
        break;
    }

    onQueryChange(newSql);
  };

  // First line preview for collapsed view
  const firstLinePreview = query
    ? query.trim().split('\n')[0].slice(0, 75) + (query.length > 75 ? '...' : '')
    : 'Nenhuma consulta inserida...';

  // Collapsed View (Accordion mode)
  if (isCollapsed) {
    return (
      <div className="rounded-2xl bg-white text-zinc-900 px-3.5 py-2 shadow-xs border border-zinc-200/90 flex items-center justify-between gap-3 select-none flex-shrink-0 transition-all">
        <div
          onClick={onToggleCollapse}
          className="flex items-center gap-2 cursor-pointer hover:opacity-85 flex-1 min-w-0"
          title="Clique para expandir o Editor SQL"
        >
          <button
            type="button"
            className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
            <Terminal className="w-3.5 h-3.5 text-amber-500" />
            <span>Editor SQL</span>
          </div>

          {/* Dialect Badge */}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
            {validation.dialectName}
          </span>

          <span className="text-[11px] font-mono text-zinc-400 truncate max-w-xl hidden sm:inline">
            {firstLinePreview}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onToggleCollapse}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            Expandir
          </button>

          <ShinyButton
            type="button"
            onClick={() => onExecute(query)}
            disabled={isLoading || !query.trim()}
            className="h-7 px-3 py-0 text-xs font-bold"
          >
            <Play className={`w-3 h-3 fill-current ${isLoading ? 'animate-spin' : ''}`} />
            <span>Executar</span>
          </ShinyButton>
        </div>
      </div>
    );
  }

  // Expanded View
  return (
    <div
      style={height ? { height: `${height}px` } : undefined}
      className={`relative rounded-2xl bg-white text-zinc-900 p-3.5 shadow-xs border border-zinc-200/90 flex flex-col flex-shrink-0 transition-all ${
        !height ? 'h-52' : ''
      }`}
    >
      <BorderBeam size={120} duration={12} delay={3} colorFrom="#f59e0b" colorTo="#ef4444" borderWidth={1.5} />

      {/* Top Header & Actions */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-150 flex-shrink-0">
        <div className="flex items-center gap-2">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
              title="Recolher Editor SQL"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
            <Terminal className="w-3.5 h-3.5 text-amber-500" />
            <span>Editor SQL</span>
          </div>

          {/* Dialect Badge */}
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-900 border border-amber-200/60">
            {validation.dialectName}
          </span>

          {/* Validation Status Pill */}
          {query.trim() && (
            <button
              onClick={() => setShowValidationDetails(!showValidationDetails)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 cursor-pointer transition-all border ${
                validation.status === 'error'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : validation.status === 'warning'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Clique para alternar detalhes da validação de sintaxe"
            >
              {validation.status === 'error' ? (
                <AlertCircle className="w-3 h-3 text-rose-500" />
              ) : validation.status === 'warning' ? (
                <AlertTriangle className="w-3 h-3 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              )}
              <span>{validation.status === 'error' ? 'Erro de Sintaxe' : validation.status === 'warning' ? 'Aviso' : 'Sintaxe OK'}</span>
            </button>
          )}
        </div>

        {/* DML Quick Operations: SELECT, INSERT, UPDATE, DELETE */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          <span className="text-[10px] uppercase font-bold text-zinc-400 mr-1 hidden sm:inline">Operações:</span>

          <button
            type="button"
            onClick={() => handleGenerateDml('SELECT')}
            className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 transition-colors flex items-center gap-1 cursor-pointer"
            title={`Gerar consulta SELECT para ${tableName || 'tabela'} no dialeto ${validation.dialectName}`}
          >
            <TableIcon className="w-2.5 h-2.5" />
            <span>SELECT</span>
          </button>

          <button
            type="button"
            onClick={() => handleGenerateDml('INSERT')}
            className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 transition-colors flex items-center gap-1 cursor-pointer"
            title={`Gerar comando INSERT para ${tableName || 'tabela'} com campos no dialeto ${validation.dialectName}`}
          >
            <PlusCircle className="w-2.5 h-2.5" />
            <span>INSERT</span>
          </button>

          <button
            type="button"
            onClick={() => handleGenerateDml('UPDATE')}
            className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/80 transition-colors flex items-center gap-1 cursor-pointer"
            title={`Gerar comando UPDATE com WHERE no dialeto ${validation.dialectName}`}
          >
            <Edit3 className="w-2.5 h-2.5" />
            <span>UPDATE</span>
          </button>

          <button
            type="button"
            onClick={() => handleGenerateDml('DELETE')}
            className="px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 transition-colors flex items-center gap-1 cursor-pointer"
            title={`Gerar comando DELETE com WHERE no dialeto ${validation.dialectName}`}
          >
            <Trash2 className="w-2.5 h-2.5" />
            <span>DELETE</span>
          </button>

          {/* Quick Keywords */}
          <div className="hidden lg:flex items-center gap-1 pl-1 border-l border-zinc-200 ml-1">
            {['WHERE', 'ORDER BY'].map(kw => (
              <button
                key={kw}
                type="button"
                onClick={() => insertSnippet(kw)}
                className="px-1.5 py-0.5 text-[9px] font-mono text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded transition-colors"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Syntax Details Banner (if warning/error or toggled) */}
      {query.trim() && (validation.status !== 'valid' || showValidationDetails) && (
        <div
          className={`mb-2 px-3 py-1.5 rounded-xl text-xs flex items-start justify-between gap-2 border transition-all ${
            validation.status === 'error'
              ? 'bg-rose-50/90 text-rose-900 border-rose-200'
              : validation.status === 'warning'
              ? 'bg-amber-50/90 text-amber-900 border-amber-200'
              : 'bg-emerald-50/90 text-emerald-900 border-emerald-200'
          }`}
        >
          <div className="flex items-start gap-1.5">
            {validation.status === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            ) : validation.status === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className="font-semibold text-[11px] leading-tight">{validation.message}</p>
              {validation.suggestions && validation.suggestions.length > 0 && (
                <p className="text-[10px] opacity-85 mt-0.5 font-sans">
                  💡 Sugestão: {validation.suggestions.join(' ')}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowValidationDetails(false)}
            className="text-[10px] font-bold text-zinc-400 hover:text-zinc-700 px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Code Textarea */}
      <div className="relative flex-1 min-h-0 bg-zinc-50 border border-zinc-200/80 rounded-xl p-2.5 focus-within:bg-white focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all overflow-hidden flex flex-col">
        <textarea
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="w-full flex-1 bg-transparent text-zinc-900 font-mono text-xs leading-relaxed resize-none focus:outline-none placeholder-zinc-400"
          placeholder={`Escreva sua consulta SQL (${validation.dialectName}). Ex: SELECT * FROM clientes LIMIT 100...`}
        />
      </div>

      {/* Bottom Action Bar */}
      <div className="pt-2 mt-2 border-t border-zinc-150 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {/* Format SQL Button */}
          <button
            type="button"
            onClick={handleFormatSql}
            disabled={!query.trim()}
            title="Formatar consulta SQL de acordo com o dialeto (Atalho: Ctrl+Shift+F)"
            className="px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 border border-zinc-200 text-zinc-700 text-xs flex items-center gap-1.5 transition-colors font-medium cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3 h-3 text-amber-500 ${formatted ? 'rotate-180 text-emerald-600' : ''}`} />
            <span>{formatted ? 'Formatado!' : 'Formatar SQL'}</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-zinc-700 text-xs flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-amber-600" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>

          {/* Clear Button */}
          <button
            onClick={() => onQueryChange('')}
            className="px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-zinc-200 text-zinc-700 text-xs flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Limpar</span>
          </button>
        </div>

        {/* ShinyButton for Execution with Magic UI Shimmer */}
        <ShinyButton
          type="button"
          onClick={() => onExecute(query)}
          disabled={isLoading || !query.trim()}
          className="h-8 px-4 py-0 text-xs font-bold"
        >
          <Play className={`w-3 h-3 fill-current ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? 'Executando...' : 'Executar'}</span>
          <span className="text-[10px] opacity-80 font-mono ml-0.5">(Ctrl+Enter)</span>
        </ShinyButton>
      </div>
    </div>
  );
};

export default SqlEditor;
