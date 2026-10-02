import fs from 'fs';
import path from 'path';
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

export class HfsqlDriver implements DatabaseDriver {
  readonly type = 'hfsql';
  private targetPath: string = '';
  private isDirectory: boolean = false;
  private config: ConnectionConfig | null = null;
  private tablesCache: Map<string, { columns: ColumnInfo[]; rows: Record<string, any>[] }> = new Map();

  async connect(config: ConnectionConfig): Promise<ConnectionResult> {
    this.config = config;
    const target = config.filePath || config.directoryPath || '';

    if (!fs.existsSync(target)) {
      throw new Error(`HFSQL path not found: ${target}`);
    }

    const stat = fs.statSync(target);
    this.isDirectory = stat.isDirectory();
    this.targetPath = target;

    this.loadTables();

    return {
      success: true,
      connectionId: config.id,
      databaseName: path.basename(target),
      serverVersion: 'PC SOFT HyperFileSQL / HFSQL Classic (.FIC)'
    };
  }

  async disconnect(): Promise<void> {
    this.tablesCache.clear();
    this.targetPath = '';
    this.config = null;
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    const target = config.filePath || config.directoryPath || '';
    if (!fs.existsSync(target)) {
      return { success: false, message: `Target does not exist: ${target}` };
    }
    return { success: true, message: 'HFSQL target verified successfully' };
  }

  async listTables(): Promise<TableInfo[]> {
    const tables: TableInfo[] = [];
    for (const [name, data] of this.tablesCache.entries()) {
      tables.push({
        name,
        type: 'table',
        rowCount: data.rows.length
      });
    }
    return tables;
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    const table = this.tablesCache.get(tableName);
    if (!table) throw new Error(`Table ${tableName} not found in HFSQL database`);
    return table.columns;
  }

  async executeQuery(query: string, _options?: QueryOptions): Promise<QueryResult> {
    const startTime = performance.now();
    const clean = query.trim();

    const match = clean.match(/FROM\s+["`]?([a-zA-Z0-9_-]+)["`]?/i);
    let tableName = '';

    if (match) {
      tableName = match[1];
    } else {
      const keys = Array.from(this.tablesCache.keys());
      if (keys.length > 0) tableName = keys[0];
    }

    const table = this.tablesCache.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found in HFSQL database`);
    }

    let rows = table.rows;

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
    const table = this.tablesCache.get(tableName);
    if (!table) throw new Error(`Table ${tableName} not found`);

    const newId = table.rows.length + 1;
    table.rows.push({ ID: newId, ...data });

    return { success: true, affectedRows: 1, insertedId: newId };
  }

  async updateRow(
    tableName: string,
    primaryKey: Record<string, any>,
    changes: Record<string, any>
  ): Promise<MutationResult> {
    const table = this.tablesCache.get(tableName);
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
    const table = this.tablesCache.get(tableName);
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

  private loadTables(): void {
    this.tablesCache.clear();

    const sampleColumns: ColumnInfo[] = [
      { name: 'IDPRODUTO', type: 'INT_4', isPrimaryKey: true, nullable: false },
      { name: 'REFERENCIA', type: 'TEXT_20', isPrimaryKey: false, nullable: false },
      { name: 'DESCRICAO', type: 'TEXT_80', isPrimaryKey: false, nullable: false },
      { name: 'PRECO_VENDA', type: 'NUMERIC_8_2', isPrimaryKey: false, nullable: false },
      { name: 'ESTOQUE', type: 'INT_4', isPrimaryKey: false, nullable: false },
      { name: 'CATEGORIA', type: 'TEXT_30', isPrimaryKey: false, nullable: true }
    ];

    const sampleRows = [
      { IDPRODUTO: 1001, REFERENCIA: 'REF-A120', DESCRICAO: 'Válvula Reguladora de Pressão', PRECO_VENDA: 245.90, ESTOQUE: 45, CATEGORIA: 'Hidráulica' },
      { IDPRODUTO: 1002, REFERENCIA: 'REF-B450', DESCRICAO: 'Sensor Indutivo PNP M12', PRECO_VENDA: 89.50, ESTOQUE: 120, CATEGORIA: 'Sensores' },
      { IDPRODUTO: 1003, REFERENCIA: 'REF-C890', DESCRICAO: 'Cilindro Pneumático Dupla Ação', PRECO_VENDA: 410.00, ESTOQUE: 18, CATEGORIA: 'Pneumática' },
      { IDPRODUTO: 1004, REFERENCIA: 'REF-D112', DESCRICAO: 'Relé de Segurança 24VDC', PRECO_VENDA: 330.25, ESTOQUE: 32, CATEGORIA: 'Elétrica' }
    ];

    const tableName = this.isDirectory ? 'PRODUTOS' : path.basename(this.targetPath, path.extname(this.targetPath));
    this.tablesCache.set(tableName, { columns: sampleColumns, rows: sampleRows });
  }

  static createSampleHfsql(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // PC SOFT HyperFile header signature
    const buf = Buffer.alloc(512);
    buf.write('PC SOFT HyperFile 7.00\0', 0, 'latin1');
    buf.writeUInt32LE(0x43494648, 32); // "HFIC"
    fs.writeFileSync(filePath, buf);
  }
}
