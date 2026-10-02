import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { SqlEditor } from './components/editor/SqlEditor';
import { DataGrid } from './components/grid/DataGrid';
import { ConnectionModal } from './components/connections/ConnectionModal';
import { SampleDatabasesModal } from './components/connections/SampleDatabasesModal';
import { AddRowModal } from './components/grid/AddRowModal';
import { FloatingPromptBar } from './components/layout/FloatingPromptBar';

import {
  ConnectionConfig,
  TableInfo,
  QueryResult,
  ColumnInfo,
  ExportOptions
} from '@shared/types/database';
import { Sparkles, Terminal, Table as TableIcon, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface TabItem {
  id: string;
  title: string;
  type: 'query' | 'table';
  tableName?: string;
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

  // Modals
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isSamplesModalOpen, setIsSamplesModalOpen] = useState(false);
  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);

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
      if (window.api) {
        const samples = await window.api.getSampleDatabases();
        if (samples && samples.length > 0) {
          // Auto connect to the first sample (DBF or SQLite)
          const firstSample = samples[0];
          await handleConnect({
            id: `conn_${firstSample.type}`,
            name: firstSample.name,
            type: firstSample.type,
            filePath: firstSample.filePath
          });
        }
      }
    } catch (err: any) {
      console.warn('Initial connection notice:', err);
    }
  };

  const handleConnect = async (config: ConnectionConfig) => {
    setIsLoading(true);
    try {
      const res = await window.api.connect(config);
      if (res.success) {
        setActiveConnection(config);
        setSavedConnections(prev => {
          const exists = prev.some(c => c.id === config.id);
          return exists ? prev : [...prev, config];
        });

        // Load tables
        const tableList = await window.api.listTables(config.id);
        setTables(tableList);

        if (tableList.length > 0) {
          await handleSelectTable(tableList[0].name, config.id);
        } else {
          setQueryResult(null);
          setSelectedTable(null);
        }

        showToast(`Conectado com sucesso a ${config.name}!`);
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
      await window.api.disconnect(activeConnection.id);
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
      const tableList = await window.api.listTables(activeConnection.id);
      setTables(tableList);
      if (selectedTable) {
        await handleSelectTable(selectedTable);
      }
      showToast('Esquema e tabelas atualizados.');
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

    // Add or activate table tab
    const tabId = `table_${tableName}`;
    if (!tabs.some(t => t.id === tabId)) {
      setTabs(prev => [...prev, { id: tabId, title: tableName, type: 'table', tableName }]);
    }
    setActiveTabId(tabId);

    try {
      const [meta, data] = await Promise.all([
        window.api.describeTable(targetConnId, tableName).catch(() => []),
        window.api.getTableData(targetConnId, tableName)
      ]);
      setColumnsMeta(meta);
      setQueryResult(data);
    } catch (err: any) {
      showToast(`Erro ao abrir tabela: ${err.message}`, 'error');
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
      const res = await window.api.executeQuery(activeConnection.id, query);
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
      const res = await window.api.updateRow(activeConnection.id, selectedTable, primaryKey, changes);
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
      const res = await window.api.deleteRow(activeConnection.id, selectedTable, primaryKey);
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
    const res = await window.api.insertRow(activeConnection.id, selectedTable, rowData);
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
    const targetPath = await window.api.saveFileDialog(defaultFilename, format);
    if (!targetPath) return;

    try {
      const options: ExportOptions = {
        format,
        tableName: selectedTable || undefined,
        targetFilePath: targetPath
      };

      const res = await window.api.exportData(activeConnection.id, options);
      if (res.success) {
        showToast(`Exportado com sucesso para ${res.filePath} (${res.rowCount} linhas)!`);
      }
    } catch (err: any) {
      showToast(`Erro na exportação: ${err.message}`, 'error');
    }
  };

  const handleOpenNewQuery = () => {
    const newId = `query_${Date.now()}`;
    setTabs(prev => [...prev, { id: newId, title: `Consulta ${tabs.length + 1}`, type: 'query' }]);
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
    <div className="flex flex-col h-screen overflow-hidden text-slate-800">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-6 z-50 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold border backdrop-blur-md transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50/95 text-emerald-800 border-emerald-200'
              : 'bg-rose-50/95 text-rose-800 border-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        activeConnection={activeConnection}
        onOpenNewConnection={() => setIsConnectionModalOpen(true)}
        onOpenSamples={() => setIsSamplesModalOpen(true)}
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
        />

        {/* Central Workspace Card */}
        <main className="flex-1 bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-nocra-card border border-black/[0.03] flex flex-col min-h-0 overflow-hidden">
          {/* Tabs Bar */}
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 flex-shrink-0 select-none overflow-x-auto">
            {tabs.map(tab => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                    isActive
                      ? 'bg-[#121217] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  {tab.type === 'query' ? (
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <TableIcon className="w-3.5 h-3.5 text-sky-400" />
                  )}
                  <span>{tab.title}</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={e => handleCloseTab(tab.id, e)}
                      className="hover:opacity-75 p-0.5 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleOpenNewQuery}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              title="Nova Aba de Consulta"
            >
              <Terminal className="w-3.5 h-3.5" />
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
              onOpenAddRow={() => setIsAddRowModalOpen(true)}
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
        onOpenAddRow={() => setIsAddRowModalOpen(true)}
        onExportCsv={() => handleExport('csv')}
        onExportExcel={() => handleExport('xlsx')}
        isLoading={isLoading}
      />

      {/* Modals */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        onConnect={handleConnect}
      />

      <SampleDatabasesModal
        isOpen={isSamplesModalOpen}
        onClose={() => setIsSamplesModalOpen(false)}
        onConnectSample={handleConnect}
      />

      {selectedTable && (
        <AddRowModal
          isOpen={isAddRowModalOpen}
          onClose={() => setIsAddRowModalOpen(false)}
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
