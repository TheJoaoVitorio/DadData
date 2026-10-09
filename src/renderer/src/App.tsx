import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { SqlEditor } from './components/editor/SqlEditor';
import { DataGrid } from './components/grid/DataGrid';
import { ConnectionDrawer } from './components/connections/ConnectionDrawer';
import { AddRowDrawer } from './components/grid/AddRowDrawer';
import { FloatingAiButton } from './components/layout/FloatingAiButton';
import { StatusBar } from './components/layout/StatusBar';
import { DatabaseIcon } from './components/icons/DatabaseIcon';

import {
  ConnectionConfig,
  TableInfo,
  QueryResult,
  ColumnInfo,
  ExportOptions
} from '@shared/types/database';
import { X, CheckCircle2, AlertCircle, Monitor, Plus, RefreshCw } from 'lucide-react';
import { safeApi, isDesktopElectron } from './services/api-client';

export interface TabItem {
  id: string;
  title: string;
  type: 'query' | 'table' | 'view';
  tableName?: string;
  schema?: string;
  query?: string;
  queryResult?: QueryResult | null;
  columnsMeta?: ColumnInfo[];
  isLoading?: boolean;
}

export const App: React.FC = () => {
  // State
  const [activeConnection, setActiveConnection] = useState<ConnectionConfig | null>(null);
  const [savedConnections, setSavedConnections] = useState<ConnectionConfig[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Tabs - each tab encapsulates its own query, queryResult, columnsMeta, and loading state
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      id: 'query_1',
      title: 'Consulta SQL 1',
      type: 'query',
      query: 'SELECT * FROM clients LIMIT 50;',
      queryResult: null,
      columnsMeta: [],
      isLoading: false
    }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('query_1');

  // Splitter & SQL Editor Accordion
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  const [editorHeight, setEditorHeight] = useState(160);
  const isDraggingSplitter = useRef(false);
  const startDragY = useRef(0);
  const startEditorHeight = useRef(0);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSplitter.current = true;
    startDragY.current = e.clientY;
    startEditorHeight.current = editorHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingSplitter.current) return;
      const deltaY = moveEvent.clientY - startDragY.current;
      const newHeight = Math.min(Math.max(startEditorHeight.current + deltaY, 90), 450);
      setEditorHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDraggingSplitter.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Global loading (for connection / schema refreshes)
  const [isLoading, setIsLoading] = useState(false);

  // Drawers
  const [isConnectionDrawerOpen, setIsConnectionDrawerOpen] = useState(false);
  const [isAddRowDrawerOpen, setIsAddRowDrawerOpen] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Initial load
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      const active = await safeApi.getActiveConnections();
      if (active && active.length > 0) {
        setSavedConnections(active);
        await handleConnect(active[0]);
      }
    } catch (err: any) {
      console.warn('Initial connection notice:', err);
    }
  };

  // Helper to load table data and metadata into a specific tab
  const loadTableDataForTab = async (tabId: string, tableName: string, connId: string) => {
    setTabs(prev =>
      prev.map(t => (t.id === tabId ? { ...t, isLoading: true } : t))
    );

    try {
      const [meta, data] = await Promise.all([
        safeApi.describeTable(connId, tableName).catch(() => []),
        safeApi.getTableData(connId, tableName)
      ]);

      setTabs(prev =>
        prev.map(t =>
          t.id === tabId
            ? { ...t, columnsMeta: meta, queryResult: data, isLoading: false }
            : t
        )
      );
    } catch (err: any) {
      setTabs(prev =>
        prev.map(t => (t.id === tabId ? { ...t, isLoading: false } : t))
      );
      showToast(`Erro ao carregar dados de ${tableName}: ${err.message}`, 'error');
    }
  };

  const handleConnect = async (config: ConnectionConfig) => {
    setIsLoading(true);
    try {
      const res = await safeApi.connect(config);
      if (res.success) {
        setActiveConnection(config);
        setSavedConnections(prev => {
          const exists = prev.some(c => c.id === config.id);
          return exists ? prev : [...prev, config];
        });

        // Load tables
        const tableList = await safeApi.listTables(config.id);
        setTables(tableList);

        if (tableList.length > 0) {
          const firstTable = tableList[0].name;
          const entity = tableList[0];
          const tabType: 'table' | 'view' = entity.type === 'view' ? 'view' : 'table';
          const tabId = `${tabType}_${firstTable}`;

          setSelectedTable(firstTable);
          setTabs([
            {
              id: 'query_1',
              title: 'Consulta SQL 1',
              type: 'query',
              query: `SELECT * FROM "${firstTable}" LIMIT 100;`,
              queryResult: null,
              columnsMeta: [],
              isLoading: false
            },
            {
              id: tabId,
              title: firstTable,
              type: tabType,
              tableName: firstTable,
              schema: entity.schema,
              queryResult: null,
              columnsMeta: [],
              isLoading: true
            }
          ]);
          setActiveTabId(tabId);
          await loadTableDataForTab(tabId, firstTable, config.id);
        } else {
          setSelectedTable(null);
          setTabs([
            {
              id: 'query_1',
              title: 'Consulta SQL 1',
              type: 'query',
              query: 'SELECT * FROM clients LIMIT 50;',
              queryResult: null,
              columnsMeta: [],
              isLoading: false
            }
          ]);
          setActiveTabId('query_1');
        }

        showToast(`Conectado a ${config.name}! (${tableList.length} tabelas carregadas)`);
      }
    } catch (err: any) {
      showToast(`Erro na conexão: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!activeConnection) return;
    try {
      await safeApi.disconnect(activeConnection.id);
      setActiveConnection(null);
      setTables([]);
      setSelectedTable(null);
      setTabs([
        {
          id: 'query_1',
          title: 'Consulta SQL 1',
          type: 'query',
          query: 'SELECT * FROM clients LIMIT 50;',
          queryResult: null,
          columnsMeta: [],
          isLoading: false
        }
      ]);
      setActiveTabId('query_1');
      showToast('Desconectado do banco.');
    } catch (err: any) {
      showToast(`Erro ao desconectar: ${err.message}`, 'error');
    }
  };

  const handleRefreshSchema = async () => {
    if (!activeConnection) return;
    setIsLoading(true);
    try {
      const tableList = await safeApi.listTables(activeConnection.id);
      setTables(tableList);

      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab && activeTab.tableName) {
        await loadTableDataForTab(activeTab.id, activeTab.tableName, activeConnection.id);
      }
      showToast(`Esquema atualizado: ${tableList.length} tabelas carregadas.`);
    } catch (err: any) {
      showToast(`Erro ao atualizar: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTable = async (tableName: string, connId?: string) => {
    const targetConnId = connId || activeConnection?.id;
    if (!targetConnId) return;

    setSelectedTable(tableName);

    const entity = tables.find(t => t.name === tableName);
    const tabType: 'table' | 'view' = entity?.type === 'view' ? 'view' : 'table';
    const tabId = `${tabType}_${tableName}`;

    // If tab already exists, activate it and load data if not yet loaded
    const existingTab = tabs.find(t => t.id === tabId);
    if (existingTab) {
      setActiveTabId(tabId);
      if (!existingTab.queryResult && !existingTab.isLoading) {
        await loadTableDataForTab(tabId, tableName, targetConnId);
      }
      return;
    }

    // Create new table tab
    const newTab: TabItem = {
      id: tabId,
      title: tableName,
      type: tabType,
      tableName,
      schema: entity?.schema,
      queryResult: null,
      columnsMeta: [],
      isLoading: true
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);

    await loadTableDataForTab(tabId, tableName, targetConnId);
  };

  const handleTabClick = async (tab: TabItem) => {
    setActiveTabId(tab.id);
    if (tab.tableName) {
      setSelectedTable(tab.tableName);
    } else {
      setSelectedTable(null);
    }

    // Lazy load table data if it was never loaded
    if (
      (tab.type === 'table' || tab.type === 'view') &&
      tab.tableName &&
      !tab.queryResult &&
      !tab.isLoading &&
      activeConnection
    ) {
      await loadTableDataForTab(tab.id, tab.tableName, activeConnection.id);
    }
  };

  const handleOpenNewQuery = () => {
    const newId = `query_${Date.now()}`;
    const queryCount = tabs.filter(t => t.type === 'query').length;
    const title = `Consulta SQL ${queryCount + 1}`;
    const defaultQuery = selectedTable
      ? `SELECT * FROM "${selectedTable}" LIMIT 100;`
      : 'SELECT * FROM clients LIMIT 50;';

    const newTab: TabItem = {
      id: newId,
      title,
      type: 'query',
      query: defaultQuery,
      queryResult: null,
      columnsMeta: [],
      isLoading: false
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const nextTabs = tabs.filter(t => t.id !== tabId);
    setTabs(nextTabs);

    if (activeTabId === tabId) {
      const fallbackTab = nextTabs[Math.max(0, tabIndex - 1)] || nextTabs[0];
      setActiveTabId(fallbackTab.id);
      if (fallbackTab.tableName) {
        setSelectedTable(fallbackTab.tableName);
      } else {
        setSelectedTable(null);
      }
    }
  };

  const handleQueryChange = (text: string) => {
    setTabs(prev =>
      prev.map(t => (t.id === activeTabId ? { ...t, query: text } : t))
    );
  };

  const handleExecuteQuery = async (queryText: string) => {
    if (!activeConnection) {
      showToast('Conecte-se a um banco de dados primeiro.', 'error');
      return;
    }

    let targetTabId = activeTabId;
    const targetTab = tabs.find(t => t.id === targetTabId);

    // If active tab is not a query tab, open a new query tab and execute there
    if (targetTab && targetTab.type !== 'query') {
      const newId = `query_${Date.now()}`;
      const queryCount = tabs.filter(t => t.type === 'query').length;
      const newTab: TabItem = {
        id: newId,
        title: `Consulta SQL ${queryCount + 1}`,
        type: 'query',
        query: queryText,
        queryResult: null,
        columnsMeta: [],
        isLoading: true
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newId);
      targetTabId = newId;
    } else {
      setTabs(prev =>
        prev.map(t =>
          t.id === targetTabId
            ? { ...t, query: queryText, isLoading: true }
            : t
        )
      );
    }

    try {
      const res = await safeApi.executeQuery(activeConnection.id, queryText);
      setTabs(prev =>
        prev.map(t =>
          t.id === targetTabId
            ? { ...t, queryResult: res, isLoading: false }
            : t
        )
      );
      showToast(`Consulta executada: ${res.rowCount} registros em ${res.executionTimeMs}ms.`);
    } catch (err: any) {
      setTabs(prev =>
        prev.map(t => (t.id === targetTabId ? { ...t, isLoading: false } : t))
      );
      showToast(`Falha na query: ${err.message}`, 'error');
    }
  };

  const handleUpdateRow = async (primaryKey: Record<string, any>, changes: Record<string, any>) => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    const targetTable = currentTab?.tableName || selectedTable;
    if (!activeConnection || !targetTable) return;

    try {
      const res = await safeApi.updateRow(activeConnection.id, targetTable, primaryKey, changes);
      if (res.success) {
        showToast('Registro atualizado com sucesso (CRUD)!');
        if (currentTab) {
          await loadTableDataForTab(currentTab.id, targetTable, activeConnection.id);
        }
      } else {
        showToast(`Erro ao atualizar: ${res.error || 'Falha'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Erro ao atualizar: ${err.message}`, 'error');
    }
  };

  const handleDeleteRow = async (primaryKey: Record<string, any>) => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    const targetTable = currentTab?.tableName || selectedTable;
    if (!activeConnection || !targetTable) return;

    try {
      const res = await safeApi.deleteRow(activeConnection.id, targetTable, primaryKey);
      if (res.success) {
        showToast('Registro excluído com sucesso (CRUD)!');
        if (currentTab) {
          await loadTableDataForTab(currentTab.id, targetTable, activeConnection.id);
        }
      } else {
        showToast(`Erro ao excluir: ${res.error || 'Falha'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error');
    }
  };

  const handleAddRow = async (rowData: Record<string, any>) => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    const targetTable = currentTab?.tableName || selectedTable;
    if (!activeConnection || !targetTable) return;

    try {
      const res = await safeApi.insertRow(activeConnection.id, targetTable, rowData);
      if (res.success) {
        showToast('Novo registro adicionado com sucesso (CRUD)!');
        if (currentTab) {
          await loadTableDataForTab(currentTab.id, targetTable, activeConnection.id);
        }
      } else {
        showToast(`Erro ao inserir: ${res.error || 'Falha'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Erro ao inserir: ${err.message}`, 'error');
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    const currentTab = tabs.find(t => t.id === activeTabId);
    const hasGridData = currentTab?.queryResult && currentTab.queryResult.rows.length > 0;

    if (!activeConnection && !hasGridData) {
      showToast('Nenhuma conexão ativa ou dados para exportar.', 'error');
      return;
    }

    // Determine intuitive filename based on tab type, query contents, or table
    let baseFilename = 'dados';
    if (currentTab?.type === 'query') {
      const match = currentTab.query?.match(/FROM\s+["`]?([a-zA-Z0-9_.-]+)["`]?/i);
      if (match && match[1]) {
        baseFilename = match[1].replace(/["`]/g, '');
      } else {
        baseFilename = (currentTab.title || 'consulta').toLowerCase().replace(/\s+/g, '_');
      }
    } else if (currentTab?.tableName) {
      baseFilename = currentTab.tableName;
    } else if (selectedTable) {
      baseFilename = selectedTable;
    }

    const cleanFilename = `${baseFilename.toLowerCase().replace(/[^a-z0-9_-]/gi, '_')}_export.${format}`;
    const targetPath = await safeApi.saveFileDialog(cleanFilename, format);
    if (!targetPath) return;

    showToast(`Iniciando exportação para ${format.toUpperCase()}...`);

    try {
      const options: ExportOptions = {
        format,
        targetFilePath: targetPath,
        sheetName: baseFilename.slice(0, 31),
        tableName: currentTab?.type !== 'query' ? (currentTab?.tableName || selectedTable || undefined) : undefined,
        query: currentTab?.type === 'query' ? currentTab.query : undefined,
        rows: currentTab?.queryResult?.rows,
        columns: currentTab?.queryResult?.columns
      };

      const connId = activeConnection ? activeConnection.id : 'default';
      const res = await safeApi.exportData(connId, options);
      if (res.success) {
        showToast(`Exportado com sucesso para ${res.filePath} (${res.rowCount} registros)!`);
      } else {
        showToast(`Falha na exportação: ${res.message || 'Erro'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Erro na exportação: ${err.message}`, 'error');
    }
  };

  const currentTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  return (
    <div className="flex flex-col h-screen overflow-hidden text-zinc-900 bg-[#FACC15]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-6 z-50 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border backdrop-blur-md transition-all ${
            toast.type === 'success'
              ? 'bg-white text-zinc-900 border-amber-300 shadow-amber-500/10'
              : 'bg-white text-rose-900 border-rose-300 shadow-rose-500/10'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-amber-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-500" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Yellow top bar — AbacatePay signature header with connection switcher */}
      <header className="h-12 flex-shrink-0 px-5 flex items-center justify-between gap-4 text-zinc-950 select-none whitespace-nowrap">
        {/* Left: Brand Logo & Status */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-zinc-950 flex items-center justify-center p-1 shadow-xs">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
              <path
                d="M12 2.5C8 2.5 5 7 5 12.5C5 18 8 21.5 12 21.5C16 21.5 19 18 19 12.5C19 7 16 2.5 12 2.5Z"
                stroke="#FACC15"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="14" r="3.2" fill="#FACC15" />
            </svg>
          </div>
          <span className="font-extrabold text-sm tracking-tight text-zinc-950">DadData</span>
          {!isDesktopElectron && (
            <span className="ml-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/40 border border-zinc-950/15">
              Web Sandbox
            </span>
          )}
        </div>

        {/* Center: Active Connection Badge & Switcher */}
        {activeConnection ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 hover:bg-white/80 border border-zinc-950/15 backdrop-blur-xs transition-all shadow-xs">
            <DatabaseIcon type={activeConnection.type} className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs font-bold text-zinc-950 max-w-[240px] truncate">{activeConnection.name}</span>
            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-full font-mono font-extrabold bg-zinc-950 text-amber-300">
              {activeConnection.type}
            </span>
            <button
              onClick={handleRefreshSchema}
              disabled={isLoading || currentTab?.isLoading}
              title="Recarregar Esquema e Tabelas"
              className="p-1 hover:bg-black/10 rounded-full transition-colors text-zinc-800"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading || currentTab?.isLoading ? 'animate-spin text-zinc-950' : ''}`} />
            </button>
          </div>
        ) : (
          <span className="text-xs font-semibold text-zinc-800/80">Nenhum banco de dados conectado</span>
        )}

        {/* Right: New Connection Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsConnectionDrawerOpen(true)}
            className="h-7.5 px-3.5 rounded-full bg-zinc-950 hover:bg-zinc-850 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nova Conexão</span>
          </button>
        </div>
      </header>

      {/* Full workspace container — AbacatePay top curvature (sidebar + content) */}
      <div className="flex-1 flex flex-col min-h-0 rounded-t-[32px] overflow-hidden bg-[#F4F6F8]">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar — flush, full height */}
        <Sidebar
          activeConnection={activeConnection}
          savedConnections={savedConnections}
          tables={tables}
          selectedTable={currentTab?.tableName || selectedTable}
          onSelectTable={handleSelectTable}
          onSwitchConnection={handleConnect}
          onDisconnect={handleDisconnect}
          onOpenNewQuery={handleOpenNewQuery}
          onOpenNewConnection={() => setIsConnectionDrawerOpen(true)}
          onRefreshSchema={handleRefreshSchema}
          isLoading={isLoading}
        />

        {/* Right column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#F4F6F8] pt-3">
          <main className="flex-1 mx-3 mb-2 bg-white rounded-2xl p-3 shadow-xs border border-zinc-200/80 flex flex-col min-h-0 overflow-hidden">
          {/* Tabs Bar */}
          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-zinc-200/80 flex-shrink-0 select-none overflow-x-auto">
            {tabs.map(tab => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => handleTabClick(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    isActive
                      ? 'bg-[#FACC15] text-zinc-950 border border-amber-400 shadow-xs'
                      : 'bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700'
                  }`}
                >
                  {tab.type === 'query' ? (
                    <span className={`font-mono text-[11px] font-bold ${isActive ? 'text-zinc-950' : 'text-amber-600'}`}>&lt;&gt;</span>
                  ) : tab.type === 'view' ? (
                    <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-zinc-950' : 'text-amber-600'}`} fill="none" stroke="currentColor">
                      <rect x="1.5" y="2" width="13" height="12" rx="1.5" strokeWidth="1.3" strokeDasharray="2 1.5" />
                      <line x1="1.5" y1="6" x2="14.5" y2="6" strokeWidth="1.2" />
                      <line x1="5.5" y1="2" x2="5.5" y2="14" strokeWidth="1.2" />
                      <line x1="10.5" y1="2" x2="10.5" y2="14" strokeWidth="1.2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-zinc-950' : 'text-zinc-600'}`} fill="currentColor">
                      <rect x="1.5" y="2" width="13" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                      <line x1="1.5" y1="6" x2="14.5" y2="6" strokeWidth="1.2" />
                      <line x1="1.5" y1="10" x2="14.5" y2="10" strokeWidth="1.2" />
                      <line x1="5.5" y1="2" x2="5.5" y2="14" strokeWidth="1.2" />
                      <line x1="10.5" y1="2" x2="10.5" y2="14" strokeWidth="1.2" />
                    </svg>
                  )}

                  <span>{tab.title}</span>

                  {tab.type !== 'query' && (
                    <span className={`text-[10px] font-mono font-normal ${isActive ? 'text-zinc-800' : 'text-zinc-400'}`}>[all]</span>
                  )}

                  {tabs.length > 1 && (
                    <button
                      onClick={e => handleCloseTab(tab.id, e)}
                      className="hover:opacity-75 p-0.5 rounded-full text-zinc-500 hover:text-zinc-950"
                      title="Fechar aba"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* New Tab Button */}
            <button
              onClick={handleOpenNewQuery}
              className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors"
              title="Nova Consulta SQL (Ctrl+N)"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {currentTab?.type === 'query' && (
              <>
                <SqlEditor
                  query={currentTab.query || ''}
                  onQueryChange={handleQueryChange}
                  onExecute={handleExecuteQuery}
                  isLoading={currentTab.isLoading || false}
                  tableName={selectedTable || undefined}
                  isCollapsed={isEditorCollapsed}
                  onToggleCollapse={() => setIsEditorCollapsed(!isEditorCollapsed)}
                  height={isEditorCollapsed ? undefined : editorHeight}
                />

                {/* Resizable Splitter */}
                {!isEditorCollapsed && (
                  <div
                    onMouseDown={handleSplitterMouseDown}
                    className="h-2 w-full flex items-center justify-center cursor-row-resize select-none my-0.5 hover:bg-amber-100/60 rounded-full transition-colors group flex-shrink-0"
                    title="Arraste para redimensionar o Editor SQL e a Grid de Dados"
                  >
                    <div className="w-12 h-1 rounded-full bg-zinc-300 group-hover:bg-amber-500 transition-colors" />
                  </div>
                )}
              </>
            )}

            {/* Results Grid - Takes all remaining height */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <DataGrid
                title={
                  currentTab?.type === 'query'
                    ? 'Resultados da Consulta'
                    : `Tabela: ${currentTab?.tableName || selectedTable || ''}`
                }
                queryResult={currentTab?.queryResult || null}
                columnsMeta={currentTab?.columnsMeta || []}
                isLoading={currentTab?.isLoading || false}
                onUpdateRow={handleUpdateRow}
                onDeleteRow={handleDeleteRow}
                onOpenAddRow={() => setIsAddRowDrawerOpen(true)}
                onExportCsv={() => handleExport('csv')}
                onExportExcel={() => handleExport('xlsx')}
              />
            </div>
          </div>
        </main>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        activeConnection={activeConnection}
        queryResult={currentTab?.queryResult || null}
        isLoading={currentTab?.isLoading || false}
        selectedTable={currentTab?.tableName || selectedTable}
        onExportCsv={() => handleExport('csv')}
        onExportExcel={() => handleExport('xlsx')}
      />
      </div>

      {/* Floating AI & Quick SQL Assistant Button */}
      <FloatingAiButton
        activeConnection={activeConnection}
        onExecuteQuery={handleExecuteQuery}
        isLoading={currentTab?.isLoading || false}
      />

      {/* Drawers */}
      <ConnectionDrawer
        isOpen={isConnectionDrawerOpen}
        onClose={() => setIsConnectionDrawerOpen(false)}
        onConnect={handleConnect}
      />

      {(currentTab?.tableName || selectedTable) && (
        <AddRowDrawer
          isOpen={isAddRowDrawerOpen}
          onClose={() => setIsAddRowDrawerOpen(false)}
          tableName={currentTab?.tableName || selectedTable || ''}
          columns={currentTab?.queryResult?.columns || []}
          columnsMeta={currentTab?.columnsMeta || []}
          onSave={handleAddRow}
        />
      )}
    </div>
  );
};

export default App;
