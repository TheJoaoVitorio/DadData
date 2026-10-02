import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { ConnectionConfig, ExportOptions } from '../shared/types/database';

export const api = {
  // Connection methods
  connect: (config: ConnectionConfig) => ipcRenderer.invoke(IPC_CHANNELS.DB_CONNECT, config),
  disconnect: (connectionId: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_DISCONNECT, connectionId),
  testConnection: (config: ConnectionConfig) => ipcRenderer.invoke(IPC_CHANNELS.DB_TEST_CONNECTION, config),
  getActiveConnections: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_ACTIVE_CONNECTIONS),

  // Metadata
  listTables: (connectionId: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_LIST_TABLES, connectionId),
  describeTable: (connectionId: string, tableName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_DESCRIBE_TABLE, connectionId, tableName),

  // Query & CRUD
  executeQuery: (connectionId: string, query: string, options?: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_EXECUTE_QUERY, connectionId, query, options),
  getTableData: (connectionId: string, tableName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_GET_TABLE_DATA, connectionId, tableName),
  insertRow: (connectionId: string, tableName: string, data: Record<string, any>) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_INSERT_ROW, connectionId, tableName, data),
  updateRow: (
    connectionId: string,
    tableName: string,
    primaryKey: Record<string, any>,
    changes: Record<string, any>
  ) => ipcRenderer.invoke(IPC_CHANNELS.DB_UPDATE_ROW, connectionId, tableName, primaryKey, changes),
  deleteRow: (connectionId: string, tableName: string, primaryKey: Record<string, any>) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_ROW, connectionId, tableName, primaryKey),

  // Native File dialogs
  openFileDialog: (filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, filters),
  openDirectoryDialog: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY),
  saveFileDialog: (defaultName: string, ext: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, defaultName, ext),

  // Export
  exportData: (connectionId: string, options: ExportOptions) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_TABLE_OR_QUERY, connectionId, options),

  // Samples
  getSampleDatabases: () => ipcRenderer.invoke(IPC_CHANNELS.SAMPLES_GET_LIST),
};

contextBridge.exposeInMainWorld('api', api);

export type DadDataApi = typeof api;
