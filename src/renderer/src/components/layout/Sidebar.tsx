import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  Star,
  X,
  RefreshCw,
  Plus,
  Power,
  KeyRound,
  Layers,
  HardDrive,
  Clock,
  History,
  Folder,
  FolderOpen,
  Check,
  Table as LucideTable,
  Eye,
  Database
} from 'lucide-react';
import { TableInfo, ConnectionConfig, ColumnInfo } from '@shared/types/database';
import { DatabaseIcon } from '../icons/DatabaseIcon';
import { safeApi } from '../../services/api-client';

interface SidebarProps {
  activeConnection: ConnectionConfig | null;
  savedConnections: ConnectionConfig[];
  tables: TableInfo[];
  selectedTable: string | null;
  onSelectTable: (tableName: string) => void;
  onSwitchConnection: (conn: ConnectionConfig) => void;
  onDisconnect: () => void;
  onOpenNewQuery: () => void;
  onOpenNewConnection: () => void;
  onRefreshSchema: () => void;
  isLoading?: boolean;
}

// AbacatePay clean Table grid icon
const TableGridIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 16 16" className={`${className} text-[#00F566] flex-shrink-0`} fill="currentColor">
    <rect x="1.5" y="2" width="13" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <line x1="1.5" y1="6" x2="14.5" y2="6" stroke="currentColor" strokeWidth="1.2" />
    <line x1="1.5" y1="10" x2="14.5" y2="10" stroke="currentColor" strokeWidth="1.2" />
    <line x1="5.5" y1="2" x2="5.5" y2="14" stroke="currentColor" strokeWidth="1.2" />
    <line x1="10.5" y1="2" x2="10.5" y2="14" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

// AbacatePay clean View grid icon
const ViewGridIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 16 16" className={`${className} text-emerald-400 flex-shrink-0`} fill="none" stroke="currentColor">
    <rect x="1.5" y="2" width="13" height="12" rx="1.5" strokeWidth="1.3" strokeDasharray="2 1.5" />
    <line x1="1.5" y1="6" x2="14.5" y2="6" strokeWidth="1.2" />
    <line x1="5.5" y1="2" x2="5.5" y2="14" strokeWidth="1.2" />
    <line x1="10.5" y1="2" x2="10.5" y2="14" strokeWidth="1.2" />
  </svg>
);

export const Sidebar: React.FC<SidebarProps> = ({
  activeConnection,
  savedConnections,
  tables,
  selectedTable,
  onSelectTable,
  onSwitchConnection,
  onDisconnect,
  onOpenNewQuery,
  onOpenNewConnection,
  onRefreshSchema,
  isLoading = false
}) => {
  const [activeRail, setActiveRail] = useState<'explorer' | 'pinned' | 'history'>('explorer');
  const [filterText, setFilterText] = useState('');
  const [isConnDropdownOpen, setIsConnDropdownOpen] = useState(false);
  const [pinnedEntities, setPinnedEntities] = useState<string[]>([]);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set(['public', 'main', 'default']));
  const [columnsCache, setColumnsCache] = useState<Record<string, ColumnInfo[]>>({});
  const [loadingColumns, setLoadingColumns] = useState<Record<string, boolean>>({});
  const [isPinnedSectionOpen, setIsPinnedSectionOpen] = useState(true);
  const [isEntitiesSectionOpen, setIsEntitiesSectionOpen] = useState(true);

  useEffect(() => {
    if (!activeConnection) {
      setPinnedEntities([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`daddata_pinned_${activeConnection.id}`);
      if (saved) {
        setPinnedEntities(JSON.parse(saved));
      } else {
        const defaults = tables.slice(0, 2).map(t => t.name);
        setPinnedEntities(defaults);
      }
    } catch {
      setPinnedEntities([]);
    }
  }, [activeConnection?.id, tables.length]);

  const togglePin = (name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = pinnedEntities.includes(name)
      ? pinnedEntities.filter(p => p !== name)
      : [...pinnedEntities, name];
    setPinnedEntities(next);
    if (activeConnection) {
      localStorage.setItem(`daddata_pinned_${activeConnection.id}`, JSON.stringify(next));
    }
  };

  const toggleExpandEntity = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedEntities);
    const isExpanding = !next.has(name);

    if (isExpanding) {
      next.add(name);
      if (!columnsCache[name] && activeConnection) {
        setLoadingColumns(prev => ({ ...prev, [name]: true }));
        try {
          const cols = await safeApi.describeTable(activeConnection.id, name);
          setColumnsCache(prev => ({ ...prev, [name]: cols }));
        } catch (err) {
          console.warn('Failed to load columns for table:', name, err);
        } finally {
          setLoadingColumns(prev => ({ ...prev, [name]: false }));
        }
      }
    } else {
      next.delete(name);
    }
    setExpandedEntities(next);
  };

  const toggleExpandSchema = (schemaName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedSchemas);
    if (next.has(schemaName)) {
      next.delete(schemaName);
    } else {
      next.add(schemaName);
    }
    setExpandedSchemas(next);
  };

  const filteredTables = tables.filter(t =>
    t.name.toLowerCase().includes(filterText.toLowerCase()) ||
    (t.schema && t.schema.toLowerCase().includes(filterText.toLowerCase()))
  );

  const schemasPresent = Array.from(new Set(filteredTables.map(t => t.schema || 'default')));
  const hasMultipleSchemas = schemasPresent.length > 1;

  const isView = (t: TableInfo) => t.type === 'view';
  const pinnedList = tables.filter(t => pinnedEntities.includes(t.name));

  const displayList = activeRail === 'pinned'
    ? filteredTables.filter(t => pinnedEntities.includes(t.name))
    : filteredTables;

  const renderEntityItem = (entity: TableInfo, isPinnedItem = false) => {
    const isSelected = selectedTable === entity.name;
    const isExpanded = expandedEntities.has(entity.name);
    const isItemPinned = pinnedEntities.includes(entity.name);
    const columns = columnsCache[entity.name] || [];
    const isLoadingCols = loadingColumns[entity.name];

    return (
      <div key={entity.name} className="flex flex-col">
        <div
          onClick={() => onSelectTable(entity.name)}
          className={`h-7 px-2 flex items-center justify-between text-xs cursor-pointer group rounded-lg transition-colors select-none ${
            isSelected
              ? 'bg-[#183434] text-[#00F566] font-semibold'
              : 'text-slate-300 hover:bg-[#162A2A] hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={e => toggleExpandEntity(entity.name, e)}
              className="p-0.5 -ml-1 text-[#64837E] hover:text-white transition-transform"
              title="Ver colunas"
            >
              <ChevronRight
                className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90 text-[#00F566]' : ''}`}
              />
            </button>

            {isView(entity) ? <ViewGridIcon /> : <TableGridIcon />}

            <span className="truncate text-[12px]">{entity.name}</span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {entity.rowCount !== undefined && (
              <span className="text-[10px] text-[#64837E] font-mono hidden group-hover:inline-block">
                {entity.rowCount}
              </span>
            )}

            {isPinnedItem ? (
              <button
                onClick={e => togglePin(entity.name, e)}
                title="Desafixar tabela"
                className="opacity-70 hover:opacity-100 p-0.5 text-[#00F566] hover:text-rose-400"
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={e => togglePin(entity.name, e)}
                title={isItemPinned ? 'Desafixar' : 'Fixar no topo'}
                className={`p-0.5 transition-opacity ${
                  isItemPinned
                    ? 'text-[#00F566] opacity-100'
                    : 'text-[#64837E] hover:text-[#00F566] opacity-0 group-hover:opacity-100'
                }`}
              >
                <Star
                  className={`w-3 h-3 ${isItemPinned ? 'fill-[#00F566]' : ''}`}
                />
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-[#1E3B3A] ml-3.5 my-0.5">
            {isLoadingCols ? (
              <div className="text-[11px] text-[#64837E] py-0.5 pl-2 animate-pulse">Carregando colunas...</div>
            ) : columns.length === 0 ? (
              <div className="text-[11px] text-[#64837E] py-0.5 pl-2">Nenhuma coluna detalhada.</div>
            ) : (
              columns.map(col => (
                <div
                  key={col.name}
                  className="flex items-center justify-between text-[11px] py-0.5 px-1.5 rounded hover:bg-white/5 text-[#8EA8A3] hover:text-white"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {col.isPrimaryKey ? (
                      <KeyRound className="w-2.5 h-2.5 text-[#00F566] flex-shrink-0" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2A4D4A] flex-shrink-0" />
                    )}
                    <span className={`truncate ${col.isPrimaryKey ? 'text-[#00F566] font-semibold' : ''}`}>
                      {col.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#64837E] font-mono ml-2 uppercase truncate flex-shrink-0">
                    {col.type}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-80 bg-[#112323] text-slate-300 rounded-3xl flex overflow-hidden shadow-abacate-card border border-[#1E3B3A] select-none z-10">
      {/* 1. Leftmost Activity Rail (AbacatePay Deep Petroleum) */}
      <div className="w-11 bg-[#0C1818] flex flex-col items-center py-3 border-r border-[#1E3B3A] space-y-3.5 flex-shrink-0">
        {/* Explorer icon */}
        <button
          onClick={() => setActiveRail('explorer')}
          title="Tabelas e Entidades"
          className={`p-2 rounded-xl transition-all relative ${
            activeRail === 'explorer'
              ? 'text-[#00F566] bg-white/10 shadow-sm'
              : 'text-[#64837E] hover:text-white hover:bg-white/5'
          }`}
        >
          <Database className="w-4 h-4" />
          {activeRail === 'explorer' && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#00F566] rounded-r" />
          )}
        </button>

        {/* Pinned / Favorites */}
        <button
          onClick={() => setActiveRail('pinned')}
          title="Tabelas Fixadas / Favoritos"
          className={`p-2 rounded-xl transition-all relative ${
            activeRail === 'pinned'
              ? 'text-[#00F566] bg-white/10 shadow-sm'
              : 'text-[#64837E] hover:text-[#00F566] hover:bg-white/5'
          }`}
        >
          <Star className={`w-4 h-4 ${pinnedEntities.length > 0 ? 'fill-[#00F566]/20' : ''}`} />
          {activeRail === 'pinned' && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#00F566] rounded-r" />
          )}
        </button>

        {/* New Query Shortcut */}
        <button
          onClick={() => onOpenNewQuery()}
          title="Novo Editor SQL (Ctrl+N)"
          className="p-2 rounded-xl text-[#64837E] hover:text-[#00F566] hover:bg-white/5 transition-all"
        >
          <Clock className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        {/* Disconnect button at bottom */}
        {activeConnection && (
          <button
            onClick={onDisconnect}
            title="Desconectar banco de dados"
            className="p-2 rounded-xl text-[#64837E] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Power className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Main Sidebar Explorer Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#112323]">
        {/* Header with Connection Dropdown */}
        <div className="p-3 border-b border-[#1E3B3A] relative">
          <div className="flex items-center justify-between gap-1.5">
            <button
              onClick={() => setIsConnDropdownOpen(!isConnDropdownOpen)}
              className="flex-1 min-w-0 text-left px-2 py-1.5 rounded-xl bg-[#162E2E] hover:bg-[#1A3838] border border-[#1E3B3A] transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-2 min-w-0">
                {activeConnection && (
                  <DatabaseIcon type={activeConnection.type} className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="text-xs font-bold text-white truncate">
                  {activeConnection?.filePath
                    ? activeConnection.filePath.split(/[\\/]/).pop()
                    : activeConnection?.name || 'Selecione Conexão'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#64837E] flex-shrink-0 ml-1" />
            </button>

            {/* Refresh Schema Button */}
            <button
              onClick={onRefreshSchema}
              disabled={isLoading || !activeConnection}
              title="Recarregar Esquema"
              className="p-1.5 rounded-xl bg-[#162E2E] hover:bg-[#1A3838] border border-[#1E3B3A] text-[#64837E] hover:text-[#00F566] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#00F566]' : ''}`} />
            </button>
          </div>

          {/* Connection Switcher Dropdown */}
          {isConnDropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsConnDropdownOpen(false)} />
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#162E2E] border border-[#1E3B3A] rounded-2xl p-2 shadow-2xl z-40 space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold uppercase text-[#64837E] tracking-wider">
                  Conexões Salvas
                </div>

                {savedConnections.map(c => {
                  const isActive = activeConnection?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setIsConnDropdownOpen(false);
                        onSwitchConnection(c);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        isActive
                          ? 'bg-[#00F566]/20 text-[#00F566] border border-[#00F566]/40 font-semibold'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <DatabaseIcon type={c.type} className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-black/30 text-[#8EA8A3] font-mono">
                        {c.type}
                      </span>
                    </button>
                  );
                })}

                <div className="pt-1.5 border-t border-[#1E3B3A] mt-1">
                  <button
                    onClick={() => {
                      setIsConnDropdownOpen(false);
                      onOpenNewConnection();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[#00F566] hover:bg-[#00F566]/10 flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Nova Conexão...</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Filter Bar */}
          <div className="relative mt-2.5">
            <input
              type="text"
              placeholder="Filtrar tabelas e views..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="w-full bg-[#0C1818] text-slate-200 placeholder-[#64837E] text-xs px-2.5 py-1.5 pr-7 rounded-xl border border-[#1E3B3A] focus:outline-none focus:border-[#00F566] transition-colors"
            />
            {filterText ? (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64837E] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Filter className="w-3 h-3 text-[#64837E] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Tree Content: PINNED & ENTITIES */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 dark-scroll">
          {/* PINNED Section */}
          {pinnedList.length > 0 && activeRail !== 'pinned' && (
            <div>
              <div
                onClick={() => setIsPinnedSectionOpen(!isPinnedSectionOpen)}
                className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-[#8EA8A3] uppercase tracking-wider cursor-pointer hover:text-white select-none"
              >
                <div className="flex items-center gap-1.5">
                  <ChevronRight
                    className={`w-3 h-3 transition-transform ${isPinnedSectionOpen ? 'rotate-90 text-[#00F566]' : ''}`}
                  />
                  <span>FIXADAS</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#00F566]/15 text-[#00F566] font-mono font-bold">
                    {pinnedList.length}
                  </span>
                </div>
              </div>

              {isPinnedSectionOpen && (
                <div className="mt-1 space-y-0.5">
                  {pinnedList.map(entity => renderEntityItem(entity, true))}
                </div>
              )}
            </div>
          )}

          {/* ENTITIES Section */}
          <div>
            <div
              onClick={() => setIsEntitiesSectionOpen(!isEntitiesSectionOpen)}
              className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-[#8EA8A3] uppercase tracking-wider cursor-pointer hover:text-white select-none"
            >
              <div className="flex items-center gap-1.5">
                <ChevronRight
                  className={`w-3 h-3 transition-transform ${isEntitiesSectionOpen ? 'rotate-90 text-[#00F566]' : ''}`}
                />
                <span>ENTIDADES</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300 font-mono font-normal">
                  {displayList.length}
                </span>
              </div>
            </div>

            {isEntitiesSectionOpen && (
              <div className="mt-1 space-y-0.5">
                {displayList.length === 0 ? (
                  <div className="text-center py-6 text-[#64837E] text-xs">
                    {tables.length === 0
                      ? 'Nenhuma tabela ou conexão ativa.'
                      : 'Nenhuma entidade encontrada no filtro.'}
                  </div>
                ) : hasMultipleSchemas ? (
                  schemasPresent.map(schema => {
                    const schemaEntities = displayList.filter(t => (t.schema || 'default') === schema);
                    if (schemaEntities.length === 0) return null;
                    const isExpandedSchema = expandedSchemas.has(schema);

                    return (
                      <div key={schema} className="mb-2">
                        <div
                          onClick={e => toggleExpandSchema(schema, e)}
                          className="h-6 px-2 flex items-center justify-between text-xs text-[#8EA8A3] hover:text-white cursor-pointer select-none rounded hover:bg-white/5"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <ChevronRight
                              className={`w-3 h-3 transition-transform ${isExpandedSchema ? 'rotate-90 text-[#00F566]' : ''}`}
                            />
                            {isExpandedSchema ? (
                              <FolderOpen className="w-3.5 h-3.5 text-[#00F566] flex-shrink-0" />
                            ) : (
                              <Folder className="w-3.5 h-3.5 text-[#00F566] flex-shrink-0" />
                            )}
                            <span className="font-semibold truncate text-[11px]">{schema}</span>
                          </div>
                          <span className="text-[10px] text-[#64837E] font-mono">{schemaEntities.length}</span>
                        </div>

                        {isExpandedSchema && (
                          <div className="pl-3 space-y-0.5 mt-0.5">
                            {schemaEntities.map(entity => renderEntityItem(entity))}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  displayList.map(entity => renderEntityItem(entity))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Footer Action: New SQL Query Editor */}
        <div className="p-2.5 border-t border-[#1E3B3A]">
          <button
            onClick={onOpenNewQuery}
            className="w-full py-1.5 px-3 rounded-xl bg-[#00F566]/15 hover:bg-[#00F566]/25 border border-[#00F566]/30 text-[#00F566] text-xs font-semibold flex items-center justify-between transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="text-[#00F566] font-mono">&lt;&gt;</span>
              <span>Novo Editor SQL</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#00F566]/20 text-[#00F566] font-mono font-bold">
              Ctrl+N
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};
export default Sidebar;
