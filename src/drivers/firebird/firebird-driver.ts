import Firebird from 'node-firebird';
import { execSync } from 'child_process';
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
  private db: any = null;
  private isConnected = false;

  private getWindowsShortPath(fullPath: string): string {
    if (process.platform !== 'win32') return fullPath;
    if (!fullPath || !/[^\x00-\x7F]|\s/.test(fullPath)) return fullPath;
    try {
      const escaped = fullPath.replace(/"/g, '');
      const stdout = execSync(`cmd.exe /c "for %I in ("${escaped}") do @echo %~sI"`, {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      if (stdout && stdout.length > 0 && stdout !== '%~sI') {
        return stdout;
      }
    } catch {
      // Fallback to original path
    }
    return fullPath;
  }

  async connect(config: ConnectionConfig): Promise<ConnectionResult> {
    this.config = config;

    if (this.db) {
      await this.disconnect();
    }

    const rawPath = config.filePath || config.database || '';
    if (!rawPath) {
      throw new Error('Informe o caminho do arquivo de banco de dados Firebird (.FDB).');
    }

    const dbPath = this.getWindowsShortPath(rawPath);
    const charset = (config.options?.charset || config.options?.encoding || 'WIN1252').toUpperCase();

    const options: any = {
      host: config.host || '127.0.0.1',
      port: config.port || 3050,
      database: dbPath,
      user: config.user || 'SYSDBA',
      password: config.password || 'masterkey',
      lowercase_keys: false,
      role: config.options?.role || undefined,
      pageSize: 4096,
      encoding: charset
    };

    return new Promise((resolve, reject) => {
      Firebird.attach(options, (err: any, db: any) => {
        if (err) {
          return reject(new Error(`Falha ao conectar no Firebird (${options.host}:${options.port}): ${err.message}`));
        }
        this.db = db;
        this.isConnected = true;
        const dbName = rawPath.split(/[\\/]/).pop() || 'DATABASE.FDB';
        resolve({
          success: true,
          connectionId: config.id,
          databaseName: dbName,
          serverVersion: `Firebird Server (${options.host}:${options.port}) [${charset}]`
        });
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve) => {
        this.db.detach(() => {
          this.db = null;
          this.isConnected = false;
          resolve();
        });
      });
    }
    this.config = null;
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    const rawPath = config.filePath || config.database || '';
    if (!rawPath) {
      return { success: false, message: 'Informe o caminho do arquivo do banco Firebird (.FDB).' };
    }

    const dbPath = this.getWindowsShortPath(rawPath);
    const charset = (config.options?.charset || config.options?.encoding || 'WIN1252').toUpperCase();

    const options: any = {
      host: config.host || '127.0.0.1',
      port: config.port || 3050,
      database: dbPath,
      user: config.user || 'SYSDBA',
      password: config.password || 'masterkey',
      lowercase_keys: false,
      encoding: charset
    };

    return new Promise((resolve) => {
      Firebird.attach(options, (err: any, db: any) => {
        if (err) {
          return resolve({
            success: false,
            message: `Erro ao conectar no Firebird: ${err.message}`
          });
        }
        db.detach(() => {
          resolve({
            success: true,
            message: `Conexão validada com sucesso no Firebird em ${options.host}:${options.port}!`
          });
        });
      });
    });
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.db) throw new Error('Firebird não conectado.');

    const sql = `
      SELECT 
        RDB$RELATION_NAME AS TABLE_NAME,
        CASE WHEN RDB$VIEW_SOURCE IS NOT NULL THEN 1 ELSE 0 END AS IS_VIEW
      FROM RDB$RELATIONS
      WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
        AND RDB$RELATION_NAME NOT LIKE 'RDB$%'
        AND RDB$RELATION_NAME NOT LIKE 'MON$%'
        AND RDB$RELATION_NAME NOT LIKE 'IBE$%'
        AND RDB$RELATION_NAME NOT LIKE 'SEC$%'
      ORDER BY 1
    `;

    return new Promise((resolve, reject) => {
      this.db.query(sql, (err: any, rows: any[]) => {
        if (err) return reject(new Error(`Erro ao listar tabelas do Firebird: ${err.message}`));

        const tables: TableInfo[] = (rows || [])
          .map(r => {
            const rawName = r.TABLE_NAME ?? r.table_name ?? r.NAME ?? r.name;
            const name = Buffer.isBuffer(rawName)
              ? rawName.toString('utf8').trim()
              : String(rawName || '').trim();
            const isView = Number(r.IS_VIEW ?? r.is_view) === 1;
            return {
              name,
              type: (isView ? 'view' : 'table') as 'table' | 'view',
              schema: 'public'
            };
          })
          .filter(t => t.name.length > 0);

        resolve(tables);
      });
    });
  }

  private mapType(fieldType: number, length: number, scale: number, subType: number, precision?: number): string {
    switch (fieldType) {
      case 7:
        return scale < 0 ? `NUMERIC(${precision || 4},${-scale})` : 'SMALLINT';
      case 8:
        return scale < 0 ? `NUMERIC(${precision || 9},${-scale})` : 'INTEGER';
      case 10:
        return 'FLOAT';
      case 12:
        return 'DATE';
      case 13:
        return 'TIME';
      case 14:
        return `CHAR(${length})`;
      case 16:
        return scale < 0 ? `NUMERIC(${precision || 15},${-scale})` : 'BIGINT';
      case 23:
        return 'BOOLEAN';
      case 27:
        return 'DOUBLE PRECISION';
      case 35:
        return 'TIMESTAMP';
      case 37:
        return `VARCHAR(${length})`;
      case 261:
        return subType === 1 ? 'BLOB SUB_TYPE TEXT' : 'BLOB';
      default:
        return `TYPE_${fieldType}`;
    }
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    if (!this.db) throw new Error('Firebird não conectado.');

    const cleanTableName = tableName.trim().toUpperCase();

    const colSql = `
      SELECT 
        TRIM(rf.RDB$FIELD_NAME) AS FIELD_NAME,
        f.RDB$FIELD_TYPE AS FIELD_TYPE,
        f.RDB$FIELD_LENGTH AS FIELD_LENGTH,
        f.RDB$FIELD_SCALE AS FIELD_SCALE,
        f.RDB$FIELD_SUB_TYPE AS FIELD_SUB_TYPE,
        f.RDB$FIELD_PRECISION AS FIELD_PRECISION,
        rf.RDB$NULL_FLAG AS NULL_FLAG
      FROM RDB$RELATION_FIELDS rf
      JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
      WHERE TRIM(rf.RDB$RELATION_NAME) = ?
      ORDER BY rf.RDB$FIELD_POSITION
    `;

    const pkSql = `
      SELECT TRIM(s.RDB$FIELD_NAME) AS PK_FIELD
      FROM RDB$RELATION_CONSTRAINTS rc
      JOIN RDB$INDEX_SEGMENTS s ON rc.RDB$INDEX_NAME = s.RDB$INDEX_NAME
      WHERE TRIM(rc.RDB$RELATION_NAME) = ? AND rc.RDB$CONSTRAINT_TYPE = 'PRIMARY KEY'
    `;

    const [cols, pks] = await Promise.all([
      new Promise<any[]>((resolve, reject) => {
        this.db.query(colSql, [cleanTableName], (err: any, res: any[]) => {
          if (err) return reject(err);
          resolve(res || []);
        });
      }),
      new Promise<string[]>((resolve) => {
        this.db.query(pkSql, [cleanTableName], (err: any, res: any[]) => {
          if (err || !res) return resolve([]);
          resolve(res.map(r => r.PK_FIELD));
        });
      })
    ]);

    const pkSet = new Set(pks);

    return cols.map(c => ({
      name: c.FIELD_NAME,
      type: this.mapType(c.FIELD_TYPE, c.FIELD_LENGTH, c.FIELD_SCALE, c.FIELD_SUB_TYPE, c.FIELD_PRECISION),
      nullable: c.NULL_FLAG !== 1,
      isPrimaryKey: pkSet.has(c.FIELD_NAME)
    }));
  }

  private decodeBuffer(buf: Buffer, encoding: string): string {
    const enc = (encoding || 'WIN1252').toUpperCase();
    if (['WIN1252', 'ISO8859_1', 'NONE', 'ANSI'].includes(enc)) {
      return buf.toString('latin1');
    }
    const utf8Str = buf.toString('utf8');
    if (utf8Str.includes('\uFFFD')) {
      return buf.toString('latin1');
    }
    return utf8Str;
  }

  private async resolveRowValues(row: Record<string, any>): Promise<Record<string, any>> {
    const encoding = this.config?.options?.charset || this.config?.options?.encoding || 'WIN1252';
    const result: Record<string, any> = {};

    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'function') {
        try {
          result[k] = await new Promise<string>((resolve) => {
            v((err: any, _name: any, emitter: any) => {
              if (err) return resolve('[BLOB]');
              const chunks: Buffer[] = [];
              emitter.on('data', (chunk: any) => {
                if (Buffer.isBuffer(chunk)) chunks.push(chunk);
                else chunks.push(Buffer.from(String(chunk)));
              });
              emitter.on('end', () => {
                const combined = Buffer.concat(chunks);
                resolve(this.decodeBuffer(combined, encoding));
              });
              emitter.on('error', () => {
                resolve('[BLOB]');
              });
            });
          });
        } catch {
          result[k] = '[BLOB]';
        }
      } else if (Buffer.isBuffer(v)) {
        result[k] = this.decodeBuffer(v, encoding);
      } else if (v instanceof Date) {
        result[k] = v.toISOString();
      } else {
        result[k] = v;
      }
    }
    return result;
  }

  private detectStatementType(sql: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'OTHER' {
    const firstWord = sql.trim().split(/\s+/)[0]?.toUpperCase();
    if (firstWord === 'SELECT') return 'SELECT';
    if (firstWord === 'INSERT') return 'INSERT';
    if (firstWord === 'UPDATE') return 'UPDATE';
    if (firstWord === 'DELETE') return 'DELETE';
    if (firstWord === 'CREATE') return 'CREATE';
    if (firstWord === 'DROP') return 'DROP';
    return 'OTHER';
  }

  async executeQuery(query: string, options?: QueryOptions): Promise<QueryResult> {
    if (!this.db) throw new Error('Firebird não conectado.');

    const startTime = performance.now();
    const cleanQuery = query.trim();

    return new Promise((resolve, reject) => {
      this.db.query(cleanQuery, options?.params || [], async (err: any, rows: any[]) => {
        if (err) {
          return reject(new Error(`Erro SQL Firebird: ${err.message}`));
        }

        const executionTimeMs = Math.round(performance.now() - startTime);

        if (!Array.isArray(rows) || rows.length === 0) {
          return resolve({
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs,
            statementType: this.detectStatementType(cleanQuery)
          });
        }

        const formattedRows: Record<string, any>[] = [];
        for (const row of rows) {
          const resolvedRow = await this.resolveRowValues(row);
          formattedRows.push(resolvedRow);
        }

        const columns = Object.keys(formattedRows[0] || {});

        resolve({
          columns,
          rows: formattedRows,
          rowCount: formattedRows.length,
          executionTimeMs,
          statementType: this.detectStatementType(cleanQuery)
        });
      });
    });
  }

  async insertRow(tableName: string, data: Record<string, any>): Promise<MutationResult> {
    const keys = Object.keys(data);
    if (keys.length === 0) return { success: false, affectedRows: 0, error: 'No data provided' };

    const quotedCols = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => data[k]);

    const sql = `INSERT INTO "${tableName}" (${quotedCols}) VALUES (${placeholders})`;
    await this.executeQuery(sql, { params: values });
    return { success: true, affectedRows: 1 };
  }

  async updateRow(
    tableName: string,
    primaryKey: Record<string, any>,
    changes: Record<string, any>
  ): Promise<MutationResult> {
    const setKeys = Object.keys(changes);
    if (setKeys.length === 0) return { success: false, affectedRows: 0, error: 'No changes provided' };

    const setClauses = setKeys.map(k => `"${k}" = ?`).join(', ');
    const pkKeys = Object.keys(primaryKey);
    const whereClauses = pkKeys.map(k => `"${k}" = ?`).join(' AND ');

    const values = [...setKeys.map(k => changes[k]), ...pkKeys.map(k => primaryKey[k])];

    const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE ${whereClauses}`;
    await this.executeQuery(sql, { params: values });
    return { success: true, affectedRows: 1 };
  }

  async deleteRow(tableName: string, primaryKey: Record<string, any>): Promise<MutationResult> {
    const pkKeys = Object.keys(primaryKey);
    if (pkKeys.length === 0) return { success: false, affectedRows: 0, error: 'No primary key provided' };

    const whereClauses = pkKeys.map(k => `"${k}" = ?`).join(' AND ');
    const values = pkKeys.map(k => primaryKey[k]);

    const sql = `DELETE FROM "${tableName}" WHERE ${whereClauses}`;
    await this.executeQuery(sql, { params: values });
    return { success: true, affectedRows: 1 };
  }
}
