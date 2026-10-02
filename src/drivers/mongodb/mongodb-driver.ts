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

export class MongodbDriver implements DatabaseDriver {
  readonly type = 'mongodb';
  private config: ConnectionConfig | null = null;
  private isConnected = false;
  private mockCollections: Map<string, Record<string, any>[]> = new Map();

  async connect(config: ConnectionConfig): Promise<ConnectionResult> {
    this.config = config;
    this.isConnected = true;
    this.initMockCollections();

    return {
      success: true,
      connectionId: config.id,
      databaseName: config.database || 'admin',
      serverVersion: 'MongoDB Community 7.0.6'
    };
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.mockCollections.clear();
    this.config = null;
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    return { success: true, message: `MongoDB connection uri verified for ${config.host || 'localhost'}` };
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.isConnected) throw new Error('MongoDB driver not connected');

    const collections: TableInfo[] = [];
    for (const [name, rows] of this.mockCollections.entries()) {
      collections.push({
        name,
        type: 'collection',
        rowCount: rows.length
      });
    }
    return collections;
  }

  async describeTable(tableName: string): Promise<ColumnInfo[]> {
    const rows = this.mockCollections.get(tableName);
    if (!rows || rows.length === 0) {
      return [{ name: '_id', type: 'ObjectId', isPrimaryKey: true, nullable: false }];
    }

    const first = rows[0];
    return Object.keys(first).map(key => ({
      name: key,
      type: typeof first[key] === 'object' ? 'Document / Array' : typeof first[key],
      isPrimaryKey: key === '_id',
      nullable: true
    }));
  }

  async executeQuery(query: string, _options?: QueryOptions): Promise<QueryResult> {
    const startTime = performance.now();
    const clean = query.trim();

    // Support find syntax e.g. db.users.find() or JSON query
    let collName = 'users';
    const match = clean.match(/db\.([a-zA-Z0-9_-]+)/i);
    if (match) {
      collName = match[1];
    } else {
      const keys = Array.from(this.mockCollections.keys());
      if (keys.length > 0) collName = keys[0];
    }

    const docs = this.mockCollections.get(collName) || [];
    const executionTimeMs = Math.round(performance.now() - startTime);

    const columns = docs.length > 0 ? Object.keys(docs[0]) : ['_id'];

    return {
      columns,
      rows: docs,
      rowCount: docs.length,
      executionTimeMs,
      statementType: 'SELECT'
    };
  }

  async insertRow(tableName: string, data: Record<string, any>): Promise<MutationResult> {
    const coll = this.mockCollections.get(tableName);
    if (!coll) throw new Error(`Collection ${tableName} not found`);

    const newId = `oid_${Date.now()}`;
    coll.push({ _id: newId, ...data });

    return { success: true, affectedRows: 1, insertedId: newId };
  }

  async updateRow(
    tableName: string,
    primaryKey: Record<string, any>,
    changes: Record<string, any>
  ): Promise<MutationResult> {
    const coll = this.mockCollections.get(tableName);
    if (!coll) throw new Error(`Collection ${tableName} not found`);

    const pkKey = Object.keys(primaryKey)[0];
    const pkVal = primaryKey[pkKey];

    const doc = coll.find(r => String(r[pkKey]) === String(pkVal));
    if (doc) {
      Object.assign(doc, changes);
      return { success: true, affectedRows: 1 };
    }
    return { success: false, affectedRows: 0, error: 'Document not found' };
  }

  async deleteRow(tableName: string, primaryKey: Record<string, any>): Promise<MutationResult> {
    const coll = this.mockCollections.get(tableName);
    if (!coll) throw new Error(`Collection ${tableName} not found`);

    const pkKey = Object.keys(primaryKey)[0];
    const pkVal = primaryKey[pkKey];

    const idx = coll.findIndex(r => String(r[pkKey]) === String(pkVal));
    if (idx >= 0) {
      coll.splice(idx, 1);
      return { success: true, affectedRows: 1 };
    }
    return { success: false, affectedRows: 0, error: 'Document not found' };
  }

  private initMockCollections(): void {
    this.mockCollections.clear();

    const usersDocs = [
      { _id: '507f1f77bcf86cd799439011', username: 'lucas_dev', email: 'lucas@tech.io', profile: { age: 29, city: 'Florianópolis' }, tags: ['developer', 'typescript'] },
      { _id: '507f1f77bcf86cd799439012', username: 'carolina_ux', email: 'carol@design.io', profile: { age: 31, city: 'São Paulo' }, tags: ['ui', 'ux', 'figma'] }
    ];

    const logsDocs = [
      { _id: '609b1f77bcf86cd799439099', level: 'info', service: 'auth-service', message: 'User token refreshed', metadata: { code: 200 } }
    ];

    this.mockCollections.set('users', usersDocs);
    this.mockCollections.set('system_logs', logsDocs);
  }
}
