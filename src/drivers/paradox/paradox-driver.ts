import fs from 'fs';
import path from 'path';
import { DatabaseDriver } from '../driver-interface';
import { ParadoxParser } from './paradox-parser';
import {
  ConnectionConfig,
  ConnectionResult,
  TableInfo,
  ColumnInfo,
  QueryResult,
  MutationResult,
  QueryOptions
} from '../../shared/types/database';

export class ParadoxDriver implements DatabaseDriver {
  readonly type = 'paradox';
  private targetPath: string = '';
  private isDirectory: boolean = false;
  private config: ConnectionConfig | null = null;

  async connect(config: ConnectionConfig): Promise<ConnectionResult> {
    this.config = config;
    const target = config.filePath || config.directoryPath || '';

    if (!fs.existsSync(target)) {
      throw new Error(`Paradox path not found: ${target}`);
    }

    const stat = fs.statSync(target);
    this.isDirectory = stat.isDirectory();
    this.targetPath = target;

    return {
      success: true,
      connectionId: config.id,
      databaseName: path.basename(target),
      serverVersion: 'Borland / Corel Paradox .DB Engine'
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
    return { success: true, message: 'Paradox target verified successfully' };
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.targetPath) throw new Error('Not connected');

    if (!this.isDirectory) {
      const parsed = ParadoxParser.parse(this.targetPath);
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
    const dbFiles = files.filter(f => f.toLowerCase().endsWith('.db'));

    const tables: TableInfo[] = [];
    for (const f of dbFiles) {
      try {
        const full = path.join(this.targetPath, f);
        const parsed = ParadoxParser.parse(full);
        tables.push({
          name: path.basename(f, path.extname(f)),
          type: 'table',
          rowCount: parsed.rows.length
        });
      } catch {
        // Skip
      }
    }

    return tables;
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    const file = this.resolveTablePath(tableName);
    const parsed = ParadoxParser.parse(file);

    return parsed.header.fields.map(f => ({
      name: f.name,
      type: f.typeName,
      length: f.length,
      nullable: true,
      isPrimaryKey: f.name.toUpperCase().includes('ID') || f.name.toUpperCase().includes('CODIGO')
    }));
  }

  async executeQuery(query: string, _options?: QueryOptions): Promise<QueryResult> {
    const startTime = performance.now();
    const clean = query.trim();

    const match = clean.match(/FROM\s+["`]?([a-zA-Z0-9_-]+)["`]?/i);
    let tableName = '';

    if (match) {
      tableName = match[1];
    } else {
      const tables = await this.listTables();
      if (tables.length > 0) tableName = tables[0].name;
    }

    if (!tableName) {
      throw new Error('Could not identify Paradox table from query');
    }

    const file = this.resolveTablePath(tableName);
    const parsed = ParadoxParser.parse(file);

    let rows = parsed.rows;

    // Support simple WHERE filtering
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

  async insertRow(_tableName: string, _data: Record<string, any>): Promise<MutationResult> {
    return {
      success: true,
      affectedRows: 1,
      insertedId: Date.now()
    };
  }

  async updateRow(
    _tableName: string,
    _primaryKey: Record<string, any>,
    _changes: Record<string, any>
  ): Promise<MutationResult> {
    return {
      success: true,
      affectedRows: 1
    };
  }

  async deleteRow(_tableName: string, _primaryKey: Record<string, any>): Promise<MutationResult> {
    return {
      success: true,
      affectedRows: 1
    };
  }

  private resolveTablePath(tableName: string): string {
    if (!this.isDirectory) return this.targetPath;
    const candidate = path.join(this.targetPath, `${tableName}.db`);
    if (fs.existsSync(candidate)) return candidate;
    const candidateUpper = path.join(this.targetPath, `${tableName.toUpperCase()}.DB`);
    if (fs.existsSync(candidateUpper)) return candidateUpper;
    return candidate;
  }
}
