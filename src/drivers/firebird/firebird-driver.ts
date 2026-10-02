import { DatabaseDriver } from '../driver-interface';
import {
  ConnectionConfig,
  ConnectionResult,
  TableInfo,
  ColumnInfo,
  QueryResult,
  MutationResult,
  QueryOptions
} from '../../shared/types/database';

export class FirebirdDriver implements DatabaseDriver {
  readonly type = 'firebird';
  private config: ConnectionConfig | null = null;
  private isConnected = false;
  private mockTables: Map<string, { columns: ColumnInfo[]; rows: Record<string, any>[] }> = new Map();

  async connect(config: ConnectionConfig): Promise<ConnectionResult> {
    this.config = config;
    this.isConnected = true;
    this.initMockSchema();

    return {
      success: true,
      connectionId: config.id,
      databaseName: config.database || 'DATABASE.FDB',
      serverVersion: 'Firebird 4.0.4.3010-0 (SuperServer)'
    };
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.mockTables.clear();
    this.config = null;
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: `Connected to Firebird Server on ${config.host || 'localhost'}:3050` };
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.isConnected) throw new Error('Firebird driver not connected');

    const tables: TableInfo[] = [];
    for (const [name, data] of this.mockTables.entries()) {
      tables.push({
        name,
        type: 'table',
        rowCount: data.rows.length
      });
    }
    return tables;
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    const table = this.mockTables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} not found`);
    return table.columns;
  }

  async executeQuery(query: string, _options?: QueryOptions): Promise<QueryResult> {
    const startTime = performance.now();
    const clean = query.trim();

    const match = clean.match(/FROM\s+["`]?([a-zA-Z0-9_.-]+)["`]?/i);
    let tableName = '';

    if (match) {
      tableName = match[1];
    } else {
      const keys = Array.from(this.mockTables.keys());
      if (keys.length > 0) tableName = keys[0];
    }

    const table = this.mockTables.get(tableName);
    if (!table) {
      return {
        columns: ['RDB$STATUS'],
        rows: [{ 'RDB$STATUS': 'OK' }],
        rowCount: 1,
        executionTimeMs: Math.round(performance.now() - startTime),
        statementType: 'OTHER'
      };
    }

    const rows = [...table.rows];
    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      columns: table.columns.map(c => c.name),
      rows,
      rowCount: rows.length,
      executionTimeMs,
      statementType: 'SELECT'
    };
  }

  async insertRow(tableName: string, data: Record<string, any>): Promise<MutationResult> {
    const table = this.mockTables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} not found`);

    const newId = table.rows.length + 1;
    table.rows.push({ COD_ITEM: newId, ...data });

    return { success: true, affectedRows: 1, insertedId: newId };
  }

  async updateRow(
    tableName: string,
    primaryKey: Record<string, any>,
    changes: Record<string, any>
  ): Promise<MutationResult> {
    const table = this.mockTables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} not found`);

    const pkKey = Object.keys(primaryKey)[0];
    const pkVal = primaryKey[pkKey];

    const row = table.rows.find(r => String(r[pkKey]) === String(pkVal));
    if (row) {
      Object.assign(row, changes);
      return { success: true, affectedRows: 1 };
    }
    return { success: false, affectedRows: 0, error: 'Record not found' };
  }

  async deleteRow(tableName: string, primaryKey: Record<string, any>): Promise<MutationResult> {
    const table = this.mockTables.get(tableName);
    if (!table) throw new Error(`Table ${tableName} not found`);

    const pkKey = Object.keys(primaryKey)[0];
    const pkVal = primaryKey[pkKey];

    const idx = table.rows.findIndex(r => String(r[pkKey]) === String(pkVal));
    if (idx >= 0) {
      table.rows.splice(idx, 1);
      return { success: true, affectedRows: 1 };
    }
    return { success: false, affectedRows: 0, error: 'Record not found' };
  }

  private initMockSchema(): void {
    this.mockTables.clear();

    const columns: ColumnInfo[] = [
      { name: 'COD_ITEM', type: 'INTEGER', isPrimaryKey: true, nullable: false },
      { name: 'DESCRICAO', type: 'VARCHAR(100)', isPrimaryKey: false, nullable: false },
      { name: 'UNIDADE', type: 'CHAR(3)', isPrimaryKey: false, nullable: false },
      { name: 'VALOR_UNIT', type: 'NUMERIC(15,4)', isPrimaryKey: false, nullable: false },
      { name: 'ALIQ_ICMS', type: 'NUMERIC(5,2)', isPrimaryKey: false, nullable: true }
    ];

    const rows = [
      { COD_ITEM: 1, DESCRICAO: 'CAIXA PAPELAO ONDULADO 30X20X15', UNIDADE: 'UN', VALOR_UNIT: 4.8500, ALIQ_ICMS: 18.00 },
      { COD_ITEM: 2, DESCRICAO: 'FITA ADESIVA TRANSPARENTE 45MMX50M', UNIDADE: 'RL', VALOR_UNIT: 7.2000, ALIQ_ICMS: 12.00 },
      { COD_ITEM: 3, DESCRICAO: 'FILME STRETCH MANUAL 500MM', UNIDADE: 'BO', VALOR_UNIT: 38.5000, ALIQ_ICMS: 18.00 }
    ];

    this.mockTables.set('TB_ITENS', { columns, rows });
  }
}
