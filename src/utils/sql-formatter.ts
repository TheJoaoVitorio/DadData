import { format } from 'sql-formatter';
import { DatabaseType } from '../types/database';

export function formatSql(sql: string, dbType?: DatabaseType | string): string {
  if (!sql || !sql.trim()) return sql;

  const db = (dbType || '').toLowerCase();
  let language: 'sql' | 'postgresql' | 'mysql' | 'mariadb' | 'transactsql' | 'sqlite' = 'sql';

  switch (db) {
    case 'postgres':
    case 'postgresql':
      language = 'postgresql';
      break;
    case 'mysql':
      language = 'mysql';
      break;
    case 'mariadb':
      language = 'mariadb';
      break;
    case 'mssql':
    case 'sqlserver':
    case 'access':
      language = 'transactsql';
      break;
    case 'sqlite':
      language = 'sqlite';
      break;
    default:
      language = 'sql';
      break;
  }

  try {
    return format(sql, {
      language,
      tabWidth: 2,
      useTabs: false,
      keywordCase: 'upper',
      linesBetweenQueries: 2,
    });
  } catch (err) {
    console.warn('sql-formatter error, falling back to basic formatter:', err);
    // Basic fallback: uppercase standard keywords and normalize spacing
    return fallbackFormatSql(sql);
  }
}

function fallbackFormatSql(sql: string): string {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT', 'INTO', 'VALUES',
    'UPDATE', 'SET', 'DELETE', 'ORDER BY', 'GROUP BY', 'HAVING', 'JOIN',
    'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'LIMIT', 'OFFSET', 'FIRST',
    'SKIP', 'TOP', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'NULL', 'IS'
  ];

  let result = sql.trim();
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
    result = result.replace(regex, kw);
  }
  return result;
}
