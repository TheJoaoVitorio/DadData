import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  Check,
  X,
  Search,
  Clock,
  ArrowUpDown,
  AlertCircle
} from 'lucide-react';
import { QueryResult, ColumnInfo } from '@shared/types/database';
import { NumberTicker } from '../magicui/number-ticker';
import { MagicCard } from '../magicui/magic-card';
import { DotPattern } from '../magicui/dot-pattern';
import { AnimatedGradientText } from '../magicui/animated-gradient-text';

const ROW_HEIGHT = 34; // Pixel height per table row
const OVERSCAN = 12;   // Extra rows rendered above/below visible viewport for ultra-smooth scrolling

interface DataGridProps {
  title: string;
  queryResult: QueryResult | null;
  columnsMeta?: ColumnInfo[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onUpdateRow: (primaryKey: Record<string, any>, changes: Record<string, any>) => Promise<void>;
  onDeleteRow: (primaryKey: Record<string, any>) => Promise<void>;
  onOpenAddRow: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
}

export const DataGrid: React.FC<DataGridProps> = ({
  title,
  queryResult,
  columnsMeta = [],
  isLoading,
  isLoadingMore = false,
  onLoadMore,
  onUpdateRow,
  onDeleteRow,
  onOpenAddRow,
  onExportCsv,
  onExportExcel
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; colName: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // High-performance virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

  // ResizeObserver to detect real container height dynamically
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight || 600);
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Scroll listener throttled via requestAnimationFrame (Zero layout thrashing, 60/120 FPS)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop: currentScrollTop, scrollHeight, clientHeight } = e.currentTarget;

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        setScrollTop(currentScrollTop);
        rafIdRef.current = null;
      });
    }

    // Auto-fetch next batch when approaching bottom (within 400px of virtual end)
    if (scrollHeight - currentScrollTop - clientHeight < 400) {
      if (queryResult?.hasMore && !isLoadingMore && onLoadMore) {
        onLoadMore();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-400 select-none">
        <div className="relative w-12 h-12 mb-3.5">
          <div className="absolute inset-0 rounded-full border-2 border-amber-400/30 animate-ping" />
          <div className="w-12 h-12 border-3 border-zinc-200 border-t-[#FACC15] rounded-full animate-spin" />
        </div>
        <AnimatedGradientText className="text-xs font-bold mb-1">
          <span>Carregando dados da tabela...</span>
        </AnimatedGradientText>
        <p className="text-[11px] text-zinc-400 mt-0.5">Executando consulta e indexando colunas</p>
      </div>
    );
  }

  // DML / Non-SELECT statement execution result view
  if (
    queryResult &&
    ['INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'].includes(queryResult.statementType || '') &&
    (queryResult.columns.length === 0 ||
      (queryResult.columns.length === 1 &&
        (queryResult.columns[0] === 'AFFECTED_ROWS' || queryResult.columns[0] === 'STATUS')))
  ) {
    const isError = queryResult.rows[0]?.STATUS?.toLowerCase().includes('erro');
    return (
      <div className="relative flex-1 flex flex-col items-center justify-center p-6 select-none overflow-hidden">
        <DotPattern className="opacity-25" />
        <MagicCard
          gradientColor={isError ? '#F43F5E' : '#10B981'}
          gradientSize={260}
          className="max-w-md p-8 flex flex-col items-center text-center shadow-lg border-zinc-200/80 rounded-3xl bg-white/95 backdrop-blur-xs"
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-xs border ${
              isError
                ? 'bg-rose-100 text-rose-600 border-rose-300'
                : 'bg-emerald-100 text-emerald-600 border-emerald-300'
            }`}
          >
            {isError ? (
              <AlertCircle className="w-7 h-7 stroke-[2]" />
            ) : (
              <Check className="w-7 h-7 stroke-[2.5]" />
            )}
          </div>
          <h3 className="text-base font-bold text-zinc-900 mb-1.5">
            Comando {queryResult.statementType} executado com sucesso!
          </h3>
          <p className="text-xs text-zinc-600 leading-relaxed mb-4">
            {queryResult.rows[0]?.STATUS ||
              `A operação ${queryResult.statementType} foi processada com sucesso no banco de dados.`}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Linhas afetadas: {queryResult.rowCount}
            </span>
            <span className="text-xs font-mono text-zinc-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {queryResult.executionTimeMs} ms
            </span>
          </div>
        </MagicCard>
      </div>
    );
  }

  if (!queryResult || queryResult.columns.length === 0) {
    return (
      <div className="relative flex-1 flex flex-col items-center justify-center p-6 select-none overflow-hidden">
        <DotPattern className="opacity-30" />
        <MagicCard
          gradientColor="#FACC15"
          gradientSize={240}
          className="max-w-sm p-7 flex flex-col items-center text-center shadow-lg border-zinc-200/80 rounded-3xl bg-white/90 backdrop-blur-xs"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-100/80 border border-amber-300 text-amber-700 flex items-center justify-center mb-3 shadow-xs">
            <FileSpreadsheet className="w-6 h-6 stroke-[1.8]" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900 mb-1">Nenhum dado para exibir</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Selecione uma tabela à esquerda ou execute uma consulta SQL para visualizar os dados no grid.
          </p>
        </MagicCard>
      </div>
    );
  }

  const columns = queryResult.columns;
  let rows = [...queryResult.rows];

  // Primary key detection
  const pkCol =
    columnsMeta.find(c => c.isPrimaryKey)?.name ||
    columns.find(c => ['id', 'codigo', '_rowid', 'account_id', 'client_id'].includes(c.toLowerCase())) ||
    columns[0];

  // Filtering
  if (searchTerm) {
    rows = rows.filter(r =>
      columns.some(col => String(r[col] ?? '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  // Sorting
  if (sortCol) {
    rows.sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }

  const totalRows = rows.length;

  // Virtual Windowing Math: only mount ~35 DOM rows at any time regardless of totalRows
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const endIndex = Math.min(totalRows, startIndex + visibleCount);

  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalRows - endIndex) * ROW_HEIGHT);
  const visibleRows = rows.slice(startIndex, endIndex);

  const handleStartEdit = (rowIdx: number, colName: string, currentVal: any) => {
    setEditingCell({ rowIdx, colName });
    setEditValue(currentVal !== null && currentVal !== undefined ? String(currentVal) : '');
  };

  const handleSaveEdit = async (row: Record<string, any>) => {
    if (!editingCell) return;
    const { colName } = editingCell;
    const pkValue = row[pkCol];
    if (pkValue === undefined) {
      alert('Não foi possível identificar a chave primária da linha para salvar.');
      setEditingCell(null);
      return;
    }

    let parsedVal: any = editValue;
    if (editValue === '') {
      parsedVal = null;
    } else if (!isNaN(Number(editValue)) && !isNaN(parseFloat(editValue))) {
      parsedVal = Number(editValue);
    } else if (editValue.toLowerCase() === 'true') {
      parsedVal = true;
    } else if (editValue.toLowerCase() === 'false') {
      parsedVal = false;
    }

    await onUpdateRow({ [pkCol]: pkValue }, { [colName]: parsedVal });
    setEditingCell(null);
  };

  const handleDelete = async (row: Record<string, any>) => {
    const pkValue = row[pkCol];
    if (pkValue === undefined) {
      alert('Não foi possível identificar a chave primária para exclusão.');
      return;
    }
    if (confirm(`Tem certeza que deseja excluir o registro com ${pkCol} = "${pkValue}"?`)) {
      await onDeleteRow({ [pkCol]: pkValue });
    }
  };

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(colName);
      setSortAsc(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-zinc-200/80 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-bold tracking-tight text-zinc-900">{title}</h2>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300/80 flex items-center gap-1 shadow-xs">
            <NumberTicker value={totalRows} />
            {queryResult.totalCount !== undefined ? (
              <span>de {queryResult.totalCount.toLocaleString()}</span>
            ) : null}
            <span>registros</span>
            {queryResult.hasMore && (
              <span className="text-amber-800 font-extrabold" title="Role para baixo para carregar mais registros automaticamente">+</span>
            )}
          </span>
          {queryResult.executionTimeMs !== undefined && (
            <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500" />
              <NumberTicker value={queryResult.executionTimeMs} />ms
            </span>
          )}
        </div>

        {/* Action Buttons in Pill Format */}
        <div className="flex items-center gap-1.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar dados..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-7 pr-2.5 py-1 bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white text-xs rounded-full border border-zinc-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 focus:outline-none w-44 transition-all font-mono text-zinc-900 placeholder-zinc-400"
            />
          </div>

          {/* Add Row Button */}
          <button
            onClick={onOpenAddRow}
            className="h-7 px-3 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            <span>Adicionar</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={onExportCsv}
            title="Exportar para CSV (Compatível com Excel)"
            className="h-7 px-2.5 rounded-full bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-3 h-3 text-zinc-500" />
            <span>CSV</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={onExportExcel}
            title="Exportar Planilha Excel Formatada (.xlsx)"
            className="h-7 px-2.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3 h-3 text-amber-600" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Virtual Table Scroll Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto rounded-xl border border-zinc-200/80 bg-white shadow-xs relative"
      >
        <table className="w-full text-left border-collapse text-xs">
          {/* Table Header */}
          <thead className="bg-zinc-50 sticky top-0 z-20 border-b border-zinc-200">
            <tr style={{ height: `${ROW_HEIGHT}px` }}>
              <th className="py-2 px-2.5 w-12 text-center text-zinc-400 font-mono text-[10px]">#</th>
              {columns.map(col => {
                const isPk = col === pkCol;
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="py-2 px-2.5 text-zinc-700 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:bg-zinc-100 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>{col}</span>
                      {isPk && (
                        <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold">
                          PK
                        </span>
                      )}
                      <ArrowUpDown className="w-2.5 h-2.5 text-zinc-400 ml-auto opacity-0 group-hover:opacity-100" />
                    </div>
                  </th>
                );
              })}
              <th className="py-2 px-2.5 w-14 text-center text-zinc-400 text-[10px]">Ações</th>
            </tr>
          </thead>

          {/* Virtual Windowed Table Body: Only ~35 DOM rows active at any time */}
          <tbody className="divide-y divide-zinc-100">
            {totalRows === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="text-center py-10 text-zinc-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              <>
                {/* Top Virtual Spacer */}
                {topSpacerHeight > 0 && (
                  <tr style={{ height: `${topSpacerHeight}px` }} aria-hidden="true">
                    <td colSpan={columns.length + 2} className="p-0 border-0 pointer-events-none" />
                  </tr>
                )}

                {/* Visible Rows in Viewport */}
                {visibleRows.map((row, idx) => {
                  const globalRowIdx = startIndex + idx;
                  const isEditing = editingCell?.rowIdx === globalRowIdx;

                  return (
                    <tr
                      key={globalRowIdx}
                      style={{ height: `${ROW_HEIGHT}px` }}
                      className="hover:bg-amber-50/30 transition-colors group"
                    >
                      <td className="py-1 px-2.5 text-center text-zinc-400 font-mono text-[10px]">
                        {globalRowIdx + 1}
                      </td>

                      {columns.map(col => {
                        const isCellEditing = isEditing && editingCell?.colName === col;
                        const val = row[col];

                        return (
                          <td
                            key={col}
                            onDoubleClick={() => handleStartEdit(globalRowIdx, col, val)}
                            className="py-1 px-2.5 text-zinc-800 font-normal relative"
                          >
                            {isCellEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveEdit(row);
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full px-2 py-0.5 bg-white border border-amber-400 rounded-lg text-xs focus:outline-none ring-2 ring-amber-400/20 font-mono text-zinc-900"
                                />
                                <button
                                  onClick={() => handleSaveEdit(row)}
                                  className="p-1 rounded bg-[#FACC15] text-zinc-950 hover:bg-[#EAB308] cursor-pointer"
                                >
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                </button>
                                <button
                                  onClick={() => setEditingCell(null)}
                                  className="p-1 rounded bg-zinc-200 text-zinc-700 hover:bg-zinc-300 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div
                                title="Dê um duplo clique para editar"
                                className="cursor-pointer truncate max-w-[280px] font-mono text-[11px]"
                              >
                                {val === null || val === undefined ? (
                                  <span className="text-zinc-300 italic">null</span>
                                ) : typeof val === 'boolean' ? (
                                  <span
                                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold font-mono ${
                                      val
                                        ? 'bg-amber-100 text-amber-950 border border-amber-300/80'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}
                                  >
                                    {val ? 'TRUE' : 'FALSE'}
                                  </span>
                                ) : (
                                  <span>{String(val)}</span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Delete Action */}
                      <td className="py-1 px-2.5 text-center">
                        <button
                          onClick={() => handleDelete(row)}
                          title="Excluir Registro"
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Bottom Virtual Spacer */}
                {bottomSpacerHeight > 0 && (
                  <tr style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true">
                    <td colSpan={columns.length + 2} className="p-0 border-0 pointer-events-none" />
                  </tr>
                )}
              </>
            )}

            {/* Fetching Next Batch Indicator */}
            {queryResult.hasMore && (
              <tr
                onClick={() => !isLoadingMore && onLoadMore?.()}
                className="bg-amber-50/50 hover:bg-amber-100/60 cursor-pointer transition-colors"
                title="Clique ou role para carregar mais"
              >
                <td colSpan={columns.length + 2} className="py-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-amber-950 font-medium">
                    {isLoadingMore ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span>Carregando próximos registros ({totalRows.toLocaleString()} de {queryResult.totalCount?.toLocaleString() ?? '...'})</span>
                      </>
                    ) : (
                      <span className="text-amber-900 font-semibold">
                        Role para baixo ou clique aqui para carregar mais registros ({totalRows.toLocaleString()} de {queryResult.totalCount?.toLocaleString() ?? '...'})
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!queryResult.hasMore && totalRows > 0 && (
              <tr className="bg-zinc-50/50 border-t border-zinc-200/60">
                <td colSpan={columns.length + 2} className="py-2.5 text-center text-[11px] text-zinc-400 font-mono">
                  ✓ Todos os {totalRows.toLocaleString()} registros foram carregados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Status Bar */}
      <div className="flex items-center justify-between pt-2 px-1 flex-shrink-0 text-xs border-t border-zinc-200/80">
        <p className="text-[11px] text-zinc-500 font-medium">
          {totalRows.toLocaleString()} registros carregados
          {queryResult.totalCount !== undefined ? ` de ${queryResult.totalCount.toLocaleString()} no banco de dados` : ''}
        </p>

        <div className="flex items-center gap-2 text-[11px]">
          {isLoadingMore ? (
            <span className="flex items-center gap-1.5 text-amber-700 font-bold">
              <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              Buscando próximos registros...
            </span>
          ) : queryResult.hasMore ? (
            <span className="text-zinc-400">
              Role a tabela para carregar mais registros automaticamente
            </span>
          ) : (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              ✓ Todos os registros carregados
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataGrid;
