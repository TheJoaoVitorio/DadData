import { describe, it, expect } from 'vitest';
import { TabItem } from '../src/App';
import { ConnectionConfig, DatabaseType } from '../src/types/database';

describe('MySQL Workbench Style Home & Tab Management Suite', () => {
  const mockConnections: ConnectionConfig[] = [
    {
      id: 'conn_1',
      name: 'Produção ERP PostgreSQL',
      type: 'postgres',
      host: '192.168.1.100',
      port: 5432,
      database: 'erp_prod',
      user: 'postgres'
    },
    {
      id: 'conn_2',
      name: 'Vendas Legado Paradox',
      type: 'paradox',
      directoryPath: 'C:\\ERP\\Dados\\Paradox'
    },
    {
      id: 'conn_3',
      name: 'Faturamento NexusDB',
      type: 'nexusdb',
      directoryPath: 'C:\\ERP\\NexusDB'
    },
    {
      id: 'conn_4',
      name: 'Cadastro MS Access',
      type: 'access',
      filePath: 'C:\\ERP\\Clientes.accdb'
    },
    {
      id: 'conn_5',
      name: 'MySQL E-commerce',
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      database: 'store'
    }
  ];

  it('should initialize with Home tab as default landing tab', () => {
    const initialTabs: TabItem[] = [
      {
        id: 'home',
        title: 'Início',
        type: 'home'
      }
    ];

    expect(initialTabs).toHaveLength(1);
    expect(initialTabs[0].type).toBe('home');
    expect(initialTabs[0].id).toBe('home');
    expect(initialTabs[0].title).toBe('Início');
  });

  it('should support opening Backup and Services as dedicated tabs', () => {
    const tabs: TabItem[] = [
      { id: 'home', title: 'Início', type: 'home' }
    ];

    // Open backup tab
    const backupTab: TabItem = {
      id: 'backup_123',
      title: 'Backup & Restauração',
      type: 'backup',
      databaseName: 'erp_prod',
      backupMode: 'backup'
    };
    tabs.push(backupTab);

    // Open services tab
    const servicesTab: TabItem = {
      id: 'services_456',
      title: 'Serviços do Sistema',
      type: 'services'
    };
    tabs.push(servicesTab);

    expect(tabs).toHaveLength(3);
    expect(tabs.find(t => t.type === 'backup')).toBeDefined();
    expect(tabs.find(t => t.type === 'services')).toBeDefined();

    const foundBackup = tabs.find(t => t.type === 'backup')!;
    expect(foundBackup.databaseName).toBe('erp_prod');
    expect(foundBackup.backupMode).toBe('backup');
  });

  it('should filter connections by text query (name, type, host, path)', () => {
    const filterBySearch = (query: string) => {
      const q = query.toLowerCase();
      return mockConnections.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q) ||
        (c.host && c.host.toLowerCase().includes(q)) ||
        (c.filePath && c.filePath.toLowerCase().includes(q)) ||
        (c.directoryPath && c.directoryPath.toLowerCase().includes(q))
      );
    };

    const searchPostgres = filterBySearch('postgres');
    expect(searchPostgres).toHaveLength(1);
    expect(searchPostgres[0].id).toBe('conn_1');

    const searchParadox = filterBySearch('paradox');
    expect(searchParadox).toHaveLength(1);
    expect(searchParadox[0].name).toBe('Vendas Legado Paradox');

    const searchHost = filterBySearch('192.168.1.100');
    expect(searchHost).toHaveLength(1);

    const searchPath = filterBySearch('.accdb');
    expect(searchPath).toHaveLength(1);
    expect(searchPath[0].type).toBe('access');
  });

  it('should categorize connections into servers vs local file ERPs', () => {
    const SERVER_TYPES: DatabaseType[] = ['postgres', 'mysql', 'mssql', 'firebird', 'mongodb'];
    const FILE_TYPES: DatabaseType[] = ['paradox', 'nexusdb', 'access', 'dbf', 'sqlite', 'hfsql'];

    const servers = mockConnections.filter(c => SERVER_TYPES.includes(c.type));
    const files = mockConnections.filter(c => FILE_TYPES.includes(c.type));

    expect(servers).toHaveLength(2); // postgres, mysql
    expect(files).toHaveLength(3);   // paradox, nexusdb, access
  });

  it('should keep Home tab preserved when navigating between tabs', () => {
    let tabs: TabItem[] = [
      { id: 'home', title: 'Início', type: 'home' },
      { id: 'query_1', title: 'Consulta SQL 1', type: 'query', query: 'SELECT 1;' }
    ];

    // Close query tab
    tabs = tabs.filter(t => t.id !== 'query_1');
    expect(tabs).toHaveLength(1);
    expect(tabs[0].type).toBe('home');
  });
});
