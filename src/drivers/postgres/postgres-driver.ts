import pg from 'pg';
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

const getPgClient = (clientConfig: any): pg.Client => {
  const ClientClass = (pg as any).Client || (pg as any).default?.Client || pg;
  return new ClientClass(clientConfig);
};

export class PostgresDriver implements DatabaseDriver {
  readonly type = 'postgres';
  private config: ConnectionConfig | null = null;
  private client: pg.Client | null = null;
  private isConnected = false;

  async connect(config: ConnectionConfig): Promise<ConnectionResult> {
    this.config = config;
    if (this.client) {
      await this.client.end().catch(() => {});
      this.client = null;
      this.isConnected = false;
    }

    const host = config.host || 'localhost';
    const port = config.port || 5432;
    const user = config.user || 'postgres';
    const password = config.password || '';
    const ssl = config.ssl ? { rejectUnauthorized: false } : false;

    let dbName = config.database?.trim();
    let client: pg.Client;

    if (dbName) {
      client = getPgClient({
        host,
        port,
        user,
        password,
        database: dbName,
        connectionTimeoutMillis: 8000,
        ssl
      });
      await client.connect();
    } else {
      // Connect to server default database to allow querying pg_database
      try {
        client = getPgClient({
          host,
          port,
          user,
          password,
          database: 'postgres',
          connectionTimeoutMillis: 8000,
          ssl
        });
        await client.connect();
        dbName = 'postgres';
      } catch (err: any) {
        try {
          client = getPgClient({
            host,
            port,
            user,
            password,
            database: 'template1',
            connectionTimeoutMillis: 8000,
            ssl
          });
          await client.connect();
          dbName = 'template1';
        } catch {
          throw new Error(`Falha ao conectar no servidor PostgreSQL (${host}:${port}): ${err.message}`);
        }
      }
    }

    this.client = client;
    this.isConnected = true;

    const res = await client.query('SELECT version(), current_database();');
    const version = res.rows[0]?.version || 'PostgreSQL';
    const currentDb = res.rows[0]?.current_database || dbName;

    return {
      success: true,
      connectionId: config.id,
      databaseName: currentDb,
      serverVersion: version.split(' on ')[0]
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end().catch(() => {});
      this.client = null;
    }
    this.isConnected = false;
    this.config = null;
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    if (!config.host) {
      return { success: false, message: 'Host é obrigatório para conexão PostgreSQL' };
    }

    const dbName = config.database?.trim() || 'postgres';
    const client = getPgClient({
      host: config.host,
      port: config.port || 5432,
      user: config.user || 'postgres',
      password: config.password || '',
      database: dbName,
      connectionTimeoutMillis: 5000,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    });

    try {
      await client.connect();
      const res = await client.query('SELECT version(), current_database();');
      const version = res.rows[0]?.version || 'PostgreSQL';
      const actualDb = res.rows[0]?.current_database || dbName;
      await client.end().catch(() => {});
      return {
        success: true,
        message: `Conectado com sucesso ao banco "${actualDb}": ${version.split(' on ')[0]}`
      };
    } catch (err: any) {
      return { success: false, message: `Falha ao conectar no PostgreSQL: ${err.message}` };
    }
  }

  async listDatabases(config?: ConnectionConfig): Promise<string[]> {
    const targetConfig = config || this.config;
    if (!targetConfig || !targetConfig.host) {
      throw new Error('Host do servidor PostgreSQL é obrigatório para listar databases.');
    }

    // If client is already connected to this server, use it
    if (this.client && this.isConnected && (!config || (config.host === this.config?.host && config.port === this.config?.port))) {
      const res = await this.client.query(`
        SELECT datname 
        FROM pg_database 
        WHERE datistemplate = false 
        ORDER BY datname ASC;
      `);
      return res.rows.map((r: any) => String(r.datname));
    }

    const tryConnect = async (dbName: string) => {
      const client = getPgClient({
        host: targetConfig.host,
        port: targetConfig.port || 5432,
        user: targetConfig.user || 'postgres',
        password: targetConfig.password || '',
        database: dbName,
        connectionTimeoutMillis: 5000,
        ssl: targetConfig.ssl ? { rejectUnauthorized: false } : false
      });
      await client.connect();
      try {
        const res = await client.query(`
          SELECT datname 
          FROM pg_database 
          WHERE datistemplate = false 
          ORDER BY datname ASC;
        `);
        return res.rows.map((r: any) => String(r.datname));
      } finally {
        await client.end().catch(() => {});
      }
    };

    try {
      return await tryConnect(targetConfig.database?.trim() || 'postgres');
    } catch (err: any) {
      try {
        return await tryConnect('template1');
      } catch {
        throw new Error(`Falha ao buscar databases no PostgreSQL (${targetConfig.host}:${targetConfig.port || 5432}): ${err.message}`);
      }
    }
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.isConnected || !this.client) {
      throw new Error('PostgreSQL driver not connected');
    }

    try {
      // High performance introspection of regular tables, partitioned tables, views, and materialized views
      const res = await this.client.query(`
        SELECT 
          n.nspname AS schema,
          c.relname AS name,
          CASE 
            WHEN c.relkind IN ('v', 'm') THEN 'view'
            ELSE 'table'
          END AS type,
          CASE 
            WHEN c.relkind IN ('v', 'm') THEN NULL
            WHEN c.reltuples < 0 THEN 0
            ELSE c.reltuples::bigint
          END AS row_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
          AND n.nspname NOT LIKE 'pg_temp_%'
          AND n.nspname NOT LIKE 'pg_toast_temp_%'
          AND c.relkind IN ('r', 'p', 'v', 'm')
        ORDER BY n.nspname ASC, c.relname ASC;
      `);

      return res.rows.map((r: any) => ({
        name: String(r.name),
        schema: String(r.schema),
        type: r.type === 'view' ? 'view' : 'table',
        rowCount: r.row_count != null ? Number(r.row_count) : undefined
      }));
    } catch {
      // Fallback query via standard information_schema
      const res = await this.client.query(`
        SELECT 
          table_schema AS schema,
          table_name AS name,
          CASE WHEN table_type = 'VIEW' THEN 'view' ELSE 'table' END AS type
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY table_schema ASC, table_name ASC;
      `);

      return res.rows.map((r: any) => ({
        name: String(r.name),
        schema: String(r.schema),
        type: r.type === 'view' ? 'view' : 'table'
      }));
    }
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    if (!this.isConnected || !this.client) {
      throw new Error('PostgreSQL driver not connected');
    }

    let schema: string | null = null;
    let table = tableName;
    if (tableName.includes('.')) {
      const parts = tableName.split('.');
      schema = parts[0];
      table = parts[1];
    }

    const res = await this.client.query(
      `
      SELECT 
        c.column_name AS name,
        c.udt_name AS type,
        c.data_type AS full_type,
        c.is_nullable = 'YES' AS nullable,
        c.column_default AS default_value,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.table_schema, kcu.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk
        ON c.table_schema = pk.table_schema
        AND c.table_name = pk.table_name
        AND c.column_name = pk.column_name
      WHERE c.table_name = $1
        AND ($2::text IS NULL OR c.table_schema = $2)
      ORDER BY c.ordinal_position ASC;
      `,
      [table, schema]
    );

    if (res.rows.length === 0) {
      // Fallback for views or custom catalogs: sample 0 rows to read column definitions
      const qualified = schema ? `"${schema}"."${table}"` : `"${table}"`;
      try {
        const sample = await this.client.query(`SELECT * FROM ${qualified} LIMIT 0;`);
        return sample.fields.map(f => ({
          name: f.name,
          type: String(f.dataTypeID || 'text'),
          isPrimaryKey: false,
          nullable: true
        }));
      } catch {
        return [];
      }
    }

    return res.rows.map((r: any) => ({
      name: String(r.name),
      type: String(r.type || r.full_type),
      isPrimaryKey: Boolean(r.is_primary_key),
      nullable: Boolean(r.nullable),
      defaultValue: r.default_value != null ? String(r.default_value) : undefined
    }));
  }

  async executeQuery(query: string, _options?: QueryOptions): Promise<QueryResult> {
    if (!this.isConnected || !this.client) {
      throw new Error('PostgreSQL driver not connected');
    }

    const startTime = performance.now();
    const res = await this.client.query(query);
    const executionTimeMs = Math.round(performance.now() - startTime);

    const result = Array.isArray(res) ? res[res.length - 1] : res;
    const columns = result.fields
      ? result.fields.map((f: any) => f.name)
      : (result.rows && result.rows[0] ? Object.keys(result.rows[0]) : []);

    const sanitizeVal = (val: any): any => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'bigint') return Number(val);
      if (Buffer.isBuffer(val)) return `\\x${val.toString('hex')}`;
      if (val instanceof Date) return val.toISOString();
      return val;
    };

    const rows = (result.rows || []).map((row: any) => {
      const sanitized: Record<string, any> = {};
      for (const k of Object.keys(row)) {
        sanitized[k] = sanitizeVal(row[k]);
      }
      return sanitized;
    });

    return {
      columns,
      rows,
      rowCount: result.rowCount ?? rows.length,
      executionTimeMs,
      statementType: (result.command as any) || 'SELECT'
    };
  }

  private formatTable(tableName: string): string {
    if (tableName.includes('.')) {
      return tableName.split('.').map(p => `"${p.replace(/"/g, '""')}"`).join('.');
    }
    return `"${tableName.replace(/"/g, '""')}"`;
  }

  async insertRow(tableName: string, data: Record<string, any>): Promise<MutationResult> {
    if (!this.isConnected || !this.client) throw new Error('PostgreSQL driver not connected');

    const keys = Object.keys(data);
    if (keys.length === 0) throw new Error('No column data provided for insert');

    const colNames = keys.map(k => `"${k.replace(/"/g, '""')}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map(k => data[k]);

    const sql = `INSERT INTO ${this.formatTable(tableName)} (${colNames}) VALUES (${placeholders}) RETURNING *;`;
    const res = await this.client.query(sql, values);

    return {
      success: true,
      affectedRows: res.rowCount || 1,
      insertedId: res.rows[0]?.id || res.rows[0]?.codigo || undefined
    };
  }

  async updateRow(
    tableName: string,
    primaryKey: Record<string, any>,
    changes: Record<string, any>
  ): Promise<MutationResult> {
    if (!this.isConnected || !this.client) throw new Error('PostgreSQL driver not connected');

    const changeKeys = Object.keys(changes);
    if (changeKeys.length === 0) throw new Error('No changes provided for update');

    const pkKeys = Object.keys(primaryKey);
    if (pkKeys.length === 0) throw new Error('No primary key provided for update');

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const k of changeKeys) {
      setClauses.push(`"${k.replace(/"/g, '""')}" = $${idx++}`);
      values.push(changes[k]);
    }

    const whereClauses: string[] = [];
    for (const k of pkKeys) {
      whereClauses.push(`"${k.replace(/"/g, '""')}" = $${idx++}`);
      values.push(primaryKey[k]);
    }

    const sql = `UPDATE ${this.formatTable(tableName)} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')} RETURNING *;`;
    const res = await this.client.query(sql, values);

    return {
      success: true,
      affectedRows: res.rowCount || 0
    };
  }

  async deleteRow(tableName: string, primaryKey: Record<string, any>): Promise<MutationResult> {
    if (!this.isConnected || !this.client) throw new Error('PostgreSQL driver not connected');

    const pkKeys = Object.keys(primaryKey);
    if (pkKeys.length === 0) throw new Error('No primary key provided for delete');

    const whereClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const k of pkKeys) {
      whereClauses.push(`"${k.replace(/"/g, '""')}" = $${idx++}`);
      values.push(primaryKey[k]);
    }

    const sql = `DELETE FROM ${this.formatTable(tableName)} WHERE ${whereClauses.join(' AND ')};`;
    const res = await this.client.query(sql, values);

    return {
      success: true,
      affectedRows: res.rowCount || 0
    };
  }
}
