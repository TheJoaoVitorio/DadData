import { ipcMain, dialog, BrowserWindow } from 'electron';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { DriverManager } from '../../drivers/driver-manager';
import { ExportService } from '../export/export-service';
import { ConnectionConfig, ExportOptions } from '../../shared/types/database';

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  const driverManager = DriverManager.getInstance();

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
  ipcMain.handle(IPC_CHANNELS.DB_LIST_DATABASES, async (_event, config: ConnectionConfig) => {
    return driverManager.listDatabases(config);
  });

  ipcMain.handle(IPC_CHANNELS.DB_LIST_TABLES, async (_event, connectionId: string) => {
    return driverManager.listTables(connectionId);
  });

  ipcMain.handle(IPC_CHANNELS.DB_DESCRIBE_TABLE, async (_event, connectionId: string, tableName: string, schema?: string) => {
    const qualified = (schema && schema !== 'default' && !tableName.includes('.')) ? `${schema}.${tableName}` : tableName;
    return driverManager.describeTable(connectionId, qualified);
  });

  // 3. Queries & CRUD
  ipcMain.handle(IPC_CHANNELS.DB_EXECUTE_QUERY, async (_event, connectionId: string, query: string, options?: any) => {
    return driverManager.executeQuery(connectionId, query, options);
  });

  ipcMain.handle(
    IPC_CHANNELS.DB_GET_TABLE_DATA,
    async (
      _event,
      connectionId: string,
      tableName: string,
      schema?: string,
      options?: { limit?: number; offset?: number }
    ) => {
      const config = driverManager.getActiveConnectionConfig(connectionId);
      const limit = Math.max(1, options?.limit ?? 300);
      const offset = Math.max(0, options?.offset ?? 0);

      let target = `"${tableName}"`;
      if (schema && schema !== 'default' && !tableName.includes('.')) {
        target = `"${schema}"."${tableName}"`;
      } else if (tableName.includes('.')) {
        target = tableName.split('.').map(p => `"${p}"`).join('.');
      }

      let dataQuery = '';
      let countQuery = '';

      if (config?.type === 'mongodb') {
        dataQuery = `db.${tableName}.find().skip(${offset}).limit(${limit})`;
        countQuery = `db.${tableName}.countDocuments()`;
      } else if (config?.type === 'firebird') {
        dataQuery = `SELECT FIRST ${limit} SKIP ${offset} * FROM ${target};`;
        countQuery = `SELECT COUNT(*) AS "total" FROM ${target};`;
      } else if (config?.type === 'mssql') {
        const mssqlTarget = (schema && schema !== 'default') ? `[${schema}].[${tableName}]` : `[${tableName}]`;
        dataQuery = `SELECT * FROM ${mssqlTarget} ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY;`;
        countQuery = `SELECT COUNT(*) AS total FROM ${mssqlTarget};`;
      } else if (config?.type === 'mysql') {
        dataQuery = `SELECT * FROM ${target} LIMIT ${offset}, ${limit};`;
        countQuery = `SELECT COUNT(*) AS total FROM ${target};`;
      } else {
        // postgres, sqlite, etc.
        dataQuery = `SELECT * FROM ${target} LIMIT ${limit} OFFSET ${offset};`;
        countQuery = `SELECT COUNT(*) AS total FROM ${target};`;
      }

      const dataRes = await driverManager.executeQuery(connectionId, dataQuery, { limit, offset });

      // Attempt to get total count
      let totalCount: number | undefined = undefined;
      try {
        if (countQuery) {
          const countRes = await driverManager.executeQuery(connectionId, countQuery);
          if (countRes.rows && countRes.rows.length > 0) {
            const firstRow = countRes.rows[0];
            const rawVal = Object.values(firstRow)[0];
            if (rawVal !== undefined && rawVal !== null && !isNaN(Number(rawVal))) {
              totalCount = Number(rawVal);
            }
          }
        }
      } catch {
        // Silently ignore if count query fails (e.g. view without count or permission)
      }

      const rowsCount = dataRes.rows.length;
      const hasMore = totalCount !== undefined ? offset + rowsCount < totalCount : rowsCount === limit;

      return {
        ...dataRes,
        rowCount: rowsCount,
        totalCount: totalCount ?? (rowsCount < limit ? offset + rowsCount : undefined),
        hasMore,
        offset,
        limit
      };
    }
  );

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

      // Priority 1: Direct in-memory data (instant export of query results displayed to the user)
      if (options.rows && options.rows.length > 0) {
        rows = options.rows;
        columns =
          options.columns && options.columns.length > 0
            ? options.columns
            : Object.keys(rows[0] || {});
      } else if (options.query) {
        // Priority 2: Re-execute query via driver manager
        const queryRes = await driverManager.executeQuery(connectionId, options.query);
        rows = queryRes.rows;
        columns = queryRes.columns;
      } else if (options.tableName) {
        // Priority 3: Fetch table data
        const config = driverManager.getActiveConnectionConfig(connectionId);
        let q = `SELECT * FROM "${options.tableName}"`;
        if (config?.type === 'mongodb') {
          q = `db.${options.tableName}.find()`;
        }
        const queryRes = await driverManager.executeQuery(connectionId, q);
        rows = queryRes.rows;
        columns = queryRes.columns;
      }

      if (rows.length === 0 && columns.length === 0) {
        throw new Error('Nenhum registro encontrado para exportar.');
      }

      if (options.format === 'csv') {
        return ExportService.exportToCsv(columns, rows, options);
      } else {
        return ExportService.exportToExcel(columns, rows, options);
      }
    }
  );
}
