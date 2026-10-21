import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  Check,
  X,
  Search,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { QueryResult, ColumnInfo } from '@shared/types/database';
import { NumberTicker } from '../magicui/number-ticker';
import { MagicCard } from '../magicui/magic-card';
import { DotPattern } from '../magicui/dot-pattern';
import { AnimatedGradientText } from '../magicui/animated-gradient-text';

interface DataGridProps {
  title: string;
  queryResult: QueryResult | null;
  columnsMeta?: ColumnInfo[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  batchSize?: number;
  onLoadMore?: () => void;
  onLoadAll?: () => void;
  onChangeBatchSize?: (newSize: number) => void;
  onRefreshData?: () => void;
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
  batchSize = 50,
  onLoadMore,
  onLoadAll,
  onChangeBatchSize,
  onRefreshData,
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [displayPageSize, setDisplayPageSize] = useState<number>(50);

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

  // Pagination
  const totalRows = rows.length;
  const isAllPages = displayPageSize === -1;
  const totalPages = isAllPages ? 1 : Math.max(1, Math.ceil(totalRows / displayPageSize));
  const paginatedRows = isAllPages ? rows : rows.slice((currentPage - 1) * displayPageSize, currentPage * displayPageSize);

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
              <span className="text-amber-800 font-extrabold" title="Existem mais registros disponíveis no banco para carregar por demanda">+</span>
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
          {/* Batch Selector & On-demand Load More */}
          {onLoadMore && (
            <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-full border border-zinc-200/90 text-xs">
              <span className="text-[10px] text-zinc-500 font-bold px-1.5">Lote:</span>
              {[50, 100, 250, 500].map(size => (
                <button
                  key={size}
                  onClick={() => onChangeBatchSize && onChangeBatchSize(size)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                    (batchSize || 50) === size
                      ? 'bg-zinc-950 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          )}

          {queryResult.hasMore && onLoadMore && (
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              title={`Carregar próximos ${batchSize || 50} registros do banco de dados`}
              className="h-7 px-3 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 text-[11px] font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoadingMore ? (
                <>
                  <div className="w-3 h-3 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Carregando...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>Carregar +{batchSize || 50}</span>
                </>
              )}
            </button>
          )}

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar dados..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-7 pr-2.5 py-1 bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white text-xs rounded-full border border-zinc-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 focus:outline-none w-44 transition-all font-mono text-zinc-900 placeholder-zinc-400"
            />
          </div>

          {/* Add Row Button */}
          <button
            onClick={onOpenAddRow}
            className="h-7 px-3 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 text-[11px] font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95"
          >
            <Plus className="w-3 h-3 stroke-[2.5]" />
            <span>Adicionar</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={onExportCsv}
            title="Exportar para CSV (Compatível com Excel)"
            className="h-7 px-2.5 rounded-full bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-all"
          >
            <Download className="w-3 h-3 text-zinc-500" />
            <span>CSV</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={onExportExcel}
            title="Exportar Planilha Excel Formatada (.xlsx)"
            className="h-7 px-2.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-all"
          >
            <FileSpreadsheet className="w-3 h-3 text-amber-600" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto rounded-xl border border-zinc-200/80 bg-white shadow-xs relative">
        <table className="w-full text-left border-collapse text-xs">
          {/* Table Header */}
          <thead className="bg-zinc-50 sticky top-0 z-10 border-b border-zinc-200">
            <tr>
              <th className="py-2 px-2.5 w-10 text-center text-zinc-400 font-mono text-[10px]">#</th>
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

          {/* Table Body */}
          <tbody className="divide-y divide-zinc-100">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="text-center py-10 text-zinc-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, rIdx) => {
                const globalRowIdx =
                  displayPageSize === -1 ? rIdx : (currentPage - 1) * displayPageSize + rIdx;
                return (
                  <tr
                    key={rIdx}
                    className="hover:bg-amber-50/30 transition-colors group"
                  >
                    <td className="py-1.5 px-2.5 text-center text-zinc-400 font-mono text-[10px]">
                      {globalRowIdx + 1}
                    </td>

                    {columns.map(col => {
                      const isEditing =
                        editingCell?.rowIdx === globalRowIdx && editingCell?.colName === col;
                      const val = row[col];

                      return (
                        <td
                          key={col}
                          onDoubleClick={() => handleStartEdit(globalRowIdx, col, val)}
                          className="py-1.5 px-2.5 text-zinc-800 font-normal relative"
                        >
                          {isEditing ? (
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
                                className="p-1 rounded bg-[#FACC15] text-zinc-950 hover:bg-[#EAB308]"
                              >
                                <Check className="w-3 h-3 stroke-[2.5]" />
                              </button>
                              <button
                                onClick={() => setEditingCell(null)}
                                className="p-1 rounded bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
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
                    <td className="py-1.5 px-2.5 text-center">
                      <button
                        onClick={() => handleDelete(row)}
                        title="Excluir Registro"
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}

            {/* Bottom Row: On-demand Data Loading Banner */}
            {queryResult.hasMore && onLoadMore && (
              <tr className="bg-amber-50/70 hover:bg-amber-100/60 transition-colors">
                <td colSpan={columns.length + 2} className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-xs text-zinc-700 font-medium">
                      Exibindo <strong>{totalRows}</strong>
                      {queryResult.totalCount ? ` de ${queryResult.totalCount.toLocaleString()}` : ''} registros.
                    </span>
                    <button
                      onClick={onLoadMore}
                      disabled={isLoadingMore}
                      className="px-4 py-1.5 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isLoadingMore ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                          <span>Buscando registros no banco de dados...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Carregar mais {batchSize || 50} registros por demanda</span>
                        </>
                      )}
                    </button>
                    {onLoadAll && (!queryResult.totalCount || queryResult.totalCount <= 5000) && (
                      <button
                        onClick={onLoadAll}
                        disabled={isLoadingMore}
                        className="px-3.5 py-1.5 rounded-full bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Carregar todos ({queryResult.totalCount ? queryResult.totalCount.toLocaleString() : 'todos'})
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & On-demand Footer */}
      <div className="flex items-center justify-between pt-2 px-1 flex-shrink-0 text-xs border-t border-zinc-200/80">
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-zinc-500 font-medium">
            {!isAllPages && totalPages > 1 ? `Página ${currentPage} de ${totalPages} • ` : ''}
            {totalRows} registros carregados em memória
            {queryResult.totalCount ? ` (total de ${queryResult.totalCount.toLocaleString()} no banco)` : ''}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
            <span>Visualização:</span>
            {[25, 50, 100, -1].map(sz => (
              <button
                key={sz}
                onClick={() => {
                  setDisplayPageSize(sz);
                  setCurrentPage(1);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                  displayPageSize === sz
                    ? 'bg-amber-200 text-amber-950 border border-amber-300'
                    : 'hover:bg-zinc-100 text-zinc-600'
                }`}
              >
                {sz === -1 ? 'Todos' : sz}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {queryResult.hasMore && onLoadMore && (
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="h-6.5 px-3 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-zinc-950 text-[11px] font-bold flex items-center gap-1 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3 stroke-[2.5]" />
              <span>Carregar +{batchSize || 50} do banco</span>
            </button>
          )}

          {!isAllPages && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-6.5 px-2.5 rounded-full bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-[11px] font-semibold disabled:opacity-40 transition-colors cursor-pointer"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-6.5 px-2.5 rounded-full bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200 text-[11px] font-semibold disabled:opacity-40 transition-colors cursor-pointer"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default DataGrid;
