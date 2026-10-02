import fs from 'fs';
import path from 'path';
import { DatabaseDriver } from './driver-interface';
import { SqliteDriver } from './sqlite/sqlite-driver';
import { DbfDriver } from './dbf/dbf-driver';
import { DbfParser } from './dbf/dbf-parser';
import { ParadoxDriver } from './paradox/paradox-driver';
import { ParadoxParser } from './paradox/paradox-parser';
import { AccessDriver } from './access/access-driver';
import { HfsqlDriver } from './hfsql/hfsql-driver';
import { NexusDbDriver } from './nexusdb/nexusdb-driver';
import { PostgresDriver } from './postgres/postgres-driver';
import { MysqlDriver } from './mysql/mysql-driver';
import { MssqlDriver } from './mssql/mssql-driver';
import { MongodbDriver } from './mongodb/mongodb-driver';
import { FirebirdDriver } from './firebird/firebird-driver';

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

export class DriverManager {
  private static instance: DriverManager;
  private activeConnections: Map<string, { driver: DatabaseDriver; config: ConnectionConfig }> = new Map();

  static getInstance(): DriverManager {
    if (!DriverManager.instance) {
      DriverManager.instance = new DriverManager();
    }
    return DriverManager.instance;
  }

  createDriver(type: DatabaseType): DatabaseDriver {
    switch (type) {
      case 'sqlite': return new SqliteDriver();
      case 'dbf': return new DbfDriver();
      case 'paradox': return new ParadoxDriver();
      case 'access': return new AccessDriver();
      case 'hfsql': return new HfsqlDriver();
      case 'nexusdb': return new NexusDbDriver();
      case 'postgres': return new PostgresDriver();
      case 'mysql': return new MysqlDriver();
      case 'mssql': return new MssqlDriver();
      case 'mongodb': return new MongodbDriver();
      case 'firebird': return new FirebirdDriver();
      default:
        throw new Error(`Unsupported database driver type: ${type}`);
    }
  }

  async connect(config: ConnectionConfig): Promise<ConnectionResult> {
    // If existing connection with this ID is open, disconnect first
    if (this.activeConnections.has(config.id)) {
      await this.disconnect(config.id);
    }

    const driver = this.createDriver(config.type);
    const result = await driver.connect(config);
    this.activeConnections.set(config.id, { driver, config });
    return result;
  }

  async disconnect(connectionId: string): Promise<void> {
    const conn = this.activeConnections.get(connectionId);
    if (conn) {
      await conn.driver.disconnect();
      this.activeConnections.delete(connectionId);
    }
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; message?: string }> {
    const driver = this.createDriver(config.type);
    return driver.testConnection(config);
  }

  getDriver(connectionId: string): DatabaseDriver {
    const conn = this.activeConnections.get(connectionId);
    if (!conn) {
      throw new Error(`Connection ${connectionId} is not active. Please connect first.`);
    }
    return conn.driver;
  }

  getActiveConnectionConfig(connectionId: string): ConnectionConfig | undefined {
    return this.activeConnections.get(connectionId)?.config;
  }

  listActiveConnections(): ConnectionConfig[] {
    return Array.from(this.activeConnections.values()).map(c => c.config);
  }

  async listTables(connectionId: string): Promise<TableInfo[]> {
    const driver = this.getDriver(connectionId);
    return driver.listTables();
  }

  async describeTable(connectionId: string, tableName: string): Promise<ColumnInfo[]> {
    const driver = this.getDriver(connectionId);
    return driver.describeTable(tableName);
  }

  async executeQuery(connectionId: string, query: string, options?: QueryOptions): Promise<QueryResult> {
    const driver = this.getDriver(connectionId);
    return driver.executeQuery(query, options);
  }

  async insertRow(connectionId: string, tableName: string, data: Record<string, any>): Promise<MutationResult> {
    const driver = this.getDriver(connectionId);
    return driver.insertRow(tableName, data);
  }

  async updateRow(
    connectionId: string,
    tableName: string,
    primaryKey: Record<string, any>,
    changes: Record<string, any>
  ): Promise<MutationResult> {
    const driver = this.getDriver(connectionId);
    return driver.updateRow(tableName, primaryKey, changes);
  }

  async deleteRow(connectionId: string, tableName: string, primaryKey: Record<string, any>): Promise<MutationResult> {
    const driver = this.getDriver(connectionId);
    return driver.deleteRow(tableName, primaryKey);
  }

  // Helper for test fixtures in test suite
  createTestDatabases(testOutputDir: string): { name: string; type: DatabaseType; filePath: string }[] {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    const testFiles: { name: string; type: DatabaseType; filePath: string }[] = [];

    // 1. DBF Test Fixture
    const dbfPath = path.join(testOutputDir, 'clientes_vendas.dbf');
    if (!fs.existsSync(dbfPath)) {
      DbfParser.createSampleDbf(dbfPath);
    }
    testFiles.push({ name: 'Clientes & Vendas (dBase/FoxPro)', type: 'dbf', filePath: dbfPath });

    // 2. Paradox Test Fixture
    const paradoxPath = path.join(testOutputDir, 'clientes_corp.db');
    if (!fs.existsSync(paradoxPath)) {
      ParadoxParser.createSampleParadox(paradoxPath);
    }
    testFiles.push({ name: 'Clientes Corporativos (Paradox 7)', type: 'paradox', filePath: paradoxPath });

    // 3. Access Test Fixture
    const accessPath = path.join(testOutputDir, 'northwind.mdb');
    if (!fs.existsSync(accessPath)) {
      AccessDriver.createSampleAccess(accessPath);
    }
    testFiles.push({ name: 'Northwind Traders (Access MDB)', type: 'access', filePath: accessPath });

    // 4. HFSQL Test Fixture
    const hfsqlPath = path.join(testOutputDir, 'produtos.fic');
    if (!fs.existsSync(hfsqlPath)) {
      HfsqlDriver.createSampleHfsql(hfsqlPath);
    }
    testFiles.push({ name: 'Produtos & Estoque (HFSQL WinDev)', type: 'hfsql', filePath: hfsqlPath });

    // 5. NexusDB Test Fixture
    const nexusPath = path.join(testOutputDir, 'contas.nx1');
    if (!fs.existsSync(nexusPath)) {
      NexusDbDriver.createSampleNexusDb(nexusPath);
    }
    testFiles.push({ name: 'Contas Bancárias (NexusDB)', type: 'nexusdb', filePath: nexusPath });

    return testFiles;
  }
}
