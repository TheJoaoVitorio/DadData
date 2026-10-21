import { describe, it, expect } from 'vitest';
import { safeApi, isTauri, isDesktop } from '../src/services/api-client';

describe('DadData Client API & Tauri Integration Suite', () => {
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
});
