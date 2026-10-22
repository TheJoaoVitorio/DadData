import { describe, it, expect, beforeEach } from 'vitest';
import { safeApi, isTauri, isDesktop } from '../src/services/api-client';
import { ConnectionConfig } from '../src/types/database';

// Mock localStorage for Node.js test runner environment
if (typeof localStorage === 'undefined') {
  let store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
}

describe('DadData Client API & Tauri Integration Suite', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should detect environment correctly', () => {
    expect(typeof isTauri).toBe('boolean');
    expect(typeof isDesktop).toBe('boolean');
  });

  it('should provide web fallback when running outside desktop runtime', async () => {
    const testRes = await safeApi.testConnection({
      id: 'test-conn',
      name: 'Fallback DB',
      type: 'sqlite'
    });
    expect(testRes.success).toBe(true);

    const tables = await safeApi.listTables('test-conn');
    expect(Array.isArray(tables)).toBe(true);
    expect(tables.length).toBeGreaterThan(0);

    const data = await safeApi.getTableData('test-conn', 'actor', undefined, { limit: 10, offset: 0 });
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.columns.length).toBeGreaterThan(0);
  });

  it('should support export format fallbacks', async () => {
    const res = await safeApi.exportData('test-conn', {
      format: 'csv',
      targetFilePath: 'test.csv',
      rows: [{ id: 1, name: 'Item 1' }]
    });
    expect(res.success).toBe(true);
  });

  it('should persist, retrieve, and delete saved connections', async () => {
    const newConn: ConnectionConfig = {
      id: 'conn_test_storage',
      name: 'ERP Produção Firebird',
      type: 'firebird',
      filePath: 'C:\\Sistemas\\DADOS.FDB',
      user: 'SYSDBA',
      password: 'masterkey'
    };

    // Save
    await safeApi.saveConnection(newConn);
    const saved = await safeApi.getSavedConnections();
    expect(saved.some(c => c.id === 'conn_test_storage')).toBe(true);

    // Delete
    await safeApi.deleteConnection('conn_test_storage');
    const afterDelete = await safeApi.getSavedConnections();
    expect(afterDelete.some(c => c.id === 'conn_test_storage')).toBe(false);
  });

  it('should support SQL Server configurations with Windows Auth and SQL Auth', async () => {
    const sqlAuthConn: ConnectionConfig = {
      id: 'conn_mssql_sql',
      name: 'MSSQL Produção',
      type: 'mssql',
      host: 'localhost',
      port: 1433,
      authType: 'sql',
      user: 'sa',
      password: 'strongPassword123'
    };

    const winAuthConn: ConnectionConfig = {
      id: 'conn_mssql_win',
      name: 'MSSQL Local Windows Auth',
      type: 'mssql',
      host: 'localhost',
      port: 1433,
      authType: 'windows'
    };

    expect(sqlAuthConn.authType).toBe('sql');
    expect(winAuthConn.authType).toBe('windows');
    expect(winAuthConn.user).toBeUndefined();

    await safeApi.saveConnection(winAuthConn);
    const list = await safeApi.getSavedConnections();
    const retrieved = list.find(c => c.id === 'conn_mssql_win');
    expect(retrieved?.authType).toBe('windows');
  });

  it('should support legacy file-based engines (Paradox, DBF, NexusDB, Access)', async () => {
    const legacyConns: ConnectionConfig[] = [
      { id: 'conn_paradox', name: 'Paradox ERP', type: 'paradox', filePath: 'C:\\ERP\\CLIENTES.DB' },
      { id: 'conn_dbf', name: 'Clipper DBF', type: 'dbf', filePath: 'C:\\ERP\\PRODUTOS.DBF' },
      { id: 'conn_nexus', name: 'NexusDB Delphi', type: 'nexusdb', filePath: 'C:\\ERP\\DADOS.NX1' },
      { id: 'conn_access', name: 'Access Jet', type: 'access', filePath: 'C:\\ERP\\SISTEMA.MDB' }
    ];

    for (const conn of legacyConns) {
      await safeApi.saveConnection(conn);
    }

    const saved = await safeApi.getSavedConnections();
    for (const conn of legacyConns) {
      expect(saved.some(c => c.id === conn.id && c.type === conn.type)).toBe(true);
    }
  });
});
