import { DatabaseType } from '../types/database';

export interface SqlValidationResult {
  isValid: boolean;
  status: 'valid' | 'warning' | 'error';
  message: string;
  dialectName: string;
  suggestions?: string[];
  statementType?: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'DROP' | 'OTHER';
}

export const getDialectDisplayName = (dbType?: DatabaseType | string): string => {
  switch (dbType?.toLowerCase()) {
    case 'postgres':
    case 'postgresql':
      return 'PostgreSQL';
    case 'mysql':
    case 'mariadb':
      return 'MySQL';
    case 'mssql':
    case 'sqlserver':
      return 'SQL Server (T-SQL)';
    case 'sqlite':
      return 'SQLite';
    case 'firebird':
      return 'Firebird SQL';
    case 'paradox':
      return 'Paradox SQL';
    case 'nexusdb':
      return 'NexusDB SQL';
    case 'dbf':
      return 'dBase / DBF';
    case 'access':
      return 'MS Access';
    case 'mongodb':
      return 'MongoDB Query';
    default:
      return 'SQL Padrão';
  }
};

/**
 * Validates SQL query syntax according to the specific database dialect
 */
export function validateSql(sql: string, dbType?: DatabaseType | string): SqlValidationResult {
  const dialectName = getDialectDisplayName(dbType);
  const clean = sql.trim();

  if (!clean) {
    return {
      isValid: true,
      status: 'valid',
      message: `Pronto para digitar consulta (${dialectName})`,
      dialectName,
    };
  }

  // 1. Check bracket and quotation balance
  let singleQuotes = 0;
  let doubleQuotes = 0;
  let backticks = 0;
  let parens = 0;
  let brackets = 0;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const prev = i > 0 ? clean[i - 1] : '';

    if (ch === "'" && prev !== '\\') singleQuotes++;
    else if (ch === '"' && prev !== '\\') doubleQuotes++;
    else if (ch === '`' && prev !== '\\') backticks++;
    else if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0 && backticks % 2 === 0) {
      if (ch === '(') parens++;
      else if (ch === ')') parens--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;
    }
  }

  if (singleQuotes % 2 !== 0) {
    return {
      isValid: false,
      status: 'error',
      message: 'Aspas simples não foram fechadas corretamente (\').',
      dialectName,
    };
  }
  if (doubleQuotes % 2 !== 0) {
    return {
      isValid: false,
      status: 'error',
      message: 'Aspas duplas não foram fechadas corretamente (").',
      dialectName,
    };
  }
  if (backticks % 2 !== 0) {
    return {
      isValid: false,
      status: 'error',
      message: 'Crases não foram fechadas corretamente (`).',
      dialectName,
    };
  }
  if (parens > 0) {
    return {
      isValid: false,
      status: 'error',
      message: 'Parêntese de abertura "(" não foi fechado com ")".',
      dialectName,
    };
  }
  if (parens < 0) {
    return {
      isValid: false,
      status: 'error',
      message: 'Parêntese de fechamento ")" sem abertura correspondente.',
      dialectName,
    };
  }
  if (brackets !== 0) {
    return {
      isValid: false,
      status: 'error',
      message: 'Colchetes "[" e "]" não balanceados.',
      dialectName,
    };
  }

  // 2. Identify statement type
  const firstWordMatch = clean.match(/^([A-Za-z]+)/);
  const firstWord = firstWordMatch ? firstWordMatch[1].toUpperCase() : '';

  let statementType: SqlValidationResult['statementType'] = 'OTHER';
  if (['SELECT', 'WITH'].includes(firstWord)) statementType = 'SELECT';
  else if (firstWord === 'INSERT') statementType = 'INSERT';
  else if (firstWord === 'UPDATE') statementType = 'UPDATE';
  else if (firstWord === 'DELETE') statementType = 'DELETE';
  else if (firstWord === 'CREATE') statementType = 'CREATE';
  else if (firstWord === 'DROP') statementType = 'DROP';

  const upper = clean.toUpperCase();
  const db = (dbType || '').toLowerCase();

  // 3. Dialect-specific checks
  // 3.1 SELECT
  if (statementType === 'SELECT') {
    // Check TOP in non-MSSQL databases
    if (upper.includes(' TOP ') || upper.includes(' TOP(')) {
      if (!['mssql', 'sqlserver', 'access'].includes(db)) {
        return {
          isValid: false,
          status: 'error',
          message: `A cláusula "TOP" não é suportada no ${dialectName}.`,
          dialectName,
          suggestions: db === 'firebird'
            ? ['Utilize "SELECT FIRST n" no início da consulta.']
            : ['Utilize "LIMIT n" no final da consulta.'],
          statementType,
        };
      }
    }

    // Check LIMIT in MSSQL / Firebird
    if (/\bLIMIT\s+\d+/i.test(clean)) {
      if (['mssql', 'sqlserver'].includes(db)) {
        return {
          isValid: false,
          status: 'error',
          message: 'SQL Server (T-SQL) não suporta "LIMIT".',
          dialectName,
          suggestions: ['Utilize "SELECT TOP (n) ..." ou "OFFSET ... ROWS FETCH NEXT ... ROWS ONLY".'],
          statementType,
        };
      }
      if (db === 'firebird') {
        return {
          isValid: false,
          status: 'error',
          message: 'Firebird não suporta "LIMIT".',
          dialectName,
          suggestions: ['Utilize "SELECT FIRST n SKIP m ..." (Firebird 2/3/4) ou "OFFSET / FETCH" (Firebird 3+).'],
          statementType,
        };
      }
    }

    // Check FIRST / SKIP in non-Firebird databases
    if (/\bFIRST\s+\d+/i.test(clean) && db !== 'firebird') {
      return {
        isValid: false,
        status: 'error',
        message: `"FIRST / SKIP" é exclusivo do Firebird e não é suportado no ${dialectName}.`,
        dialectName,
        suggestions: ['Utilize "LIMIT" ou "TOP".'],
        statementType,
      };
    }

    // Check Firebird requires FROM RDB$DATABASE for scalar selects
    if (db === 'firebird' && !upper.includes(' FROM ') && !upper.includes(' EXECUTE ')) {
      return {
        isValid: false,
        status: 'warning',
        message: 'No Firebird, consultas de expressões sem tabela necessitam de "FROM RDB$DATABASE".',
        dialectName,
        suggestions: ['Adicione "FROM RDB$DATABASE" ao final da consulta.'],
        statementType,
      };
    }
  }

  // 3.2 INSERT
  if (statementType === 'INSERT') {
    if (!upper.includes(' INTO ')) {
      return {
        isValid: false,
        status: 'error',
        message: 'Cláusula "INTO" esperada após "INSERT" (ex: INSERT INTO tabela ...)',
        dialectName,
        statementType,
      };
    }
    if (!upper.includes(' VALUES') && !upper.includes(' SELECT ')) {
      return {
        isValid: false,
        status: 'error',
        message: 'Cláusula "VALUES" ou subconsulta "SELECT" esperada no comando INSERT.',
        dialectName,
        statementType,
      };
    }

    // Count columns vs values in INSERT INTO tbl (a, b) VALUES (1, 2)
    const parenMatches = clean.match(/\(([^)]+)\)/g);
    if (parenMatches && parenMatches.length >= 2) {
      const colsPart = parenMatches[0].replace(/[()]/g, '').trim();
      const valsPart = parenMatches[1].replace(/[()]/g, '').trim();
      const colCount = colsPart.split(',').length;
      const valCount = valsPart.split(',').length;
      if (colCount !== valCount && !upper.includes('SELECT')) {
        return {
          isValid: false,
          status: 'error',
          message: `Divergência: foram informadas ${colCount} coluna(s) para ${valCount} valor(es).`,
          dialectName,
          statementType,
        };
      }
    }
  }

  // 3.3 UPDATE
  if (statementType === 'UPDATE') {
    if (!upper.includes(' SET ')) {
      return {
        isValid: false,
        status: 'error',
        message: 'Cláusula "SET" esperada após o nome da tabela no comando UPDATE.',
        dialectName,
        statementType,
      };
    }
    if (!upper.includes(' WHERE ')) {
      return {
        isValid: true,
        status: 'warning',
        message: '⚠️ Alerta de Segurança: UPDATE sem cláusula WHERE alterará TODOS os registros da tabela!',
        dialectName,
        suggestions: ['Adicione uma cláusula WHERE para restringir a atualização a registros específicos.'],
        statementType,
      };
    }
  }

  // 3.4 DELETE
  if (statementType === 'DELETE') {
    if (!upper.includes(' FROM ') && !/DELETE\s+[a-zA-Z0-9_]+/i.test(clean)) {
      return {
        isValid: false,
        status: 'error',
        message: 'Cláusula "FROM" ou tabela esperada no comando DELETE.',
        dialectName,
        statementType,
      };
    }
    if (!upper.includes(' WHERE ')) {
      return {
        isValid: true,
        status: 'warning',
        message: '⚠️ Alerta de Segurança: DELETE sem cláusula WHERE excluirá TODOS os registros da tabela!',
        dialectName,
        suggestions: ['Adicione uma cláusula WHERE para restringir a exclusão a registros específicos.'],
        statementType,
      };
    }
  }

  // 3.5 Backtick vs Double Quotes dialect checks
  if (backticks > 0 && ['postgres', 'postgresql', 'firebird'].includes(db)) {
    return {
      isValid: true,
      status: 'warning',
      message: `Identificadores com crase (\`) não são recomendados no ${dialectName}. Utilize aspas duplas (ex: "nome_campo").`,
      dialectName,
      statementType,
    };
  }

  // 3.6 Square brackets check in MySQL/PostgreSQL
  if (brackets > 0 && ['mysql', 'mariadb', 'postgres', 'postgresql'].includes(db)) {
    return {
      isValid: true,
      status: 'warning',
      message: `Colchetes [...] são específicos do SQL Server/Access. No ${dialectName}, utilize crases (\`) ou aspas duplas (\").`,
      dialectName,
      statementType,
    };
  }

  return {
    isValid: true,
    status: 'valid',
    message: `Sintaxe válida para ${dialectName}`,
    dialectName,
    statementType,
  };
}
