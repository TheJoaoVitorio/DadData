import { describe, it, expect } from 'vitest';
import { safeApi } from '../src/services/api-client';
import { BackupOptions, RestoreOptions } from '../src/types/database';

describe('DadData SGBD Backup, Restore & Service Discovery Suite', () => {
  it('should detect database services with fallback metadata', async () => {
    const services = await safeApi.detectServices();
    expect(Array.isArray(services)).toBe(true);
    expect(services.length).toBeGreaterThan(0);

    const sqliteSrv = services.find(s => s.id === 'sqlite');
    expect(sqliteSrv).toBeDefined();
    expect(sqliteSrv?.status).toBe('running');
    expect(sqliteSrv?.isPortable).toBe(true);

    const pgSrv = services.find(s => s.id === 'postgres');
    expect(pgSrv).toBeDefined();
    expect(pgSrv?.name).toBe('PostgreSQL');
  });

  it('should list portable tool status and availability', async () => {
    const tools = await safeApi.getPortableToolsStatus();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);

    const pgTools = tools.find(t => t.id === 'postgres_tools');
    expect(pgTools).toBeDefined();
    expect(pgTools?.downloadUrl).toBeDefined();

    const sqliteTool = tools.find(t => t.id === 'sqlite_engine');
    expect(sqliteTool).toBeDefined();
    expect(sqliteTool?.isInstalled).toBe(true);
  });

  it('should generate/extract DDL for database objects', async () => {
    const ddl = await safeApi.getObjectDdl('mock-conn', 'table', 'users', 'public');
    expect(ddl).toBeDefined();
    expect(ddl.objectName).toBe('users');
    expect(ddl.objectType).toBe('table');
    expect(ddl.ddl).toContain('CREATE TABLE users');
  });

  it('should return hierarchical database tree for SGBD navigation', async () => {
    const tree = await safeApi.getSchemaTree('mock-conn');
    expect(Array.isArray(tree)).toBe(true);
    expect(tree.length).toBeGreaterThan(0);

    const root = tree[0];
    expect(root.nodeType).toBe('database');
    expect(Array.isArray(root.children)).toBe(true);
    expect(root.children.length).toBeGreaterThan(0);

    const schema = root.children[0];
    expect(schema.nodeType).toBe('schema');
  });

  it('should initiate and log backup process with structured options', async () => {
    const options: BackupOptions = {
      connectionId: 'test-conn',
      databaseName: 'test_db',
      outputPath: 'C:\\Backups\\test_db.sql',
      format: 'sql',
      dumpType: 'full',
      dropExisting: true
    };

    const res = await safeApi.startBackup(options);
    expect(res).toBeDefined();
    expect(typeof res).toBe('string');
  });

  it('should initiate restore process with structured options', async () => {
    const options: RestoreOptions = {
      connectionId: 'test-conn',
      databaseName: 'test_db',
      inputPath: 'C:\\Backups\\test_db.sql',
      format: 'sql',
      dropFirst: true
    };

    const res = await safeApi.startRestore(options);
    expect(res).toBeDefined();
    expect(typeof res).toBe('string');
  });
});
