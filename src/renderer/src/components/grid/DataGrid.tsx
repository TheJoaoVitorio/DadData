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

interface DataGridProps {
  title: string;
  queryResult: QueryResult | null;
  columnsMeta?: ColumnInfo[];
  isLoading: boolean;
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
  const pageSize = 20;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#64837E]">
        <div className="w-8 h-8 border-3 border-[#E2E8E5] border-t-[#00F566] rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-[#142929]">Carregando dados da tabela...</p>
      </div>
    );
  }

  if (!queryResult || queryResult.columns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-[#64837E]">
        <FileSpreadsheet className="w-12 h-12 mb-3 text-[#A0B5B1] stroke-1" />
        <p className="text-sm font-bold text-[#142929]">Nenhum dado para exibir</p>
        <p className="text-xs text-[#64837E] mt-1">Selecione uma tabela à esquerda ou execute uma consulta SQL.</p>
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
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#E2E8E5] flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight text-[#0C1818]">{title}</h2>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#00F566]/15 text-[#047857] border border-[#00F566]/30">
            {totalRows} registros
          </span>
          {queryResult.executionTimeMs !== undefined && (
            <span className="text-xs font-mono text-[#64837E] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#00F566]" />
              {queryResult.executionTimeMs}ms
            </span>
          )}
        </div>

        {/* Action Buttons in AbacatePay Pill Format */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64837E]" />
            <input
              type="text"
              placeholder="Buscar dados..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-3 py-1.5 bg-[#F8FAF9] hover:bg-[#F2F6F4] focus:bg-white text-xs rounded-full border border-[#D3DDD8] focus:border-[#00F566] focus:outline-none w-48 transition-all font-mono"
            />
          </div>

          {/* Add Row Button */}
          <button
            onClick={onOpenAddRow}
            className="h-8 px-3 rounded-full bg-[#0C1818] hover:bg-[#142929] text-[#00F566] border border-[#1E3B3A] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Adicionar</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={onExportCsv}
            title="Exportar para CSV (Compatível com Excel)"
            className="h-8 px-3 rounded-full bg-white hover:bg-[#F2F6F4] text-[#142929] border border-[#D3DDD8] text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5 text-[#64837E]" />
            <span>CSV</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={onExportExcel}
            title="Exportar Planilha Excel Formatada (.xlsx)"
            className="h-8 px-3 rounded-full bg-[#00F566]/15 hover:bg-[#00F566]/25 text-[#047857] border border-[#00F566]/30 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#047857]" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto rounded-2xl border border-[#E2E8E5] bg-white shadow-sm relative">
        <table className="w-full text-left border-collapse text-xs">
          {/* Table Header */}
          <thead className="bg-[#F2F6F4] sticky top-0 z-10 border-b border-[#E2E8E5]">
            <tr>
              <th className="py-2.5 px-3 w-12 text-center text-[#64837E] font-mono text-[10px]">#</th>
              {columns.map(col => {
                const isPk = col === pkCol;
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="py-2.5 px-3 text-[#142929] font-bold uppercase tracking-wider text-[11px] cursor-pointer hover:bg-[#E5ECE9] transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col}</span>
                      {isPk && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#00F566]/20 text-[#047857] border border-[#00F566]/40 font-bold">
                          PK
                        </span>
                      )}
                      <ArrowUpDown className="w-3 h-3 text-[#64837E] ml-auto opacity-0 group-hover:opacity-100" />
                    </div>
                  </th>
                );
              })}
              <th className="py-2.5 px-3 w-16 text-center text-[#64837E]">Ações</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[#E2E8E5]">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="text-center py-10 text-[#64837E]">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, rIdx) => {
                const globalRowIdx = (currentPage - 1) * pageSize + rIdx;
                return (
                  <tr
                    key={rIdx}
                    className="hover:bg-[#F2F6F4] transition-colors group"
                  >
                    <td className="py-2 px-3 text-center text-[#8EA8A3] font-mono text-[11px]">
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
                          className="py-2 px-3 text-[#142929] font-normal relative"
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
                                className="w-full px-2 py-1 bg-white border border-[#00F566] rounded-lg text-xs focus:outline-none ring-2 ring-[#00F566]/20 font-mono"
                              />
                              <button
                                onClick={() => handleSaveEdit(row)}
                                className="p-1 rounded bg-[#00F566] text-[#0C1818] hover:bg-[#00DF61]"
                              >
                                <Check className="w-3 h-3 stroke-[2.5]" />
                              </button>
                              <button
                                onClick={() => setEditingCell(null)}
                                className="p-1 rounded bg-[#E2E8E5] text-[#142929] hover:bg-[#D3DDD8]"
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
                                <span className="text-[#A0B5B1] italic">null</span>
                              ) : typeof val === 'boolean' ? (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                                    val
                                      ? 'bg-[#00F566]/20 text-[#047857] border border-[#00F566]/30'
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
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDelete(row)}
                        title="Excluir Registro"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-[#8EA8A3] hover:text-rose-600 hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2.5 px-2 flex-shrink-0">
          <p className="text-xs text-[#64837E] font-medium">
            Página {currentPage} de {totalPages} ({totalRows} itens no total)
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-full bg-white hover:bg-[#F2F6F4] text-[#142929] border border-[#D3DDD8] text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-full bg-white hover:bg-[#F2F6F4] text-[#142929] border border-[#D3DDD8] text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default DataGrid;
