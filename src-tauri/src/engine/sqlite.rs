use rusqlite::{types::ValueRef, Connection};
use serde_json::{Map, Value};
use std::sync::Mutex;
use std::time::Instant;
use crate::engine::types::*;

pub struct SqliteEngine {
    conn: Mutex<Connection>,
    pub db_name: String,
}

impl SqliteEngine {
    pub fn open(file_path: &str) -> Result<Self, String> {
        let conn = Connection::open(file_path).map_err(|e| format!("Erro ao abrir SQLite: {}", e))?;
        let name = std::path::Path::new(file_path)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "sqlite.db".into());

        Ok(Self {
            conn: Mutex::new(conn),
            db_name: name,
        })
    }

    pub fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;"
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let name: String = row.get(0)?;
                let t_type: String = row.get(1)?;
                Ok(TableInfo {
                    name,
                    schema: Some("main".into()),
                    row_count: None,
                    table_type: t_type,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut tables = Vec::new();
        for r in rows {
            if let Ok(t) = r {
                tables.push(t);
            }
        }
        Ok(tables)
    }

    pub fn describe_table(&self, table_name: &str) -> Result<Vec<ColumnInfo>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let sql = format!("PRAGMA table_info(\"{}\");", table_name);
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let name: String = row.get(1)?;
                let col_type: String = row.get(2)?;
                let not_null: i32 = row.get(3)?;
                let pk: i32 = row.get(5)?;
                Ok(ColumnInfo {
                    name,
                    col_type: if col_type.is_empty() { "TEXT".into() } else { col_type },
                    nullable: not_null == 0,
                    is_primary_key: pk > 0,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut cols = Vec::new();
        for r in rows {
            if let Ok(c) = r {
                cols.push(c);
            }
        }
        Ok(cols)
    }

    pub fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let start = Instant::now();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let stmt_type = crate::engine::sql_evaluator::get_statement_type(sql);
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

        if stmt.column_count() == 0 {
            let affected = stmt.execute([]).map_err(|e| e.to_string())?;
            let execution_time_ms = start.elapsed().as_millis();
            return Ok(QueryResult {
                columns: vec!["AFFECTED_ROWS".into()],
                rows: vec![serde_json::json!({ "AFFECTED_ROWS": affected })],
                row_count: affected,
                total_count: Some(affected as i64),
                has_more: false,
                execution_time_ms,
                statement_type: Some(stmt_type.into()),
                offset: None,
                limit: None,
            });
        }

        let col_names: Vec<String> = stmt.column_names().into_iter().map(|s| s.to_string()).collect();
        let mut rows = Vec::new();

        let mut query_rows = stmt.query([]).map_err(|e| e.to_string())?;
        while let Some(row) = query_rows.next().map_err(|e| e.to_string())? {
            let mut map = Map::new();
            for (i, name) in col_names.iter().enumerate() {
                let val = match row.get_ref(i) {
                    Ok(ValueRef::Null) => Value::Null,
                    Ok(ValueRef::Integer(n)) => Value::Number(n.into()),
                    Ok(ValueRef::Real(f)) => serde_json::Number::from_f64(f)
                        .map(Value::Number)
                        .unwrap_or(Value::Null),
                    Ok(ValueRef::Text(s)) => {
                        Value::String(String::from_utf8_lossy(s).to_string())
                    }
                    Ok(ValueRef::Blob(b)) => {
                        let hex_str: String = b.iter().map(|byte| format!("{:02x}", byte)).collect();
                        Value::String(format!("\\x{}", hex_str))
                    }
                    Err(_) => Value::Null,
                };
                map.insert(name.clone(), val);
            }
            rows.push(Value::Object(map));
        }

        let row_count = rows.len();
        let execution_time_ms = start.elapsed().as_millis();

        Ok(QueryResult {
            columns: col_names,
            rows,
            row_count,
            total_count: None,
            has_more: false,
            execution_time_ms,
            statement_type: Some(stmt_type.into()),
            offset: None,
            limit: None,
        })
    }

    pub fn get_table_data(
        &self,
        table_name: &str,
        limit: usize,
        offset: usize,
    ) -> Result<QueryResult, String> {
        let start = Instant::now();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Total count
        let count_sql = format!("SELECT COUNT(*) FROM \"{}\";", table_name);
        let total_count: Option<i64> = conn.query_row(&count_sql, [], |r| r.get(0)).ok();

        let sql = format!("SELECT * FROM \"{}\" LIMIT {} OFFSET {};", table_name, limit, offset);
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

        let col_names: Vec<String> = stmt.column_names().into_iter().map(|s| s.to_string()).collect();
        let mut rows = Vec::new();

        let mut query_rows = stmt.query([]).map_err(|e| e.to_string())?;
        while let Some(row) = query_rows.next().map_err(|e| e.to_string())? {
            let mut map = Map::new();
            for (i, name) in col_names.iter().enumerate() {
                let val = match row.get_ref(i) {
                    Ok(ValueRef::Null) => Value::Null,
                    Ok(ValueRef::Integer(n)) => Value::Number(n.into()),
                    Ok(ValueRef::Real(f)) => serde_json::Number::from_f64(f)
                        .map(Value::Number)
                        .unwrap_or(Value::Null),
                    Ok(ValueRef::Text(s)) => {
                        Value::String(String::from_utf8_lossy(s).to_string())
                    }
                    Ok(ValueRef::Blob(b)) => {
                        let hex_str: String = b.iter().map(|byte| format!("{:02x}", byte)).collect();
                        Value::String(format!("\\x{}", hex_str))
                    }
                    Err(_) => Value::Null,
                };
                map.insert(name.clone(), val);
            }
            rows.push(Value::Object(map));
        }

        let row_count = rows.len();
        let stmt_type = "SELECT";
        let has_more = match total_count {
            Some(t) => (offset + row_count) < t as usize,
            None => row_count == limit,
        };
        let execution_time_ms = start.elapsed().as_millis();

        Ok(QueryResult {
            columns: col_names,
            rows,
            row_count,
            total_count,
            has_more,
            execution_time_ms,
            statement_type: Some(stmt_type.into()),
            offset: Some(offset),
            limit: Some(limit),
        })
    }

    pub fn insert_row(
        &self,
        table_name: &str,
        data: &Map<String, Value>,
    ) -> Result<MutationResult, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut cols = Vec::new();
        let mut vals = Vec::new();
        for (k, v) in data {
            cols.push(format!("\"{}\"", k));
            match v {
                Value::Null => vals.push("NULL".to_string()),
                Value::Bool(b) => vals.push(if *b { "1".into() } else { "0".into() }),
                Value::Number(n) => vals.push(n.to_string()),
                Value::String(s) => vals.push(format!("'{}'", s.replace('\'', "''"))),
                other => vals.push(format!("'{}'", other.to_string().replace('\'', "''"))),
            }
        }
        let sql = format!(
            "INSERT INTO \"{}\" ({}) VALUES ({});",
            table_name,
            cols.join(", "),
            vals.join(", ")
        );
        let rows_affected = conn.execute(&sql, []).map_err(|e| e.to_string())?;
        let last_id = conn.last_insert_rowid();

        Ok(MutationResult {
            success: true,
            affected_rows: rows_affected as u64,
            inserted_id: Some(last_id.to_string()),
            error: None,
        })
    }

    pub fn update_row(
        &self,
        table_name: &str,
        primary_key: &Map<String, Value>,
        changes: &Map<String, Value>,
    ) -> Result<MutationResult, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut set_clauses = Vec::new();
        for (k, v) in changes {
            let val_str = match v {
                Value::Null => "NULL".to_string(),
                Value::Bool(b) => if *b { "1".into() } else { "0".into() },
                Value::Number(n) => n.to_string(),
                Value::String(s) => format!("'{}'", s.replace('\'', "''")),
                other => format!("'{}'", other.to_string().replace('\'', "''")),
            };
            set_clauses.push(format!("\"{}\" = {}", k, val_str));
        }

        let mut where_clauses = Vec::new();
        for (k, v) in primary_key {
            let val_str = match v {
                Value::Null => "IS NULL".to_string(),
                Value::Bool(b) => format!("= {}", if *b { "1" } else { "0" }),
                Value::Number(n) => format!("= {}", n),
                Value::String(s) => format!("= '{}'", s.replace('\'', "''")),
                other => format!("= '{}'", other.to_string().replace('\'', "''")),
            };
            if val_str == "IS NULL" {
                where_clauses.push(format!("\"{}\" IS NULL", k));
            } else {
                where_clauses.push(format!("\"{}\" {}", k, val_str));
            }
        }

        let sql = format!(
            "UPDATE \"{}\" SET {} WHERE {};",
            table_name,
            set_clauses.join(", "),
            where_clauses.join(" AND ")
        );

        let rows_affected = conn.execute(&sql, []).map_err(|e| e.to_string())?;

        Ok(MutationResult {
            success: true,
            affected_rows: rows_affected as u64,
            inserted_id: None,
            error: None,
        })
    }

    pub fn delete_row(
        &self,
        table_name: &str,
        primary_key: &Map<String, Value>,
    ) -> Result<MutationResult, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut where_clauses = Vec::new();
        for (k, v) in primary_key {
            let val_str = match v {
                Value::Null => "IS NULL".to_string(),
                Value::Bool(b) => format!("= {}", if *b { "1" } else { "0" }),
                Value::Number(n) => format!("= {}", n),
                Value::String(s) => format!("= '{}'", s.replace('\'', "''")),
                other => format!("= '{}'", other.to_string().replace('\'', "''")),
            };
            if val_str == "IS NULL" {
                where_clauses.push(format!("\"{}\" IS NULL", k));
            } else {
                where_clauses.push(format!("\"{}\" {}", k, val_str));
            }
        }

        let sql = format!("DELETE FROM \"{}\" WHERE {};", table_name, where_clauses.join(" AND "));
        let rows_affected = conn.execute(&sql, []).map_err(|e| e.to_string())?;

        Ok(MutationResult {
            success: true,
            affected_rows: rows_affected as u64,
            inserted_id: None,
            error: None,
        })
    }
}
