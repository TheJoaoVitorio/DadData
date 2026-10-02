import fs from 'fs';
import initSqlJs, { Database, SqlValue } from 'sql.js';
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

export class SqliteDriver implements DatabaseDriver {
  readonly type = 'sqlite';
  private db: Database | null = null;
  private filePath: string | null = null;
  private config: ConnectionConfig | null = null;

  async connect(config: ConnectionConfig): Promise<ConnectionResult> {
    this.config = config;
    this.filePath = config.filePath || null;

    try {
      const SQL = await initSqlJs();
      if (this.filePath && fs.existsSync(this.filePath)) {
        const fileBuffer = fs.readFileSync(this.filePath);
        this.db = new SQL.Database(fileBuffer);
      } else {
        this.db = new SQL.Database();
        if (this.filePath) {
          this.saveToFile();
        }
      }

      return {
        success: true,
        connectionId: config.id,
        databaseName: this.filePath ? this.filePath.split(/[\\/]/).pop() : ':memory:',
        serverVersion: 'SQLite 3 (Embedded Engine)'
      };
    } catch (err: any) {
      throw new Error(`Failed to initialize SQLite: ${err.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.saveToFile();
      this.db.close();
      this.db = null;
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    try {
      const SQL = await initSqlJs();
      if (config.filePath) {
        if (!fs.existsSync(config.filePath)) {
          return { success: false, message: `File not found: ${config.filePath}` };
        }
        const fileBuffer = fs.readFileSync(config.filePath);
        const testDb = new SQL.Database(fileBuffer);
        testDb.close();
      }
      return { success: true, message: 'SQLite connection verified successfully' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.db) throw new Error('Database not connected');

    const query = `
      SELECT name, type 
      FROM sqlite_master 
      WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
      ORDER BY name;
    `;
    const res = this.db.exec(query);
    if (!res || res.length === 0) return [];

    const tables: TableInfo[] = [];
    const rows = res[0].values;

    for (const row of rows) {
      const name = String(row[0]);
      const type = row[1] === 'view' ? 'view' : 'table';
      
      let rowCount = 0;
      try {
        const countRes = this.db.exec(`SELECT COUNT(*) FROM "${name}"`);
        if (countRes && countRes[0]?.values?.[0]?.[0]) {
          rowCount = Number(countRes[0].values[0][0]);
        }
      } catch {
        // Ignored for non-countable views
      }

      tables.push({
        name,
        type,
        rowCount
      });
    }

    return tables;
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    if (!this.db) throw new Error('Database not connected');

    const res = this.db.exec(`PRAGMA table_info("${tableName}")`);
    if (!res || res.length === 0) return [];

    return res[0].values.map((row: any) => ({
      name: String(row[1]),
      type: String(row[2] || 'TEXT'),
      nullable: row[3] === 0,
      defaultValue: row[4],
      isPrimaryKey: row[5] === 1
    }));
  }

  async executeQuery(query: string, _options?: QueryOptions): Promise<QueryResult> {
    if (!this.db) throw new Error('Database not connected');

    const startTime = performance.now();
    const cleanQuery = query.trim();
    const isSelect = /^SELECT|^PRAGMA|^EXPLAIN/i.test(cleanQuery);

    try {
      if (isSelect) {
        const results = this.db.exec(cleanQuery);
        const executionTimeMs = Math.round(performance.now() - startTime);

        if (!results || results.length === 0) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs,
            statementType: 'SELECT'
          };
        }

        const firstResult = results[0];
        const columns = firstResult.columns;
        const rows = firstResult.values.map(valArr => {
          const rowObj: Record<string, any> = {};
          columns.forEach((col, idx) => {
            rowObj[col] = valArr[idx];
          });
          return rowObj;
        });

        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTimeMs,
          statementType: 'SELECT'
        };
      } else {
        // DDL or DML
        this.db.run(cleanQuery);
        this.saveToFile();
        const executionTimeMs = Math.round(performance.now() - startTime);

        return {
          columns: ['status', 'message'],
          rows: [{ status: 'success', message: 'Command executed successfully' }],
          rowCount: 1,
          executionTimeMs,
          statementType: 'OTHER'
        };
      }
    } catch (err: any) {
      throw new Error(`Query execution failed: ${err.message}`);
    }
  }

  async insertRow(tableName: string, data: Record<string, any>): Promise<MutationResult> {
    if (!this.db) throw new Error('Database not connected');

    const keys = Object.keys(data).filter(k => data[k] !== undefined);
    if (keys.length === 0) {
      throw new Error('No values provided for insertion');
    }

    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => data[k] as SqlValue);

    const sql = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders});`;
    this.db.run(sql, values);
    this.saveToFile();

    let insertedId: number | undefined;
    try {
      const idRes = this.db.exec('SELECT last_insert_rowid();');
      if (idRes && idRes[0]?.values?.[0]?.[0]) {
        insertedId = Number(idRes[0].values[0][0]);
      }
    } catch {
      // Ignored
    }

    return {
      success: true,
      affectedRows: 1,
      insertedId
    };
  }

  async updateRow(
    tableName: string,
    primaryKey: Record<string, any>,
    changes: Record<string, any>
  ): Promise<MutationResult> {
    if (!this.db) throw new Error('Database not connected');

    const changeKeys = Object.keys(changes);
    if (changeKeys.length === 0) {
      return { success: true, affectedRows: 0 };
    }

    const setClauses = changeKeys.map(k => `"${k}" = ?`).join(', ');
    const pkKeys = Object.keys(primaryKey);
    const whereClauses = pkKeys.map(k => `"${k}" = ?`).join(' AND ');

    const values = [
      ...changeKeys.map(k => changes[k]),
      ...pkKeys.map(k => primaryKey[k])
    ] as SqlValue[];

    const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE ${whereClauses};`;
    this.db.run(sql, values);
    this.saveToFile();

    return {
      success: true,
      affectedRows: 1
    };
  }

  async deleteRow(tableName: string, primaryKey: Record<string, any>): Promise<MutationResult> {
    if (!this.db) throw new Error('Database not connected');

    const pkKeys = Object.keys(primaryKey);
    if (pkKeys.length === 0) {
      throw new Error('Primary key required for row deletion');
    }

    const whereClauses = pkKeys.map(k => `"${k}" = ?`).join(' AND ');
    const values = pkKeys.map(k => primaryKey[k]) as SqlValue[];

    const sql = `DELETE FROM "${tableName}" WHERE ${whereClauses};`;
    this.db.run(sql, values);
    this.saveToFile();

    return {
      success: true,
      affectedRows: 1
    };
  }

  private saveToFile(): void {
    if (this.filePath && this.db) {
      try {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.filePath, buffer);
      } catch (err) {
        console.error('Failed to persist SQLite to disk:', err);
      }
    }
  }
}
