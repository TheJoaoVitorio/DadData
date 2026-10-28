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
  authType?: 'sql' | 'windows' | string;
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
  type: 'table' | 'view' | 'collection' | 'file' | 'database';
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
  totalCount?: number;
  hasMore?: boolean;
  offset?: number;
  limit?: number;
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
  columns?: string[];
  rows?: Record<string, any>[];
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

export interface DetectedService {
  id: string;
  name: string;
  label: string;
  status: 'running' | 'stopped' | 'not_installed';
  port?: number;
  version?: string;
  tools: Record<string, string>;
  isPortable: boolean;
  serviceName?: string;
}

export interface BackupOptions {
  connectionId: string;
  databaseName?: string;
  outputPath: string;
  format: 'sql' | 'custom' | 'tar' | 'zip' | 'bak';
  dumpType: 'full' | 'schema_only' | 'data_only';
  dropExisting?: boolean;
  customToolPath?: string;
}

export interface RestoreOptions {
  connectionId: string;
  databaseName?: string;
  inputPath: string;
  format?: string;
  dropFirst?: boolean;
  customToolPath?: string;
}

export interface LogEvent {
  stream: 'stdout' | 'stderr' | 'info' | 'error';
  message: string;
  timestamp: string;
  percentage?: number;
  isDone: boolean;
  success: boolean;
}

export interface DatabaseTreeNode {
  id: string;
  label: string;
  nodeType: 'database' | 'schema' | 'table_folder' | 'view_folder' | 'proc_folder' | 'trigger_folder' | 'table' | 'view' | 'procedure' | 'trigger' | 'index' | 'column';
  schema?: string;
  rowCount?: number;
  children: DatabaseTreeNode[];
  metadata?: Record<string, any>;
}

export interface DdlResult {
  objectName: string;
  objectType: string;
  ddl: string;
}

export interface PortableToolStatus {
  id: string;
  name: string;
  isInstalled: boolean;
  version?: string;
  path?: string;
  downloadUrl?: string;
  sizeBytes?: number;
}
