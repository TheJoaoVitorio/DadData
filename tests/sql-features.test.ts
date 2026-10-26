import { describe, it, expect } from 'vitest';
import { validateSql, getDialectDisplayName } from '../src/utils/sql-validator';
import { formatSql } from '../src/utils/sql-formatter';
import {
  generateSelectTemplate,
  generateInsertTemplate,
  generateUpdateTemplate,
  generateDeleteTemplate
} from '../src/utils/sql-templates';

describe('SQL Syntax Validation per Database Dialect', () => {
  it('should format dialect display names correctly', () => {
    expect(getDialectDisplayName('postgres')).toBe('PostgreSQL');
    expect(getDialectDisplayName('mysql')).toBe('MySQL');
    expect(getDialectDisplayName('mssql')).toBe('SQL Server (T-SQL)');
    expect(getDialectDisplayName('firebird')).toBe('Firebird SQL');
    expect(getDialectDisplayName('paradox')).toBe('Paradox SQL');
    expect(getDialectDisplayName('nexusdb')).toBe('NexusDB SQL');
  });

  it('should detect unclosed quotes and unmatched parentheses', () => {
    const unclosedQuotes = validateSql("SELECT * FROM clientes WHERE nome = 'João", 'postgres');
    expect(unclosedQuotes.isValid).toBe(false);
    expect(unclosedQuotes.status).toBe('error');
    expect(unclosedQuotes.message).toContain('Aspas simples');

    const unmatchedParens = validateSql('SELECT * FROM clientes WHERE (id = 1', 'mysql');
    expect(unmatchedParens.isValid).toBe(false);
    expect(unmatchedParens.status).toBe('error');
    expect(unmatchedParens.message).toContain('Parêntese');
  });

  it('should flag LIMIT in SQL Server and Firebird', () => {
    const mssqlLimit = validateSql('SELECT * FROM Clientes LIMIT 10;', 'mssql');
    expect(mssqlLimit.isValid).toBe(false);
    expect(mssqlLimit.status).toBe('error');
    expect(mssqlLimit.message).toContain('não suporta "LIMIT"');

    const firebirdLimit = validateSql('SELECT * FROM Clientes LIMIT 10;', 'firebird');
    expect(firebirdLimit.isValid).toBe(false);
    expect(firebirdLimit.status).toBe('error');
    expect(firebirdLimit.message).toContain('não suporta "LIMIT"');
  });

  it('should flag TOP in PostgreSQL and MySQL', () => {
    const pgTop = validateSql('SELECT TOP 10 * FROM Clientes;', 'postgres');
    expect(pgTop.isValid).toBe(false);
    expect(pgTop.status).toBe('error');
    expect(pgTop.message).toContain('não é suportada no PostgreSQL');

    const myTop = validateSql('SELECT TOP 10 * FROM Clientes;', 'mysql');
    expect(myTop.isValid).toBe(false);
    expect(myTop.status).toBe('error');
    expect(myTop.message).toContain('não é suportada no MySQL');
  });

  it('should flag FIRST / SKIP outside Firebird', () => {
    const pgFirst = validateSql('SELECT FIRST 10 * FROM Clientes;', 'postgres');
    expect(pgFirst.isValid).toBe(false);
    expect(pgFirst.message).toContain('exclusivo do Firebird');

    const fbFirst = validateSql('SELECT FIRST 10 * FROM Clientes;', 'firebird');
    expect(fbFirst.isValid).toBe(true);
    expect(fbFirst.status).toBe('valid');
  });

  it('should warn on UPDATE and DELETE statements without WHERE clause', () => {
    const unsafeUpdate = validateSql('UPDATE Clientes SET status = 1', 'postgres');
    expect(unsafeUpdate.isValid).toBe(true);
    expect(unsafeUpdate.status).toBe('warning');
    expect(unsafeUpdate.message).toContain('sem cláusula WHERE');

    const unsafeDelete = validateSql('DELETE FROM Clientes', 'postgres');
    expect(unsafeDelete.isValid).toBe(true);
    expect(unsafeDelete.status).toBe('warning');
    expect(unsafeDelete.message).toContain('sem cláusula WHERE');

    const safeUpdate = validateSql('UPDATE Clientes SET status = 1 WHERE id = 10', 'postgres');
    expect(safeUpdate.status).toBe('valid');

    const safeDelete = validateSql('DELETE FROM Clientes WHERE id = 10', 'postgres');
    expect(safeDelete.status).toBe('valid');
  });

  it('should validate complete INSERT statements and check column count', () => {
    const invalidInsert = validateSql('INSERT INTO Clientes (nome, email) VALUES (\'João\');', 'mysql');
    expect(invalidInsert.isValid).toBe(false);
    expect(invalidInsert.message).toContain('Divergência');

    const validInsert = validateSql('INSERT INTO Clientes (nome, email) VALUES (\'João\', \'joao@teste.com\');', 'mysql');
    expect(validInsert.isValid).toBe(true);
    expect(validInsert.status).toBe('valid');
  });
});

describe('SQL Formatter Suite', () => {
  it('should format and uppercase SQL keywords', () => {
    const input = 'select id, nome, email from clientes where id = 1 order by nome asc';
    const formatted = formatSql(input, 'postgres');

    expect(formatted).toContain('SELECT');
    expect(formatted).toContain('FROM');
    expect(formatted).toContain('WHERE');
    expect(formatted).toContain('ORDER BY');
  });

  it('should handle dialect-specific formatting gracefully', () => {
    const mssqlInput = 'select top (10) [id], [nome] from [clientes] where [ativo] = 1';
    const formatted = formatSql(mssqlInput, 'mssql');

    expect(formatted).toContain('SELECT');
    expect(formatted).toContain('TOP (10)');
    expect(formatted).toContain('[id]');
  });
});

describe('SQL DML Template Generator Suite', () => {
  const mockColumns = [
    { name: 'id', type: 'INTEGER', isPrimaryKey: true, nullable: false },
    { name: 'nome', type: 'VARCHAR(100)', isPrimaryKey: false, nullable: false },
    { name: 'email', type: 'VARCHAR(150)', isPrimaryKey: false, nullable: true },
    { name: 'preco', type: 'DECIMAL(10,2)', isPrimaryKey: false, nullable: false }
  ];

  it('should generate dialect-specific SELECT templates', () => {
    const pgSel = generateSelectTemplate('clientes', 'postgres');
    expect(pgSel).toContain('SELECT *');
    expect(pgSel).toContain('"clientes"');
    expect(pgSel).toContain('LIMIT 100');

    const mySel = generateSelectTemplate('clientes', 'mysql');
    expect(mySel).toContain('`clientes`');
    expect(mySel).toContain('LIMIT 100');

    const msSel = generateSelectTemplate('clientes', 'mssql');
    expect(msSel).toContain('SELECT TOP (100) *');
    expect(msSel).toContain('[clientes]');

    const fbSel = generateSelectTemplate('clientes', 'firebird');
    expect(fbSel).toContain('SELECT FIRST 100 *');
    expect(fbSel).toContain('"clientes"');
  });

  it('should generate dialect-specific INSERT templates with columns and types', () => {
    const pgIns = generateInsertTemplate('clientes', 'postgres', mockColumns);
    expect(pgIns).toContain('INSERT INTO "clientes"');
    expect(pgIns).toContain('"id"');
    expect(pgIns).toContain('"nome"');
    expect(pgIns).toContain('VALUES');

    const myIns = generateInsertTemplate('clientes', 'mysql', mockColumns);
    expect(myIns).toContain('INSERT INTO `clientes`');
    expect(myIns).toContain('`id`');
  });

  it('should generate dialect-specific UPDATE and DELETE templates using primary key', () => {
    const upd = generateUpdateTemplate('clientes', 'postgres', mockColumns);
    expect(upd).toContain('UPDATE "clientes"');
    expect(upd).toContain('SET');
    expect(upd).toContain('WHERE "id" = 1');

    const del = generateDeleteTemplate('clientes', 'postgres', mockColumns);
    expect(del).toContain('DELETE FROM "clientes"');
    expect(del).toContain('WHERE "id" = 1');
  });
});
