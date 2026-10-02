import {
  ConnectionConfig,
  ConnectionResult,
  TableInfo,
  ColumnInfo,
  QueryResult,
  MutationResult,
  QueryOptions,
  DatabaseType
} from '../shared/types/database';

export interface DatabaseDriver {
  readonly type: DatabaseType;
  connect(config: ConnectionConfig): Promise<ConnectionResult>;
  disconnect(): Promise<void>;
  testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }>;
  listTables(): Promise<TableInfo[]>;
  describeTable(tableName: string): Promise<ColumnInfo[]>;
  executeQuery(query: string, options?: QueryOptions): Promise<QueryResult>;
  insertRow(tableName: string, data: Record<string, any>): Promise<MutationResult>;
  updateRow(tableName: string, primaryKey: Record<string, any>, changes: Record<string, any>): Promise<MutationResult>;
  deleteRow(tableName: string, primaryKey: Record<string, any>): Promise<MutationResult>;
}
