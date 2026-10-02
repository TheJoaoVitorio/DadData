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

export class MysqlDriver implements DatabaseDriver {
  readonly type = 'mysql';
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
      databaseName: config.database || 'mysql',
      serverVersion: config.version || 'MySQL Community Server 8.0.36'
    };
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.mockTables.clear();
    this.config = null;
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    if (!config.host) {
      return { success: false, message: 'Host is required for MySQL connection' };
    }
    return { success: true, message: `Connected to MySQL at ${config.host}:${config.port || 3306}` };
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.isConnected) throw new Error('MySQL driver not connected');

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
    if (!table) throw new Error(`Table ${tableName} does not exist`);
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
        columns: ['status', 'query'],
        rows: [{ status: 'executed', query: clean }],
        rowCount: 1,
        executionTimeMs: Math.round(performance.now() - startTime),
        statementType: 'OTHER'
      };
    }

    let rows = [...table.rows];

    const whereMatch = clean.match(/WHERE\s+(.+)$/i);
    if (whereMatch) {
      const condition = whereMatch[1].trim();
      const eqMatch = condition.match(/([a-zA-Z0-9_-]+)\s*=\s*['"]?([^'"]+)['"]?/);
      if (eqMatch) {
        const col = eqMatch[1].toLowerCase();
        const val = eqMatch[2].toLowerCase();
        rows = rows.filter(r => {
          const key = Object.keys(r).find(k => k.toLowerCase() === col);
          return key ? String(r[key]).toLowerCase() === val : false;
        });
      }
    }

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
    table.rows.push({ id: newId, ...data });

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

    const productsColumns: ColumnInfo[] = [
      { name: 'product_id', type: 'int unsigned auto_increment', isPrimaryKey: true, nullable: false },
      { name: 'sku', type: 'varchar(64)', isPrimaryKey: false, nullable: false },
      { name: 'product_name', type: 'varchar(255)', isPrimaryKey: false, nullable: false },
      { name: 'unit_price', type: 'decimal(10,2)', isPrimaryKey: false, nullable: false },
      { name: 'stock_quantity', type: 'int', isPrimaryKey: false, nullable: false }
    ];

    const productsRows = [
      { product_id: 1, sku: 'MON-DELL-27', product_name: 'Monitor Dell 27 4K UHD', unit_price: 2899.90, stock_quantity: 42 },
      { product_id: 2, sku: 'TECL-MEC-RGB', product_name: 'Teclado Mecânico Wireless RGB', unit_price: 549.00, stock_quantity: 110 },
      { product_id: 3, sku: 'MOUSE-ERG-01', product_name: 'Mouse Ergonômico Vertical', unit_price: 389.50, stock_quantity: 75 }
    ];

    this.mockTables.set('products', { columns: productsColumns, rows: productsRows });
  }
}
