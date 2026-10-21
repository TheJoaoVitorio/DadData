import { ConnectionConfig, ExportOptions, QueryResult, TableInfo, ColumnInfo, MutationResult } from '@shared/types/database';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';

export const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
export const isDesktop = isTauri;
export const isDesktopElectron = false;

export const safeApi = {
  connect: async (config: ConnectionConfig) => {
    if (isTauri) {
      return invoke<any>('db_connect', { config });
    }
    return { success: true, connectionId: config.id, databaseName: config.name, serverVersion: 'Web Fallback' };
  },

  disconnect: async (connectionId: string) => {
    if (isTauri) {
      await invoke('db_disconnect', { connectionId });
      return { success: true };
    }
    return { success: true };
  },

  testConnection: async (config: ConnectionConfig) => {
    if (isTauri) {
      return invoke<any>('db_test_connection', { config });
    }
    return { success: true, message: 'Conexão simulada no navegador (abra via Desktop Tauri para motor nativo em Rust).' };
  },

  getActiveConnections: async () => {
    return [];
  },

  listDatabases: async (config: ConnectionConfig): Promise<string[]> => {
    if (isTauri) {
      return invoke<string[]>('db_list_databases', { config });
    }
    throw new Error('A busca de bancos no servidor requer o aplicativo Desktop Tauri para realizar a conexão de rede.');
  },

  listTables: async (connectionId: string): Promise<TableInfo[]> => {
    if (isTauri) {
      return invoke<TableInfo[]>('db_list_tables', { connectionId });
    }
    return [
      { name: 'actor', type: 'table', rowCount: 200, schema: 'public' },
      { name: 'address', type: 'table', rowCount: 603, schema: 'public' },
      { name: 'category', type: 'table', rowCount: 16, schema: 'public' },
      { name: 'city', type: 'table', rowCount: 600, schema: 'public' },
      { name: 'country', type: 'table', rowCount: 109, schema: 'public' },
      { name: 'customer', type: 'table', rowCount: 599, schema: 'public' },
      { name: 'film', type: 'table', rowCount: 1000, schema: 'public' },
      { name: 'film_actor', type: 'table', rowCount: 5462, schema: 'public' },
      { name: 'film_category', type: 'table', rowCount: 1000, schema: 'public' },
      { name: 'inventory', type: 'table', rowCount: 4581, schema: 'public' },
      { name: 'language', type: 'table', rowCount: 6, schema: 'public' },
      { name: 'payment', type: 'table', rowCount: 16049, schema: 'public' },
      { name: 'rental', type: 'table', rowCount: 16044, schema: 'public' },
      { name: 'staff', type: 'table', rowCount: 2, schema: 'public' },
      { name: 'store', type: 'table', rowCount: 2, schema: 'public' },
      { name: 'customer_list', type: 'view', rowCount: 599, schema: 'public' },
      { name: 'film_list', type: 'view', rowCount: 1000, schema: 'public' },
      { name: 'staff_list', type: 'view', rowCount: 2, schema: 'public' },
      { name: 'sales_by_store', type: 'view', rowCount: 2, schema: 'analytics' }
    ];
  },

  describeTable: async (connectionId: string, tableName: string, schema?: string): Promise<ColumnInfo[]> => {
    if (isTauri) {
      return invoke<ColumnInfo[]>('db_describe_table', { connectionId, tableName, schema });
    }
    if (tableName.toLowerCase().includes('customer')) {
      return [
        { name: 'customer_id', type: 'INTEGER', isPrimaryKey: true, nullable: false },
        { name: 'store_id', type: 'TINYINT', isPrimaryKey: false, nullable: false },
        { name: 'first_name', type: 'VARCHAR(45)', isPrimaryKey: false, nullable: false },
        { name: 'last_name', type: 'VARCHAR(45)', isPrimaryKey: false, nullable: false },
        { name: 'email', type: 'VARCHAR(50)', isPrimaryKey: false, nullable: true },
        { name: 'address_id', type: 'SMALLINT', isPrimaryKey: false, nullable: false },
        { name: 'active', type: 'BOOLEAN', isPrimaryKey: false, nullable: false },
        { name: 'create_date', type: 'DATETIME', isPrimaryKey: false, nullable: false }
      ];
    }
    if (tableName.toLowerCase().includes('film')) {
      return [
        { name: 'film_id', type: 'INTEGER', isPrimaryKey: true, nullable: false },
        { name: 'title', type: 'VARCHAR(255)', isPrimaryKey: false, nullable: false },
        { name: 'description', type: 'TEXT', isPrimaryKey: false, nullable: true },
        { name: 'release_year', type: 'YEAR', isPrimaryKey: false, nullable: true },
        { name: 'rental_duration', type: 'TINYINT', isPrimaryKey: false, nullable: false },
        { name: 'rental_rate', type: 'DECIMAL(4,2)', isPrimaryKey: false, nullable: false },
        { name: 'length', type: 'SMALLINT', isPrimaryKey: false, nullable: true },
        { name: 'rating', type: 'VARCHAR(10)', isPrimaryKey: false, nullable: true }
      ];
    }
    return [
      { name: 'id', type: 'INTEGER', isPrimaryKey: true, nullable: false },
      { name: 'name', type: 'VARCHAR(100)', isPrimaryKey: false, nullable: false },
      { name: 'created_at', type: 'TIMESTAMP', isPrimaryKey: false, nullable: false }
    ];
  },

  executeQuery: async (connectionId: string, query: string, _options?: any): Promise<QueryResult> => {
    if (isTauri) {
      return invoke<QueryResult>('db_execute_query', { connectionId, query });
    }
    return {
      columns: ['CODIGO', 'NOME', 'CIDADE', 'SALDO'],
      rows: [
        { CODIGO: 101, NOME: 'Auto Peças Brasil', CIDADE: 'São Paulo', SALDO: 15420.50 },
        { CODIGO: 102, NOME: 'Distribuidora Alvorada', CIDADE: 'Curitiba', SALDO: 8920.00 }
      ],
      rowCount: 2,
      executionTimeMs: 12,
      statementType: 'SELECT'
    };
  },

  getTableData: async (
    connectionId: string,
    tableName: string,
    schema?: string,
    options?: { limit?: number; offset?: number }
  ): Promise<QueryResult> => {
    if (isTauri) {
      return invoke<QueryResult>('db_get_table_data', {
        connectionId,
        tableName,
        schema,
        limit: options?.limit ?? 300,
        offset: options?.offset ?? 0
      });
    }
    const limit = options?.limit ?? 300;
    const offset = options?.offset ?? 0;
    const mockRows = [
      { CODIGO: 101, NOME: 'Auto Peças Brasil Ltda', CIDADE: 'São Paulo', SALDO: 15420.50, ATIVO: true },
      { CODIGO: 102, NOME: 'Distribuidora Alvorada', CIDADE: 'Curitiba', SALDO: 8920.00, ATIVO: true },
      { CODIGO: 103, NOME: 'Comercial Silva & Cia', CIDADE: 'Belo Horizonte', SALDO: 23150.75, ATIVO: true },
      { CODIGO: 104, NOME: 'Farmácia Central', CIDADE: 'Porto Alegre', SALDO: 4320.10, ATIVO: false },
      { CODIGO: 105, NOME: 'Supermercado Progresso', CIDADE: 'Campinas', SALDO: 45890.00, ATIVO: true }
    ];
    const sliced = mockRows.slice(offset, offset + limit);
    return {
      columns: ['CODIGO', 'NOME', 'CIDADE', 'SALDO', 'ATIVO'],
      rows: sliced,
      rowCount: sliced.length,
      totalCount: mockRows.length,
      hasMore: offset + sliced.length < mockRows.length,
      offset,
      limit,
      executionTimeMs: 8,
      statementType: 'SELECT'
    };
  },

  insertRow: async (connectionId: string, tableName: string, data: Record<string, any>): Promise<MutationResult> => {
    if (isTauri) {
      return invoke<MutationResult>('db_insert_row', { connectionId, tableName, schema: null, data });
    }
    return { success: true, affectedRows: 1, insertedId: Date.now().toString() };
  },

  updateRow: async (
    connectionId: string,
    tableName: string,
    primaryKey: Record<string, any>,
    changes: Record<string, any>
  ): Promise<MutationResult> => {
    if (isTauri) {
      return invoke<MutationResult>('db_update_row', { connectionId, tableName, schema: null, primaryKey, changes });
    }
    return { success: true, affectedRows: 1 };
  },

  deleteRow: async (connectionId: string, tableName: string, primaryKey: Record<string, any>): Promise<MutationResult> => {
    if (isTauri) {
      return invoke<MutationResult>('db_delete_row', { connectionId, tableName, schema: null, primaryKey });
    }
    return { success: true, affectedRows: 1 };
  },

  openFileDialog: async (filters?: { name: string; extensions: string[] }[]): Promise<string | null> => {
    if (isTauri) {
      const selected = await openDialog({
        multiple: false,
        directory: false,
        filters
      });
      return selected as string | null;
    }

    // Web Fallback: Create input[type="file"] so it never errors
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      if (filters && filters.length > 0 && filters[0].extensions) {
        input.accept = filters[0].extensions.map(ext => `.${ext}`).join(',');
      }
      input.onchange = e => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          resolve(file.name);
        } else {
          resolve(null);
        }
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  },

  openDirectoryDialog: async (): Promise<string | null> => {
    if (isTauri) {
      const selected = await openDialog({
        directory: true,
        multiple: false
      });
      return selected as string | null;
    }
    return prompt('Informe o caminho da pasta de banco de dados:');
  },

  saveFileDialog: async (defaultName: string, ext: string): Promise<string | null> => {
    if (isTauri) {
      const selected = await saveDialog({
        defaultPath: defaultName,
        filters: [{ name: ext.toUpperCase(), extensions: [ext.replace(/^\./, '')] }]
      });
      return selected;
    }
    return defaultName;
  },

  exportData: async (_connectionId: string, options: ExportOptions) => {
    if (isTauri) {
      return invoke<any>('export_data', { options });
    }

    // Web Fallback: download direct CSV in browser
    if (options.rows && options.rows.length > 0) {
      const cols = options.columns && options.columns.length > 0 ? options.columns : Object.keys(options.rows[0]);
      const header = cols.join(',');
      const rowsLines = options.rows.map(r =>
        cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')
      );
      const csv = '\uFEFF' + [header, ...rowsLines].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = options.targetFilePath || 'export.csv';
      a.click();
      URL.revokeObjectURL(url);
      return {
        success: true,
        filePath: options.targetFilePath || 'export.csv',
        rowCount: options.rows.length,
        fileSizeBytes: blob.size,
        message: 'Download concluído via navegador!'
      };
    }

    return {
      success: true,
      filePath: options.targetFilePath || 'export.csv',
      rowCount: 5,
      fileSizeBytes: 1024,
      message: 'Exportado com sucesso!'
    };
  }
};
