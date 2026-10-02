import fs from 'fs';
import path from 'path';
import { DatabaseDriver } from '../driver-interface';
import { DbfParser } from './dbf-parser';
import {
  ConnectionConfig,
  ConnectionResult,
  TableInfo,
  ColumnInfo,
  QueryResult,
  MutationResult,
  QueryOptions
} from '../../shared/types/database';

export class DbfDriver implements DatabaseDriver {
  readonly type = 'dbf';
  private targetPath: string = '';
  private isDirectory: boolean = false;
  private config: ConnectionConfig | null = null;

  async connect(config: ConnectionConfig): Promise<ConnectionResult> {
    this.config = config;
    const target = config.filePath || config.directoryPath || '';

    if (!fs.existsSync(target)) {
      throw new Error(`DBF path not found: ${target}`);
    }

    const stat = fs.statSync(target);
    this.isDirectory = stat.isDirectory();
    this.targetPath = target;

    return {
      success: true,
      connectionId: config.id,
      databaseName: path.basename(target),
      serverVersion: 'dBase / FoxPro / Clipper DBF Engine'
    };
  }

  async disconnect(): Promise<void> {
    this.targetPath = '';
    this.config = null;
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    const target = config.filePath || config.directoryPath || '';
    if (!fs.existsSync(target)) {
      return { success: false, message: `Target does not exist: ${target}` };
    }
    return { success: true, message: 'DBF target verified successfully' };
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.targetPath) throw new Error('Not connected');

    if (!this.isDirectory) {
      const parsed = DbfParser.parse(this.targetPath);
      const tableName = path.basename(this.targetPath, path.extname(this.targetPath));
      return [
        {
          name: tableName,
          type: 'table',
          rowCount: parsed.rows.length
        }
      ];
    }

    const files = fs.readdirSync(this.targetPath);
    const dbfFiles = files.filter(f => f.toLowerCase().endsWith('.dbf'));

    const tables: TableInfo[] = [];
    for (const f of dbfFiles) {
      try {
        const full = path.join(this.targetPath, f);
        const parsed = DbfParser.parse(full);
        tables.push({
          name: path.basename(f, path.extname(f)),
          type: 'table',
          rowCount: parsed.rows.length
        });
      } catch {
        // Skip invalid DBFs gracefully
      }
    }

    return tables;
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    const file = this.resolveTablePath(tableName);
    const parsed = DbfParser.parse(file);

    return parsed.header.fields.map(f => ({
      name: f.name,
      type: this.mapDbfTypeToSql(f.type, f.length, f.decimalCount),
      length: f.length,
      precision: f.decimalCount,
      nullable: true,
      isPrimaryKey: f.name.toUpperCase() === 'ID' || f.name.toUpperCase() === 'CODIGO'
    }));
  }

  async executeQuery(query: string, _options?: QueryOptions): Promise<QueryResult> {
    const startTime = performance.now();
    const clean = query.trim();

    // Match SELECT * FROM <tableName> [WHERE ...]
    const match = clean.match(/FROM\s+["`]?([a-zA-Z0-9_-]+)["`]?/i);
    let tableName = '';

    if (match) {
      tableName = match[1];
    } else {
      const tables = await this.listTables();
      if (tables.length > 0) tableName = tables[0].name;
    }

    if (!tableName) {
      throw new Error('Could not identify DBF table from query');
    }

    const file = this.resolveTablePath(tableName);
    const parsed = DbfParser.parse(file);

    let rows = parsed.rows;

    // Basic SQL WHERE filtering support
    const whereMatch = clean.match(/WHERE\s+(.+)$/i);
    if (whereMatch) {
      const condition = whereMatch[1].trim();
      const eqMatch = condition.match(/([a-zA-Z0-9_-]+)\s*=\s*['"]?([^'"]+)['"]?/);
      if (eqMatch) {
        const col = eqMatch[1].toUpperCase();
        const val = eqMatch[2];
        rows = rows.filter(r => {
          const rowVal = r[col] ?? r[col.toLowerCase()] ?? r[Object.keys(r).find(k => k.toUpperCase() === col) || ''];
          return String(rowVal).toLowerCase() === val.toLowerCase();
        });
      }
    }

    const columns = parsed.header.fields.map(f => f.name);
    const executionTimeMs = Math.round(performance.now() - startTime);

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs,
      statementType: 'SELECT'
    };
  }

  async insertRow(tableName: string, data: Record<string, any>): Promise<MutationResult> {
    const file = this.resolveTablePath(tableName);
    DbfParser.writeRecord(file, data);

    return {
      success: true,
      affectedRows: 1
    };
  }

  async updateRow(
    tableName: string,
    primaryKey: Record<string, any>,
    changes: Record<string, any>
  ): Promise<MutationResult> {
    // In DBF, updating rewrites the matching active record
    const file = this.resolveTablePath(tableName);
    const parsed = DbfParser.parse(file);

    const pkKey = Object.keys(primaryKey)[0];
    const pkVal = primaryKey[pkKey];

    const targetRow = parsed.rows.find(r => String(r[pkKey]) === String(pkVal));
    if (!targetRow) {
      return { success: false, affectedRows: 0, error: 'Record not found' };
    }

    // Merge changes
    const updated = { ...targetRow, ...changes };
    delete updated._rowId;

    // Overwrite DBF by rewriting records
    this.rewriteTable(file, parsed.header.fields, parsed.rows.map(r => {
      if (String(r[pkKey]) === String(pkVal)) {
        return updated;
      }
      const clone = { ...r };
      delete clone._rowId;
      return clone;
    }));

    return {
      success: true,
      affectedRows: 1
    };
  }

  async deleteRow(tableName: string, primaryKey: Record<string, any>): Promise<MutationResult> {
    const file = this.resolveTablePath(tableName);
    const parsed = DbfParser.parse(file);

    const pkKey = Object.keys(primaryKey)[0];
    const pkVal = primaryKey[pkKey];

    const filtered = parsed.rows
      .filter(r => String(r[pkKey]) !== String(pkVal))
      .map(r => {
        const clone = { ...r };
        delete clone._rowId;
        return clone;
      });

    this.rewriteTable(file, parsed.header.fields, filtered);

    return {
      success: true,
      affectedRows: 1
    };
  }

  private resolveTablePath(tableName: string): string {
    if (!this.isDirectory) {
      return this.targetPath;
    }
    const candidate = path.join(this.targetPath, `${tableName}.dbf`);
    if (fs.existsSync(candidate)) return candidate;

    const candidateUpper = path.join(this.targetPath, `${tableName.toUpperCase()}.DBF`);
    if (fs.existsSync(candidateUpper)) return candidateUpper;

    return candidate;
  }

  private mapDbfTypeToSql(type: string, length: number, decimals: number): string {
    switch (type) {
      case 'C': return `VARCHAR(${length})`;
      case 'N': return decimals > 0 ? `NUMERIC(${length}, ${decimals})` : 'INTEGER';
      case 'F': return `FLOAT(${length})`;
      case 'D': return 'DATE';
      case 'L': return 'BOOLEAN';
      case 'M': return 'MEMO (TEXT)';
      default: return 'VARCHAR';
    }
  }

  private rewriteTable(filePath: string, fields: any[], rows: Record<string, any>[]): void {
    const recordLength = 1 + fields.reduce((sum, f) => sum + f.length, 0);
    const headerLength = 32 + fields.length * 32 + 1;
    const buf = Buffer.alloc(headerLength + rows.length * recordLength + 1);

    buf.writeUInt8(0x03, 0);
    const now = new Date();
    buf.writeUInt8(now.getFullYear() - 1900, 1);
    buf.writeUInt8(now.getMonth() + 1, 2);
    buf.writeUInt8(now.getDate(), 3);
    buf.writeUInt32LE(rows.length, 4);
    buf.writeUInt16LE(headerLength, 8);
    buf.writeUInt16LE(recordLength, 10);

    let offsetAcc = 1;
    fields.forEach((f, idx) => {
      const pos = 32 + idx * 32;
      const nameBuf = Buffer.from(f.name.padEnd(11, '\0'), 'latin1');
      nameBuf.copy(buf, pos);
      buf.writeUInt8(f.type.charCodeAt(0), pos + 11);
      buf.writeUInt8(f.length, pos + 16);
      buf.writeUInt8(f.decimalCount, pos + 17);
      f.offset = offsetAcc;
      offsetAcc += f.length;
    });

    buf.writeUInt8(0x0d, headerLength - 1);

    rows.forEach((row, rIdx) => {
      const recStart = headerLength + rIdx * recordLength;
      buf.writeUInt8(0x20, recStart);

      fields.forEach(f => {
        const val = row[f.name];
        let valStr = '';
        if (f.type === 'N') {
          valStr = (f.decimalCount > 0 ? Number(val).toFixed(f.decimalCount) : String(val ?? '')).padStart(f.length, ' ');
        } else if (f.type === 'L') {
          valStr = val ? 'T' : 'F';
        } else {
          valStr = String(val ?? '').padEnd(f.length, ' ');
        }
        const fBuf = Buffer.from(valStr.slice(0, f.length), 'latin1');
        fBuf.copy(buf, recStart + f.offset);
      });
    });

    buf.writeUInt8(0x1a, buf.length - 1);
    fs.writeFileSync(filePath, buf);
  }
}
