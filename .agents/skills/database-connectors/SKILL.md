---
name: database-connectors
description: >-
  Especificações, protocolos e arquitetura dos conectores de bancos de dados modernos e legados (Paradox, DBF, Access, HFSQL, NexusDB, Firebird, PostgreSQL, MySQL, SQL Server, SQLite, MongoDB).
---

# Database Connectors Skill

## Interface Unificada `DatabaseDriver`

Todos os drivers implementam o contrato:

```typescript
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
```

## Suporte a Bancos Legados de Arquivo

### 1. DBF (dBase III, IV, FoxPro, Clipper)
- Formato de arquivo binário estruturado com cabeçalho de 32 bytes + descritores de campos (32 bytes cada) + registros de tamanho fixo.
- Parsing nativo com decodificação de tipos (C = Char, N = Numeric, D = Date, L = Logical, M = Memo com ponteiro para `.FPT`/`.DBT`).
- Suporte a leitura direta de arquivos `.dbf` selecionados via File Picker ou pasta.

### 2. Paradox (.DB)
- Formato clássico Borland/Corel (versões 3.5, 4.x, 5.x, 7.x).
- Cabeçalho contém tamanho do bloco, total de registros, número de campos e tabela de tipos de dados Paradox ($01 = Alpha, $02 = Date, $03 = Short, $04 = Long, $05 = Currency, $06 = Number, etc.).
- Parsing direto de arquivos `.db` e tabelas Paradox.

### 3. Microsoft Access (.MDB / .ACCDB)
- Formato Jet / ACE Engine da Microsoft.
- Leitura direta via parser de páginas JET (Page size 2048/4096 bytes) e ponte de driver Windows (OLEDB/ODBC/node-adodb).

### 4. HFSQL / HyperFileSQL (.FIC)
- Formato nativo PC SOFT WinDev / WebDev.
- Arquivos `.FIC` (dados), `.NDX` (índices), `.MMO` (memos).
- Suporte a leitura de dados estruturados e tabelas WinDev.

### 5. NexusDB
- Formato relacional para Delphi / C++Builder.
- Conexão TCP/IP ou leitura de arquivos de tabela `.nx1`.

## Bancos Modernos
- **SQLite**: Local, ultra-rápido, suporte completo a SQL ANSI.
- **PostgreSQL**: Suporte a versões 9.x a 17.x, schemas múltiplos, tipos avançados JSONB, arrays.
- **MySQL / MariaDB**: Suporte a versões 5.5 a 8.4 com autenticação moderna (caching_sha2_password e mysql_native_password).
- **SQL Server**: T-SQL, conexões com instâncias nomeadas e autenticação SQL ou Windows.
- **MongoDB**: Suporte a coleções, queries no formato BSON/JSON, projeção e CRUD NoSQL.
- **Firebird**: Suporte a dialetos 1 e 3, conexões locais e remotas.
