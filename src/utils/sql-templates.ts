import { DatabaseType, ColumnInfo } from '../types/database';

function quoteIdentifier(ident: string, dbType?: DatabaseType | string): string {
  const db = (dbType || '').toLowerCase();
  switch (db) {
    case 'mysql':
    case 'mariadb':
      return `\`${ident}\``;
    case 'mssql':
    case 'sqlserver':
    case 'access':
      return `[${ident}]`;
    case 'dbf':
      return ident;
    default:
      return `"${ident}"`;
  }
}

function sampleValueForType(colType: string): string {
  const t = colType.toUpperCase();
  if (t.includes('INT') || t.includes('NUMBER') || t.includes('SERIAL') || t.includes('NUMERIC')) {
    return '1';
  }
  if (t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL') || t.includes('REAL') || t.includes('CURRENCY')) {
    return '19.90';
  }
  if (t.includes('BOOL')) {
    return 'TRUE';
  }
  if (t.includes('DATE') || t.includes('TIME')) {
    return `'2026-10-26'`;
  }
  return `'Novo Registro'`;
}

export function generateSelectTemplate(
  tableName: string,
  dbType?: DatabaseType | string
): string {
  const qTable = quoteIdentifier(tableName, dbType);
  const db = (dbType || '').toLowerCase();

  switch (db) {
    case 'mssql':
    case 'sqlserver':
      return `SELECT TOP (100) * \nFROM ${qTable};`;
    case 'access':
      return `SELECT TOP 100 * \nFROM ${qTable};`;
    case 'firebird':
      return `SELECT FIRST 100 * \nFROM ${qTable};`;
    case 'paradox':
    case 'nexusdb':
    case 'dbf':
      return `SELECT * \nFROM ${qTable};`;
    default:
      // Postgres, MySQL, SQLite
      return `SELECT * \nFROM ${qTable} \nLIMIT 100;`;
  }
}

export function generateInsertTemplate(
  tableName: string,
  dbType?: DatabaseType | string,
  columns?: ColumnInfo[]
): string {
  const qTable = quoteIdentifier(tableName, dbType);

  if (!columns || columns.length === 0) {
    return `INSERT INTO ${qTable} (coluna_1, coluna_2) \nVALUES ('Valor 1', 100);`;
  }

  const targetCols = columns.slice(0, Math.min(columns.length, 5));
  const colNames = targetCols.map(c => quoteIdentifier(c.name, dbType)).join(', ');
  const valPlaceholders = targetCols.map(c => sampleValueForType(c.type)).join(', ');

  return `INSERT INTO ${qTable} (${colNames}) \nVALUES (${valPlaceholders});`;
}

export function generateUpdateTemplate(
  tableName: string,
  dbType?: DatabaseType | string,
  columns?: ColumnInfo[]
): string {
  const qTable = quoteIdentifier(tableName, dbType);

  if (!columns || columns.length === 0) {
    return `UPDATE ${qTable} \nSET coluna = 'Novo Valor' \nWHERE id = 1;`;
  }

  const pkCol = columns.find(c => c.isPrimaryKey) || columns[0];
  const updateCols = columns.filter(c => c.name !== pkCol.name);
  const colToUpdate = updateCols[0] || pkCol;

  const qCol = quoteIdentifier(colToUpdate.name, dbType);
  const qPk = quoteIdentifier(pkCol.name, dbType);
  const sampleVal = sampleValueForType(colToUpdate.type);
  const samplePkVal = sampleValueForType(pkCol.type);

  return `UPDATE ${qTable} \nSET ${qCol} = ${sampleVal} \nWHERE ${qPk} = ${samplePkVal};`;
}

export function generateDeleteTemplate(
  tableName: string,
  dbType?: DatabaseType | string,
  columns?: ColumnInfo[]
): string {
  const qTable = quoteIdentifier(tableName, dbType);

  if (!columns || columns.length === 0) {
    return `DELETE FROM ${qTable} \nWHERE id = 1;`;
  }

  const pkCol = columns.find(c => c.isPrimaryKey) || columns[0];
  const qPk = quoteIdentifier(pkCol.name, dbType);
  const samplePkVal = sampleValueForType(pkCol.type);

  return `DELETE FROM ${qTable} \nWHERE ${qPk} = ${samplePkVal};`;
}
