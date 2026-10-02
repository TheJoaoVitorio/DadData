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

export class PostgresDriver implements DatabaseDriver {
  readonly type = 'postgres';
  private config: ConnectionConfig | null = null;
  private isConnected = false;
  private mockTables: Map<
    string,
    { schema: string; type: 'table' | 'view'; columns: ColumnInfo[]; rows: Record<string, any>[] }
  > = new Map();

  async connect(config: ConnectionConfig): Promise<ConnectionResult> {
    this.config = config;
    this.isConnected = true;
    this.initMockSchema();

    return {
      success: true,
      connectionId: config.id,
      databaseName: config.database || 'postgres',
      serverVersion: config.version || 'PostgreSQL 16.2 (Debian 16.2-1.pgdg120+2)'
    };
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.mockTables.clear();
    this.config = null;
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    if (!config.host) {
      return { success: false, message: 'Host is required for PostgreSQL connection' };
    }
    return { success: true, message: `Successfully connected to PostgreSQL at ${config.host}:${config.port || 5432}` };
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.isConnected) throw new Error('PostgreSQL driver not connected');

    const tables: TableInfo[] = [];
    for (const [name, data] of this.mockTables.entries()) {
      tables.push({
        name,
        schema: data.schema,
        type: data.type,
        rowCount: data.rows.length
      });
    }
    return tables;
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    const cleanName = tableName.includes('.') ? tableName.split('.').pop()! : tableName;
    const table = this.mockTables.get(cleanName);
    if (!table) throw new Error(`Entity ${tableName} does not exist`);
    return table.columns;
  }

  async executeQuery(query: string, _options?: QueryOptions): Promise<QueryResult> {
    const startTime = performance.now();
    const clean = query.trim();

    const match = clean.match(/FROM\s+["`]?([a-zA-Z0-9_.-]+)["`]?/i);
    let tableName = '';

    if (match) {
      tableName = match[1].replace('public.', '');
    } else {
      const keys = Array.from(this.mockTables.keys());
      if (keys.length > 0) tableName = keys[0];
    }

    const table = this.mockTables.get(tableName);
    if (!table) {
      // Return empty result or generic table
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

    const usersColumns: ColumnInfo[] = [
      { name: 'id', type: 'uuid', isPrimaryKey: true, nullable: false },
      { name: 'email', type: 'varchar(255)', isPrimaryKey: false, nullable: false },
      { name: 'full_name', type: 'text', isPrimaryKey: false, nullable: false },
      { name: 'role', type: 'varchar(50)', isPrimaryKey: false, nullable: false },
      { name: 'created_at', type: 'timestamptz', isPrimaryKey: false, nullable: false }
    ];

    const usersRows = [
      { id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', email: 'alexandre@empresa.com.br', full_name: 'Alexandre Silveira', role: 'admin', created_at: '2024-01-10 14:32:00' },
      { id: '2c8e7dae-ccfe-4c3e-8c6e-bc9eacca5cfe', email: 'beatriz.lima@empresa.com.br', full_name: 'Beatriz Lima', role: 'engineer', created_at: '2024-02-15 09:12:00' },
      { id: '3d9f8ebf-dd0f-4d4f-9d7f-cd0fbdde6dgf', email: 'carlos.mendes@empresa.com.br', full_name: 'Carlos Mendes', role: 'analyst', created_at: '2024-03-01 11:45:00' }
    ];

    const auditColumns: ColumnInfo[] = [
      { name: 'log_id', type: 'bigserial', isPrimaryKey: true, nullable: false },
      { name: 'user_id', type: 'uuid', isPrimaryKey: false, nullable: false },
      { name: 'action', type: 'varchar(100)', isPrimaryKey: false, nullable: false },
      { name: 'ip_address', type: 'inet', isPrimaryKey: false, nullable: true },
      { name: 'timestamp', type: 'timestamptz', isPrimaryKey: false, nullable: false }
    ];

    const auditRows = [
      { log_id: 101, user_id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', action: 'DATABASE_BACKUP_INIT', ip_address: '192.168.1.50', timestamp: '2024-04-01 02:00:00' },
      { log_id: 102, user_id: '2c8e7dae-ccfe-4c3e-8c6e-bc9eacca5cfe', action: 'SCHEMA_MIGRATION_V2', ip_address: '192.168.1.75', timestamp: '2024-04-02 18:25:30' }
    ];

    this.mockTables.set('users', {
      schema: 'public',
      type: 'table',
      columns: usersColumns,
      rows: usersRows
    });

    this.mockTables.set('audit_logs', {
      schema: 'public',
      type: 'table',
      columns: auditColumns,
      rows: auditRows
    });

    // View in public schema
    const activeUsersColumns: ColumnInfo[] = [
      { name: 'id', type: 'uuid', isPrimaryKey: true, nullable: false },
      { name: 'email', type: 'varchar(255)', isPrimaryKey: false, nullable: false },
      { name: 'full_name', type: 'text', isPrimaryKey: false, nullable: false },
      { name: 'role', type: 'varchar(50)', isPrimaryKey: false, nullable: false }
    ];
    this.mockTables.set('active_users_view', {
      schema: 'public',
      type: 'view',
      columns: activeUsersColumns,
      rows: usersRows.map(({ created_at, ...rest }) => rest)
    });

    // Analytics schema
    const revenueColumns: ColumnInfo[] = [
      { name: 'month_year', type: 'varchar(7)', isPrimaryKey: true, nullable: false },
      { name: 'total_revenue', type: 'numeric(14,2)', isPrimaryKey: false, nullable: false },
      { name: 'active_subscribers', type: 'integer', isPrimaryKey: false, nullable: false }
    ];
    const revenueRows = [
      { month_year: '2024-01', total_revenue: 125430.00, active_subscribers: 1240 },
      { month_year: '2024-02', total_revenue: 142100.50, active_subscribers: 1390 },
      { month_year: '2024-03', total_revenue: 168900.00, active_subscribers: 1580 }
    ];
    this.mockTables.set('monthly_revenue', {
      schema: 'analytics',
      type: 'table',
      columns: revenueColumns,
      rows: revenueRows
    });

    // Analytics view
    const customerSummaryColumns: ColumnInfo[] = [
      { name: 'category', type: 'varchar(50)', isPrimaryKey: true, nullable: false },
      { name: 'total_customers', type: 'integer', isPrimaryKey: false, nullable: false },
      { name: 'avg_ltv', type: 'numeric(10,2)', isPrimaryKey: false, nullable: false }
    ];
    const customerSummaryRows = [
      { category: 'Enterprise', total_customers: 42, avg_ltv: 24500.00 },
      { category: 'Pro SMB', total_customers: 218, avg_ltv: 4200.00 }
    ];
    this.mockTables.set('customer_summary_view', {
      schema: 'analytics',
      type: 'view',
      columns: customerSummaryColumns,
      rows: customerSummaryRows
    });
  }
}
