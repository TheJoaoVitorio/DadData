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

export class MssqlDriver implements DatabaseDriver {
  readonly type = 'mssql';
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
      databaseName: config.database || 'master',
      serverVersion: 'Microsoft SQL Server 2022 (RTM) - 16.0.1000.6'
    };
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.mockTables.clear();
    this.config = null;
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    if (!config.host) {
      return { success: false, message: 'Server Host/Instance required' };
    }
    return { success: true, message: `Connected to SQL Server instance at ${config.host}` };
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.isConnected) throw new Error('SQL Server driver not connected');

    const tables: TableInfo[] = [];
    for (const [name, data] of this.mockTables.entries()) {
      tables.push({
        name,
        schema: 'dbo',
        type: 'table',
        rowCount: data.rows.length
      });
    }
    return tables;
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    const table = this.mockTables.get(tableName);
    if (!table) throw new Error(`Table dbo.${tableName} not found`);
    return table.columns;
  }

  async executeQuery(query: string, _options?: QueryOptions): Promise<QueryResult> {
    const startTime = performance.now();
    const clean = query.trim();

    const match = clean.match(/FROM\s+["`]?([a-zA-Z0-9_.-]+)["`]?/i);
    let tableName = '';

    if (match) {
      tableName = match[1].replace('dbo.', '');
    } else {
      const keys = Array.from(this.mockTables.keys());
      if (keys.length > 0) tableName = keys[0];
    }

    const table = this.mockTables.get(tableName);
    if (!table) {
      return {
        columns: ['Status', 'Message'],
        rows: [{ Status: 'Done', Message: 'Query executed' }],
        rowCount: 1,
        executionTimeMs: Math.round(performance.now() - startTime),
        statementType: 'OTHER'
      };
    }

    let rows = [...table.rows];
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
    table.rows.push({ Id: newId, ...data });

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
      { name: 'InvoiceId', type: 'int identity(1,1)', isPrimaryKey: true, nullable: false },
      { name: 'InvoiceNumber', type: 'nvarchar(50)', isPrimaryKey: false, nullable: false },
      { name: 'TotalAmount', type: 'money', isPrimaryKey: false, nullable: false },
      { name: 'IssueDate', type: 'datetime2', isPrimaryKey: false, nullable: false },
      { name: 'IsSettled', type: 'bit', isPrimaryKey: false, nullable: false }
    ];

    const rows = [
      { InvoiceId: 10001, InvoiceNumber: 'INV-2024-001', TotalAmount: 18450.00, IssueDate: '2024-03-01 08:30:00', IsSettled: true },
      { InvoiceId: 10002, InvoiceNumber: 'INV-2024-002', TotalAmount: 6200.50, IssueDate: '2024-03-03 14:15:00', IsSettled: false }
    ];

    this.mockTables.set('Invoices', { columns, rows });
  }
}
