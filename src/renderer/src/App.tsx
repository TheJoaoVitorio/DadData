import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { SqlEditor } from './components/editor/SqlEditor';
import { DataGrid } from './components/grid/DataGrid';
import { ConnectionDrawer } from './components/connections/ConnectionDrawer';
import { AddRowDrawer } from './components/grid/AddRowDrawer';
import { FloatingPromptBar } from './components/layout/FloatingPromptBar';
import { StatusBar } from './components/layout/StatusBar';

import {
  ConnectionConfig,
  TableInfo,
  QueryResult,
  ColumnInfo,
  ExportOptions
} from '@shared/types/database';
import { Terminal, Table as TableIcon, X, CheckCircle2, AlertCircle, Monitor, Plus } from 'lucide-react';
import { safeApi, isDesktopElectron } from './services/api-client';

interface TabItem {
  id: string;
  title: string;
  type: 'query' | 'table' | 'view';
  tableName?: string;
  schema?: string;
}

export const App: React.FC = () => {
  // State
  const [activeConnection, setActiveConnection] = useState<ConnectionConfig | null>(null);
  const [savedConnections, setSavedConnections] = useState<ConnectionConfig[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  // Tabs
  const [tabs, setTabs] = useState<TabItem[]>([
    { id: 'query_1', title: 'Consulta SQL 1', type: 'query' }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('query_1');

  // Query & Table Data
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [columnsMeta, setColumnsMeta] = useState<ColumnInfo[]>([]);
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
          await handleSelectTable(tableList[0].name, config.id);
        } else {
          setQueryResult(null);
          setSelectedTable(null);
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
      setQueryResult(null);
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
      if (selectedTable) {
        await handleSelectTable(selectedTable);
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

    setIsLoading(true);
    setSelectedTable(tableName);

    // Identify if table or view
    const entity = tables.find(t => t.name === tableName);
    const tabType: 'table' | 'view' = entity?.type === 'view' ? 'view' : 'table';

    // Add or activate table tab
    const tabId = `${tabType}_${tableName}`;
    if (!tabs.some(t => t.id === tabId)) {
      setTabs(prev => [
        ...prev,
        { id: tabId, title: tableName, type: tabType, tableName, schema: entity?.schema }
      ]);
    }
    setActiveTabId(tabId);

    try {
      const [meta, data] = await Promise.all([
        safeApi.describeTable(targetConnId, tableName).catch(() => []),
        safeApi.getTableData(targetConnId, tableName)
      ]);
      setColumnsMeta(meta);
      setQueryResult(data);
    } catch (err: any) {
      showToast(`Erro ao abrir ${tabType === 'view' ? 'view' : 'tabela'}: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteQuery = async (query: string) => {
    if (!activeConnection) {
      showToast('Conecte-se a um banco de dados primeiro.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await safeApi.executeQuery(activeConnection.id, query);
      setQueryResult(res);
      showToast(`Consulta executada: ${res.rowCount} registros em ${res.executionTimeMs}ms.`);
    } catch (err: any) {
      showToast(`Falha na query: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRow = async (primaryKey: Record<string, any>, changes: Record<string, any>) => {
    if (!activeConnection || !selectedTable) return;
    try {
      const res = await safeApi.updateRow(activeConnection.id, selectedTable, primaryKey, changes);
      if (res.success) {
        showToast('Registro atualizado com sucesso (CRUD)!');
        await handleSelectTable(selectedTable);
      } else {
        showToast(`Erro ao atualizar: ${res.error || 'Falha'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Erro ao atualizar: ${err.message}`, 'error');
    }
  };

  const handleDeleteRow = async (primaryKey: Record<string, any>) => {
    if (!activeConnection || !selectedTable) return;
    try {
      const res = await safeApi.deleteRow(activeConnection.id, selectedTable, primaryKey);
      if (res.success) {
        showToast('Registro excluído com sucesso (CRUD)!');
        await handleSelectTable(selectedTable);
      }
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error');
    }
  };

  const handleAddRow = async (rowData: Record<string, any>) => {
    if (!activeConnection || !selectedTable) return;
    const res = await safeApi.insertRow(activeConnection.id, selectedTable, rowData);
    if (res.success) {
      showToast('Novo registro adicionado com sucesso (CRUD)!');
      await handleSelectTable(selectedTable);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!activeConnection) {
      showToast('Nenhuma conexão ativa para exportar.', 'error');
      return;
    }

    const defaultFilename = `${selectedTable || 'dados'}_export.${format}`;
    const targetPath = await safeApi.saveFileDialog(defaultFilename, format);
    if (!targetPath) return;

    try {
      const options: ExportOptions = {
        format,
        tableName: selectedTable || undefined,
        targetFilePath: targetPath
      };

      const res = await safeApi.exportData(activeConnection.id, options);
      if (res.success) {
        showToast(`Exportado com sucesso para ${res.filePath} (${res.rowCount} linhas)!`);
      }
    } catch (err: any) {
      showToast(`Erro na exportação: ${err.message}`, 'error');
    }
  };

  const handleOpenNewQuery = () => {
    const newId = `query_${Date.now()}`;
    const queryCount = tabs.filter(t => t.type === 'query').length;
    const title = queryCount === 0 ? 'query_1' : `query_${queryCount + 1}`;
    setTabs(prev => [...prev, { id: newId, title, type: 'query' }]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const nextTabs = tabs.filter(t => t.id !== tabId);
    setTabs(nextTabs);
    if (activeTabId === tabId) {
      setActiveTabId(nextTabs[0].id);
    }
  };

  const currentTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  return (
    <div className="flex flex-col h-screen overflow-hidden text-[#0C1818]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-6 z-50 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border backdrop-blur-md transition-all ${
            toast.type === 'success'
              ? 'bg-[#0C1818] text-[#00F566] border-[#00F566]/40 shadow-abacate-glow'
              : 'bg-[#2A0E12] text-rose-300 border-rose-500/40'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#00F566]" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Browser Warning Banner if not running in Desktop Electron */}
      {!isDesktopElectron && (
        <div className="bg-amber-500/10 border-b border-amber-200/60 px-4 py-1.5 flex items-center justify-between text-xs text-amber-900 select-none">
          <div className="flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-amber-700" />
            <span>
              Executando no navegador web. Para ter acesso nativo aos arquivos locais do Windows e Electron, execute: <code className="bg-amber-100 font-mono px-1.5 py-0.5 rounded text-[11px]">npm run dev</code>
            </span>
          </div>
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
            Modo Navegador (Fallback Ativo)
          </span>
        </div>
      )}

      {/* Top Header */}
      <Header
        activeConnection={activeConnection}
        onOpenNewConnection={() => setIsConnectionDrawerOpen(true)}
        onRefreshSchema={handleRefreshSchema}
        isLoading={isLoading}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 px-6 pb-2 flex gap-4 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeConnection={activeConnection}
          savedConnections={savedConnections}
          tables={tables}
          selectedTable={selectedTable}
          onSelectTable={handleSelectTable}
          onSwitchConnection={handleConnect}
          onDisconnect={handleDisconnect}
          onOpenNewQuery={handleOpenNewQuery}
          onOpenNewConnection={() => setIsConnectionDrawerOpen(true)}
          onRefreshSchema={handleRefreshSchema}
          isLoading={isLoading}
        />

        {/* Central Workspace Card */}
        <main className="flex-1 bg-white rounded-3xl p-5 shadow-abacate-card border border-[#E2E8E5] flex flex-col min-h-0 overflow-hidden">
          {/* Tabs Bar */}
          <div className="flex items-center gap-1.5 pb-2.5 mb-3 border-b border-[#E2E8E5] flex-shrink-0 select-none overflow-x-auto">
            {tabs.map(tab => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    if (tab.tableName) setSelectedTable(tab.tableName);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                    isActive
                      ? 'bg-[#0C1818] text-[#00F566] border border-[#1E3B3A] shadow-sm'
                      : 'bg-[#F2F6F4] hover:bg-[#E5ECE9] text-[#142929]'
                  }`}
                >
                  {tab.type === 'query' ? (
                    <span className="font-mono text-[11px] font-bold text-[#00F566]">&lt;&gt;</span>
                  ) : tab.type === 'view' ? (
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor">
                      <rect x="1.5" y="2" width="13" height="12" rx="1.5" strokeWidth="1.3" strokeDasharray="2 1.5" />
                      <line x1="1.5" y1="6" x2="14.5" y2="6" strokeWidth="1.2" />
                      <line x1="5.5" y1="2" x2="5.5" y2="14" strokeWidth="1.2" />
                      <line x1="10.5" y1="2" x2="10.5" y2="14" strokeWidth="1.2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-[#00F566] flex-shrink-0" fill="currentColor">
                      <rect x="1.5" y="2" width="13" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                      <line x1="1.5" y1="6" x2="14.5" y2="6" strokeWidth="1.2" />
                      <line x1="1.5" y1="10" x2="14.5" y2="10" strokeWidth="1.2" />
                      <line x1="5.5" y1="2" x2="5.5" y2="14" strokeWidth="1.2" />
                      <line x1="10.5" y1="2" x2="10.5" y2="14" strokeWidth="1.2" />
                    </svg>
                  )}

                  <span>{tab.title}</span>

                  {tab.type !== 'query' && (
                    <span className="text-[10px] text-[#8EA8A3] font-mono font-normal">[all]</span>
                  )}

                  {tabs.length > 1 && (
                    <button
                      onClick={e => handleCloseTab(tab.id, e)}
                      className="hover:opacity-75 p-0.5 rounded-full text-[#8EA8A3] hover:text-white"
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
              className="p-1.5 rounded-xl hover:bg-[#F2F6F4] text-[#64837E] hover:text-[#0C1818] transition-colors"
              title="Nova Consulta SQL (Ctrl+N)"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-3">
            {currentTab?.type === 'query' && (
              <SqlEditor
                onExecute={handleExecuteQuery}
                isLoading={isLoading}
                tableName={selectedTable || undefined}
              />
            )}

            {/* Results Grid */}
            <DataGrid
              title={
                currentTab?.type === 'query'
                  ? 'Resultados da Consulta'
                  : `Tabela: ${currentTab?.tableName || selectedTable || ''}`
              }
              queryResult={queryResult}
              columnsMeta={columnsMeta}
              isLoading={isLoading}
              onUpdateRow={handleUpdateRow}
              onDeleteRow={handleDeleteRow}
              onOpenAddRow={() => setIsAddRowDrawerOpen(true)}
              onExportCsv={() => handleExport('csv')}
              onExportExcel={() => handleExport('xlsx')}
            />
          </div>
        </main>
      </div>

      {/* Floating Prompt Bar (Signature Nocra design) */}
      <FloatingPromptBar
        activeConnection={activeConnection}
        onExecuteQuery={handleExecuteQuery}
        onOpenAddRow={() => setIsAddRowDrawerOpen(true)}
        onExportCsv={() => handleExport('csv')}
        onExportExcel={() => handleExport('xlsx')}
        isLoading={isLoading}
      />

      {/* Beekeeper Style Status Bar */}
      <StatusBar
        activeConnection={activeConnection}
        queryResult={queryResult}
        isLoading={isLoading}
        selectedTable={selectedTable}
        onExportCsv={() => handleExport('csv')}
        onExportExcel={() => handleExport('xlsx')}
      />

      {/* Drawers (replacing modals) */}
      <ConnectionDrawer
        isOpen={isConnectionDrawerOpen}
        onClose={() => setIsConnectionDrawerOpen(false)}
        onConnect={handleConnect}
      />

      {selectedTable && (
        <AddRowDrawer
          isOpen={isAddRowDrawerOpen}
          onClose={() => setIsAddRowDrawerOpen(false)}
          tableName={selectedTable}
          columns={queryResult?.columns || []}
          columnsMeta={columnsMeta}
          onSave={handleAddRow}
        />
      )}
    </div>
  );
};

export default App;
