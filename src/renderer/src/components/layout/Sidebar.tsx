import React, { useState } from 'react';
import {
  Table as TableIcon,
  Search,
  Database,
  ChevronRight,
  HardDrive,
  FileCode,
  Layers,
  CheckCircle2,
  Trash2,
  Power
} from 'lucide-react';
import { TableInfo, ConnectionConfig } from '@shared/types/database';
import { DatabaseIcon } from '../icons/DatabaseIcon';

interface SidebarProps {
  activeConnection: ConnectionConfig | null;
  savedConnections: ConnectionConfig[];
  tables: TableInfo[];
  selectedTable: string | null;
  onSelectTable: (tableName: string) => void;
  onSwitchConnection: (conn: ConnectionConfig) => void;
  onDisconnect: () => void;
  onOpenNewQuery: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeConnection,
  savedConnections,
  tables,
  selectedTable,
  onSelectTable,
  onSwitchConnection,
  onDisconnect,
  onOpenNewQuery
}) => {
  const [tableSearch, setTableSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'tables' | 'connections'>('tables');

  const filteredTables = tables.filter(t =>
    t.name.toLowerCase().includes(tableSearch.toLowerCase())
  );

  return (
    <aside className="w-72 bg-white/95 backdrop-blur-md rounded-3xl p-4 flex flex-col shadow-nocra-card border border-black/[0.03] select-none">
      {/* Switcher Navigation */}
      <div className="flex bg-slate-100/80 p-1 rounded-2xl mb-3.5">
        <button
          onClick={() => setActiveTab('tables')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'tables'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Tabelas ({tables.length})
        </button>
        <button
          onClick={() => setActiveTab('connections')}
          className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'connections'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Conexões ({savedConnections.length})
        </button>
      </div>

      {activeTab === 'tables' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search Input */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar tabelas..."
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-slate-200/70 focus:outline-none focus:ring-2 focus:ring-purple-400/30 transition-all text-slate-800"
            />
          </div>

          {/* Quick Query Button */}
          <button
            onClick={onOpenNewQuery}
            className="w-full mb-3 py-2 px-3 rounded-2xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 border border-purple-200/50 text-purple-700 text-xs font-semibold flex items-center justify-between transition-all"
          >
            <span className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-purple-600" />
              <span>Novo Editor SQL</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-100/70 text-purple-800 font-mono">
              Ctrl+N
            </span>
          </button>

          {/* Tables List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-1">
            {filteredTables.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                {tables.length === 0
                  ? 'Nenhuma tabela encontrada. Conecte-se a um banco.'
                  : 'Nenhuma tabela corresponde à busca.'}
              </div>
            ) : (
              filteredTables.map(t => {
                const isSelected = selectedTable === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => onSelectTable(t.name)}
                    className={`w-full text-left px-3 py-2 rounded-2xl text-xs flex items-center justify-between group transition-all ${
                      isSelected
                        ? 'bg-[#121217] text-white shadow-sm font-medium'
                        : 'text-slate-700 hover:bg-slate-100/80'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <TableIcon
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isSelected ? 'text-purple-300' : 'text-slate-400 group-hover:text-purple-600'
                        }`}
                      />
                      <span className="truncate font-medium">{t.name}</span>
                    </span>

                    {t.rowCount !== undefined && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                        }`}
                      >
                        {t.rowCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Connections Tab */
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {savedConnections.map(c => {
            const isActive = activeConnection?.id === c.id;
            return (
              <div
                key={c.id}
                onClick={() => onSwitchConnection(c)}
                className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all flex items-center gap-2.5 ${
                  isActive
                    ? 'border-purple-300 bg-purple-50/50 shadow-sm'
                    : 'border-slate-200/70 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <DatabaseIcon type={c.type} className="w-5 h-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-slate-800 truncate">{c.name}</span>
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700">
                      {c.type}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate font-mono">
                    {c.filePath || `${c.host}:${c.port || ''}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Connection Status / Disconnect Pill */}
      {activeConnection && (
        <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate">
            <DatabaseIcon type={activeConnection.type} className="w-5 h-5 flex-shrink-0" />
            <div className="truncate">
              <p className="text-[11px] font-bold text-slate-800 truncate">{activeConnection.name}</p>
              <p className="text-[10px] text-slate-400 capitalize">{activeConnection.type} Driver</p>
            </div>
          </div>

          <button
            onClick={onDisconnect}
            title="Desconectar Banco"
            className="p-1.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
};
