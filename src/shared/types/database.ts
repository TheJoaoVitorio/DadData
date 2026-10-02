export type DatabaseType =
  | 'sqlite'
  | 'postgres'
  | 'mysql'
  | 'mssql'
  | 'mongodb'
  | 'firebird'
  | 'dbf'
  | 'paradox'
  | 'access'
  | 'hfsql'
  | 'nexusdb';

export interface DatabaseCategory {
  id: 'modern' | 'legacy_desktop' | 'document';
  label: string;
  types: DatabaseType[];
}

export interface ConnectionConfig {
  id: string;
  name: string;
  type: DatabaseType;
  // Network based
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  version?: string; // e.g. "PostgreSQL 16", "MySQL 8.0", "Paradox 7"
  // File based (SQLite, DBF, Paradox, Access, HFSQL, NexusDB)
  filePath?: string;
  directoryPath?: string;
  // Extra options
  options?: Record<string, any>;
  createdAt?: string;
  lastConnectedAt?: string;
}

export interface ConnectionResult {
  success: boolean;
  connectionId: string;
  message?: string;
  serverVersion?: string;
  databaseName?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: any;
  length?: number;
  precision?: number;
  scale?: number;
}

export interface TableInfo {
  name: string;
  schema?: string;
  rowCount?: number;
  type: 'table' | 'view' | 'collection' | 'file';
  columns?: ColumnInfo[];
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  params?: any[];
  timeoutMs?: number;
}

export interface QueryResult {
  columns: string[];
  columnDetails?: ColumnInfo[];
  rows: Record<string, any>[];
  rowCount: number;
  executionTimeMs: number;
  statementType?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'OTHER';
}

export interface MutationResult {
  success: boolean;
  affectedRows: number;
  insertedId?: string | number;
  error?: string;
}

export interface ExportOptions {
  format: 'csv' | 'xlsx';
  tableName?: string;
  query?: string;
  delimiter?: ',' | ';' | '\t';
  includeHeaders?: boolean;
  sheetName?: string;
  targetFilePath?: string;
}

export interface ExportResult {
  success: boolean;
  filePath: string;
  rowCount: number;
  fileSizeBytes: number;
  message?: string;
}
