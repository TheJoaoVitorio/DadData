import { ipcMain, dialog, BrowserWindow } from 'electron';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { DriverManager } from '../../drivers/driver-manager';
import { ExportService } from '../export/export-service';
import { ConnectionConfig, ExportOptions } from '../../shared/types/database';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  const driverManager = DriverManager.getInstance();
  const samplesDir = path.join(process.cwd(), 'samples');

  // Ensure sample databases are ready
  driverManager.ensureSampleDatabases(samplesDir);

  // 1. Connection Management
  ipcMain.handle(IPC_CHANNELS.DB_CONNECT, async (_event, config: ConnectionConfig) => {
    return driverManager.connect(config);
  });

  ipcMain.handle(IPC_CHANNELS.DB_DISCONNECT, async (_event, connectionId: string) => {
    await driverManager.disconnect(connectionId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DB_TEST_CONNECTION, async (_event, config: ConnectionConfig) => {
    return driverManager.testConnection(config);
  });

  ipcMain.handle(IPC_CHANNELS.DB_GET_ACTIVE_CONNECTIONS, async () => {
    return driverManager.listActiveConnections();
  });

  // 2. Metadata & Schema
  ipcMain.handle(IPC_CHANNELS.DB_LIST_TABLES, async (_event, connectionId: string) => {
    return driverManager.listTables(connectionId);
  });

  ipcMain.handle(IPC_CHANNELS.DB_DESCRIBE_TABLE, async (_event, connectionId: string, tableName: string) => {
    return driverManager.describeTable(connectionId, tableName);
  });

  // 3. Queries & CRUD
  ipcMain.handle(IPC_CHANNELS.DB_EXECUTE_QUERY, async (_event, connectionId: string, query: string, options?: any) => {
    return driverManager.executeQuery(connectionId, query, options);
  });

  ipcMain.handle(IPC_CHANNELS.DB_GET_TABLE_DATA, async (_event, connectionId: string, tableName: string) => {
    const config = driverManager.getActiveConnectionConfig(connectionId);
    let query = `SELECT * FROM "${tableName}"`;
    if (config?.type === 'mongodb') {
      query = `db.${tableName}.find()`;
    }
    return driverManager.executeQuery(connectionId, query);
  });

  ipcMain.handle(IPC_CHANNELS.DB_INSERT_ROW, async (_event, connectionId: string, tableName: string, data: Record<string, any>) => {
    return driverManager.insertRow(connectionId, tableName, data);
  });

  ipcMain.handle(
    IPC_CHANNELS.DB_UPDATE_ROW,
    async (_event, connectionId: string, tableName: string, primaryKey: Record<string, any>, changes: Record<string, any>) => {
      return driverManager.updateRow(connectionId, tableName, primaryKey, changes);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.DB_DELETE_ROW,
    async (_event, connectionId: string, tableName: string, primaryKey: Record<string, any>) => {
      return driverManager.deleteRow(connectionId, tableName, primaryKey);
    }
  );

  // 4. Dialogs
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_FILE, async (_event, filters?: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [
        { name: 'All Database Files', extensions: ['db', 'dbf', 'sqlite', 'sqlite3', 'mdb', 'accdb', 'fic', 'nx1', 'fdb'] },
        { name: 'dBase / FoxPro DBF (*.dbf)', extensions: ['dbf'] },
        { name: 'Paradox (*.db)', extensions: ['db'] },
        { name: 'SQLite (*.sqlite, *.db)', extensions: ['sqlite', 'sqlite3', 'db'] },
        { name: 'Microsoft Access (*.mdb, *.accdb)', extensions: ['mdb', 'accdb'] },
        { name: 'HyperFileSQL (*.fic)', extensions: ['fic'] },
        { name: 'NexusDB (*.nx1)', extensions: ['nx1'] },
        { name: 'Firebird (*.fdb)', extensions: ['fdb'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SAVE_FILE, async (_event, defaultName: string, extension: string) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [
        { name: extension.toUpperCase(), extensions: [extension.replace('.', '')] }
      ]
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  // 5. Export
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_TABLE_OR_QUERY,
    async (_event, connectionId: string, options: ExportOptions) => {
      let rows: Record<string, any>[] = [];
      let columns: string[] = [];

      if (options.query) {
        const queryRes = await driverManager.executeQuery(connectionId, options.query);
        rows = queryRes.rows;
        columns = queryRes.columns;
      } else if (options.tableName) {
        const queryRes = await driverManager.executeQuery(connectionId, `SELECT * FROM "${options.tableName}"`);
        rows = queryRes.rows;
        columns = queryRes.columns;
      }

      if (options.format === 'csv') {
        return ExportService.exportToCsv(columns, rows, options);
      } else {
        return ExportService.exportToExcel(columns, rows, options);
      }
    }
  );

  // 6. Samples
  ipcMain.handle(IPC_CHANNELS.SAMPLES_GET_LIST, async () => {
    return driverManager.ensureSampleDatabases(samplesDir);
  });
}
