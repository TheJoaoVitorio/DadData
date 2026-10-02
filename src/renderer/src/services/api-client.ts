import { ConnectionConfig, ExportOptions, QueryResult, TableInfo, ColumnInfo, MutationResult } from '@shared/types/database';

export const isDesktopElectron = typeof window !== 'undefined' && !!window.api;

export const safeApi = {
  connect: async (config: ConnectionConfig) => {
    if (window.api) return window.api.connect(config);
    return { success: true, connectionId: config.id, databaseName: config.name, serverVersion: 'Web Fallback' };
  },

  disconnect: async (connectionId: string) => {
    if (window.api) return window.api.disconnect(connectionId);
    return { success: true };
  },

  testConnection: async (config: ConnectionConfig) => {
    if (window.api) return window.api.testConnection(config);
    return { success: true, message: 'Conexão simulada no navegador (abra via Desktop Electron para modo nativo).' };
  },

  getActiveConnections: async () => {
    if (window.api) return window.api.getActiveConnections();
    return [];
  },

  listTables: async (connectionId: string): Promise<TableInfo[]> => {
    if (window.api) return window.api.listTables(connectionId);
    return [
      { name: 'CLIENTES', type: 'table', rowCount: 5 },
      { name: 'PRODUTOS', type: 'table', rowCount: 12 },
      { name: 'VENDAS', type: 'table', rowCount: 28 }
    ];
  },

  describeTable: async (connectionId: string, tableName: string): Promise<ColumnInfo[]> => {
    if (window.api) return window.api.describeTable(connectionId, tableName);
    return [
      { name: 'CODIGO', type: 'INTEGER', isPrimaryKey: true, nullable: false },
      { name: 'NOME', type: 'VARCHAR(40)', isPrimaryKey: false, nullable: false },
      { name: 'VALOR', type: 'NUMERIC(12,2)', isPrimaryKey: false, nullable: false }
    ];
  },

  executeQuery: async (connectionId: string, query: string, options?: any): Promise<QueryResult> => {
    if (window.api) return window.api.executeQuery(connectionId, query, options);
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

  getTableData: async (connectionId: string, tableName: string): Promise<QueryResult> => {
    if (window.api) return window.api.getTableData(connectionId, tableName);
    return {
      columns: ['CODIGO', 'NOME', 'CIDADE', 'SALDO', 'ATIVO'],
      rows: [
        { CODIGO: 101, NOME: 'Auto Peças Brasil Ltda', CIDADE: 'São Paulo', SALDO: 15420.50, ATIVO: true },
        { CODIGO: 102, NOME: 'Distribuidora Alvorada', CIDADE: 'Curitiba', SALDO: 8920.00, ATIVO: true },
        { CODIGO: 103, NOME: 'Comercial Silva & Cia', CIDADE: 'Belo Horizonte', SALDO: 23150.75, ATIVO: true },
        { CODIGO: 104, NOME: 'Farmácia Central', CIDADE: 'Porto Alegre', SALDO: 4320.10, ATIVO: false },
        { CODIGO: 105, NOME: 'Supermercado Progresso', CIDADE: 'Campinas', SALDO: 45890.00, ATIVO: true }
      ],
      rowCount: 5,
      executionTimeMs: 8,
      statementType: 'SELECT'
    };
  },

  insertRow: async (connectionId: string, tableName: string, data: Record<string, any>): Promise<MutationResult> => {
    if (window.api) return window.api.insertRow(connectionId, tableName, data);
    return { success: true, affectedRows: 1, insertedId: Date.now() };
  },

  updateRow: async (
    connectionId: string,
    tableName: string,
    primaryKey: Record<string, any>,
    changes: Record<string, any>
  ): Promise<MutationResult> => {
    if (window.api) return window.api.updateRow(connectionId, tableName, primaryKey, changes);
    return { success: true, affectedRows: 1 };
  },

  deleteRow: async (connectionId: string, tableName: string, primaryKey: Record<string, any>): Promise<MutationResult> => {
    if (window.api) return window.api.deleteRow(connectionId, tableName, primaryKey);
    return { success: true, affectedRows: 1 };
  },

  openFileDialog: async (filters?: { name: string; extensions: string[] }[]): Promise<string | null> => {
    if (window.api && typeof window.api.openFileDialog === 'function') {
      return window.api.openFileDialog(filters);
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
    if (window.api && typeof window.api.openDirectoryDialog === 'function') {
      return window.api.openDirectoryDialog();
    }
    return prompt('Informe o caminho da pasta de banco de dados:');
  },

  saveFileDialog: async (defaultName: string, ext: string): Promise<string | null> => {
    if (window.api && typeof window.api.saveFileDialog === 'function') {
      return window.api.saveFileDialog(defaultName, ext);
    }
    return defaultName;
  },

  exportData: async (connectionId: string, options: ExportOptions) => {
    if (window.api) return window.api.exportData(connectionId, options);
    return {
      success: true,
      filePath: options.targetFilePath || 'export.csv',
      rowCount: 5,
      fileSizeBytes: 1024,
      message: 'Exportado com sucesso!'
    };
  }
};
