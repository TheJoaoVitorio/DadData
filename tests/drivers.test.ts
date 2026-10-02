import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { DriverManager } from '../src/drivers/driver-manager';
import { ExportService } from '../src/main/export/export-service';

describe('DadData Database Drivers & Export Suite', () => {
  const driverManager = DriverManager.getInstance();
  const testDir = path.join(process.cwd(), 'test-output');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    driverManager.createTestDatabases(testDir);
  });

  describe('1. SQLite Driver & CRUD', () => {
    const connId = 'test-sqlite';
    const dbPath = path.join(testDir, 'test_sqlite.db');

    it('should connect and create tables', async () => {
      const conn = await driverManager.connect({
        id: connId,
        name: 'SQLite Test',
        type: 'sqlite',
        filePath: dbPath
      });
      expect(conn.success).toBe(true);

      // Create table
      await driverManager.executeQuery(
        connId,
        'CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, balance REAL);'
      );

      const tables = await driverManager.listTables(connId);
      expect(tables.some(t => t.name === 'clients')).toBe(true);
    });

    it('should perform INSERT, SELECT, UPDATE, DELETE (CRUD)', async () => {
      // INSERT
      const insertRes = await driverManager.insertRow(connId, 'clients', {
        name: 'João Silva',
        balance: 1500.50
      });
      expect(insertRes.success).toBe(true);
      expect(insertRes.affectedRows).toBe(1);

      // SELECT
      const queryRes = await driverManager.executeQuery(connId, 'SELECT * FROM clients;');
      expect(queryRes.rowCount).toBeGreaterThanOrEqual(1);
      const inserted = queryRes.rows.find(r => r.name === 'João Silva');
      expect(inserted).toBeDefined();
      expect(inserted?.balance).toBe(1500.50);

      // UPDATE
      const updateRes = await driverManager.updateRow(
        connId,
        'clients',
        { id: inserted?.id },
        { balance: 2500.75 }
      );
      expect(updateRes.success).toBe(true);

      const checkUpdate = await driverManager.executeQuery(
        connId,
        `SELECT * FROM clients WHERE id = ${inserted?.id};`
      );
      expect(checkUpdate.rows[0].balance).toBe(2500.75);

      // DELETE
      const deleteRes = await driverManager.deleteRow(connId, 'clients', { id: inserted?.id });
      expect(deleteRes.success).toBe(true);

      const checkDelete = await driverManager.executeQuery(
        connId,
        `SELECT * FROM clients WHERE id = ${inserted?.id};`
      );
      expect(checkDelete.rowCount).toBe(0);

      await driverManager.disconnect(connId);
    });
  });

  describe('2. Legacy DBF (dBase / FoxPro / Clipper) Driver', () => {
    const connId = 'test-dbf';
    const dbfPath = path.join(testDir, 'clientes_vendas.dbf');

    it('should connect, inspect schema and read records', async () => {
      const conn = await driverManager.connect({
        id: connId,
        name: 'DBF Sample',
        type: 'dbf',
        filePath: dbfPath
      });
      expect(conn.success).toBe(true);

      const tables = await driverManager.listTables(connId);
      expect(tables.length).toBeGreaterThan(0);
      expect(tables[0].name.toLowerCase()).toContain('clientes_vendas');

      const columns = await driverManager.describeTable(connId, tables[0].name);
      expect(columns.some(c => c.name === 'CODIGO')).toBe(true);
      expect(columns.some(c => c.name === 'NOME')).toBe(true);

      const queryRes = await driverManager.executeQuery(connId, `SELECT * FROM ${tables[0].name}`);
      expect(queryRes.rowCount).toBe(5);
      expect(queryRes.rows[0].NOME).toContain('Auto Peças');
    });

    it('should perform CRUD on DBF file', async () => {
      const tables = await driverManager.listTables(connId);
      const tableName = tables[0].name;

      // INSERT
      const insertRes = await driverManager.insertRow(connId, tableName, {
        CODIGO: 999,
        NOME: 'Nova Empresa Teste',
        CIDADE: 'Ribeirão Preto',
        SALDO: 7800.00,
        ATIVO: true,
        CADASTRO: '20240901'
      });
      expect(insertRes.success).toBe(true);

      // Read back
      const queryRes = await driverManager.executeQuery(connId, `SELECT * FROM ${tableName}`);
      expect(queryRes.rows.some(r => r.CODIGO === 999)).toBe(true);

      // UPDATE
      const updateRes = await driverManager.updateRow(
        connId,
        tableName,
        { CODIGO: 999 },
        { CIDADE: 'Santos', SALDO: 9900.50 }
      );
      expect(updateRes.success).toBe(true);

      const queryUpdated = await driverManager.executeQuery(connId, `SELECT * FROM ${tableName}`);
      const updatedRow = queryUpdated.rows.find(r => r.CODIGO === 999);
      expect(updatedRow?.CIDADE).toBe('Santos');

      // DELETE
      const delRes = await driverManager.deleteRow(connId, tableName, { CODIGO: 999 });
      expect(delRes.success).toBe(true);

      const queryAfterDel = await driverManager.executeQuery(connId, `SELECT * FROM ${tableName}`);
      expect(queryAfterDel.rows.some(r => r.CODIGO === 999)).toBe(false);

      await driverManager.disconnect(connId);
    });
  });

  describe('3. Legacy Paradox (.DB) Driver', () => {
    const connId = 'test-paradox';
    const paradoxPath = path.join(testDir, 'clientes_corp.db');

    it('should parse Paradox header, field types and decode rows', async () => {
      const conn = await driverManager.connect({
        id: connId,
        name: 'Paradox Sample',
        type: 'paradox',
        filePath: paradoxPath
      });
      expect(conn.success).toBe(true);

      const tables = await driverManager.listTables(connId);
      expect(tables.length).toBeGreaterThan(0);

      const columns = await driverManager.describeTable(connId, tables[0].name);
      expect(columns.some(c => c.name === 'RAZAO_SOCIAL')).toBe(true);
      expect(columns.some(c => c.name === 'LIMITE_CREDITO')).toBe(true);

      const queryRes = await driverManager.executeQuery(connId, `SELECT * FROM ${tables[0].name}`);
      expect(queryRes.rowCount).toBe(4);
      expect(queryRes.rows[0].RAZAO_SOCIAL).toBe('Indústria Metalúrgica Paulista');

      await driverManager.disconnect(connId);
    });

    it('should parse real production Paradox table with correct field names when available', async () => {
      const realFile = 'C:/Users/Delphi - João/Downloads/wsicbck/TabEst1.db';
      if (!fs.existsSync(realFile)) return;

      const conn = await driverManager.connect({
        id: 'test-real-paradox',
        name: 'TabEst1 Real',
        type: 'paradox',
        filePath: realFile
      });
      expect(conn.success).toBe(true);

      const columns = await driverManager.describeTable('test-real-paradox', 'TabEst1');
      expect(columns.length).toBe(38);
      expect(columns[0].name).toBe('Controle');
      expect(columns[1].name).toBe('Codigo');
      expect(columns[3].name).toBe('Produto');

      const queryRes = await driverManager.executeQuery('test-real-paradox', 'SELECT * FROM TabEst1');
      expect(queryRes.rowCount).toBe(1942);
      expect(queryRes.rows[0].Controle).toBe(1);
      expect(queryRes.rows[0].Codigo).toBe('7897770830059');
      expect(queryRes.rows[0].Produto).toBe('MAURICEA COQUINHO 330G');

      await driverManager.disconnect('test-real-paradox');
    });
  });

  describe('4. Legacy Microsoft Access (.MDB) Driver', () => {
    const connId = 'test-access';
    const mdbPath = path.join(testDir, 'northwind.mdb');

    it('should introspect Access tables and query customers', async () => {
      const conn = await driverManager.connect({
        id: connId,
        name: 'Access Northwind',
        type: 'access',
        filePath: mdbPath
      });
      expect(conn.success).toBe(true);

      const tables = await driverManager.listTables(connId);
      expect(tables.some(t => t.name === 'Customers')).toBe(true);

      const queryRes = await driverManager.executeQuery(connId, 'SELECT * FROM Customers WHERE Country = Germany');
      expect(queryRes.rowCount).toBe(1);
      expect(queryRes.rows[0].CompanyName).toBe('Alfreds Futterkiste');

      await driverManager.disconnect(connId);
    });
  });

  describe('5. Legacy HFSQL (.FIC) Driver', () => {
    const connId = 'test-hfsql';
    const ficPath = path.join(testDir, 'produtos.fic');

    it('should connect to HFSQL file and read catalog', async () => {
      const conn = await driverManager.connect({
        id: connId,
        name: 'HFSQL Sample',
        type: 'hfsql',
        filePath: ficPath
      });
      expect(conn.success).toBe(true);

      const tables = await driverManager.listTables(connId);
      expect(tables.length).toBeGreaterThan(0);

      const res = await driverManager.executeQuery(connId, `SELECT * FROM ${tables[0].name}`);
      expect(res.rowCount).toBe(4);
      expect(res.rows[0].REFERENCIA).toBe('REF-A120');

      await driverManager.disconnect(connId);
    });
  });

  describe('6. Export Service (CSV & Excel .xlsx)', () => {
    const columns = ['id', 'nome', 'valor', 'ativo'];
    const rows = [
      { id: 1, nome: 'Produto A "Especial"', valor: 199.90, ativo: true },
      { id: 2, nome: 'Produto B; com separador', valor: 450.00, ativo: false },
      { id: 3, nome: 'Produto C com acentuação: Atenção & Operação', valor: 89.25, ativo: true }
    ];

    it('should export to CSV with UTF-8 BOM and correct delimiter escaping', async () => {
      const csvPath = path.join(testDir, 'export_test.csv');
      const res = await ExportService.exportToCsv(columns, rows, {
        format: 'csv',
        targetFilePath: csvPath,
        delimiter: ';'
      });

      expect(res.success).toBe(true);
      expect(res.rowCount).toBe(3);
      expect(fs.existsSync(csvPath)).toBe(true);

      const content = fs.readFileSync(csvPath, 'utf8');
      expect(content.startsWith('\uFEFF')).toBe(true); // Has BOM
      expect(content).toContain('id;nome;valor;ativo');
      expect(content).toContain('Produto A ""Especial""');
    });

    it('should export to Excel (.xlsx) with formatted worksheet', async () => {
      const xlsxPath = path.join(testDir, 'export_test.xlsx');
      const res = await ExportService.exportToExcel(columns, rows, {
        format: 'xlsx',
        targetFilePath: xlsxPath,
        sheetName: 'Relatório Clientes'
      });

      expect(res.success).toBe(true);
      expect(res.rowCount).toBe(3);
      expect(fs.existsSync(xlsxPath)).toBe(true);
      expect(res.fileSizeBytes).toBeGreaterThan(1000);
    });
  });
});
