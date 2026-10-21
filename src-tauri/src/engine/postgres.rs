use deadpool_postgres::{Config, ManagerConfig, Pool, RecyclingMethod, Runtime};
use tokio_postgres::NoTls;
use serde_json::{Map, Value};
use std::time::Instant;
use crate::engine::types::*;

pub struct PostgresEngine {
    pool: Pool,
    pub db_name: String,
}

impl PostgresEngine {
    pub async fn connect(config: &ConnectionConfig) -> Result<Self, String> {
        let mut cfg = Config::new();
        cfg.host = Some(config.host.clone().unwrap_or_else(|| "localhost".into()));
        cfg.port = Some(config.port.unwrap_or(5432));
        cfg.dbname = Some(
            config
                .database
                .clone()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or_else(|| "postgres".into()),
        );
        cfg.user = Some(config.user.clone().unwrap_or_else(|| "postgres".into()));
        cfg.password = config.password.clone();
        cfg.manager = Some(ManagerConfig {
            recycling_method: RecyclingMethod::Fast,
        });

        let pool = cfg
            .create_pool(Some(Runtime::Tokio1), NoTls)
            .map_err(|e| format!("Falha ao criar pool PostgreSQL: {}", e))?;

        // Test connection
        let client = pool
            .get()
            .await
            .map_err(|e| format!("Falha ao conectar no PostgreSQL: {}", e))?;

        let row = client
            .query_one("SELECT current_database();", &[])
            .await
            .map_err(|e| format!("Erro de autenticação PostgreSQL: {}", e))?;

        let current_db: String = row.get(0);

        Ok(Self {
            pool,
            db_name: current_db,
        })
    }

    pub async fn list_databases(&self) -> Result<Vec<String>, String> {
        let client = self.pool.get().await.map_err(|e| e.to_string())?;
        let rows = client
            .query(
                "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname ASC;",
                &[],
            )
            .await
            .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|r| r.get::<usize, String>(0)).collect())
    }

    pub async fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let client = self.pool.get().await.map_err(|e| e.to_string())?;
        let sql = r#"
            SELECT 
              n.nspname AS schema_name,
              c.relname AS table_name,
              c.relkind AS rel_kind,
              COALESCE(c.reltuples, 0)::bigint AS estimated_rows
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind IN ('r', 'p', 'v', 'm')
              AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
              AND n.nspname NOT LIKE 'pg_temp_%'
              AND n.nspname NOT LIKE 'pg_toast_temp_%'
            ORDER BY n.nspname ASC, c.relname ASC;
        "#;

        let rows = client.query(sql, &[]).await.map_err(|e| e.to_string())?;

        let tables = rows
            .into_iter()
            .map(|r| {
                let schema: String = r.get(0);
                let name: String = r.get(1);
                let relkind: i8 = r.get(2);
                let estimated_rows: i64 = r.get(3);
                let table_type = if relkind == b'v' as i8 || relkind == b'm' as i8 {
                    "view".into()
                } else {
                    "table".into()
                };

                TableInfo {
                    name,
                    schema: Some(schema),
                    row_count: Some(estimated_rows),
                    table_type,
                }
            })
            .collect();

        Ok(tables)
    }

    pub async fn describe_table(
        &self,
        table_name: &str,
        schema: Option<&str>,
    ) -> Result<Vec<ColumnInfo>, String> {
        let client = self.pool.get().await.map_err(|e| e.to_string())?;
        let target_schema = schema.unwrap_or("public");

        let sql = r#"
            SELECT 
              c.column_name,
              c.data_type,
              c.is_nullable,
              CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
            FROM information_schema.columns c
            LEFT JOIN (
              SELECT kcu.column_name
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_name = $1
                AND tc.table_schema = $2
            ) pk ON c.column_name = pk.column_name
            WHERE c.table_name = $1
              AND c.table_schema = $2
            ORDER BY c.ordinal_position ASC;
        "#;

        let rows = client
            .query(sql, &[&table_name, &target_schema])
            .await
            .map_err(|e| e.to_string())?;

        let columns = rows
            .into_iter()
            .map(|r| {
                let name: String = r.get(0);
                let col_type: String = r.get(1);
                let is_nullable: String = r.get(2);
                let is_pk: bool = r.get(3);

                ColumnInfo {
                    name,
                    col_type: col_type.to_uppercase(),
                    nullable: is_nullable.to_uppercase() == "YES",
                    is_primary_key: is_pk,
                }
            })
            .collect();

        Ok(columns)
    }

    pub async fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let start = Instant::now();
        let client = self.pool.get().await.map_err(|e| e.to_string())?;
        let rows = client.query(sql, &[]).await.map_err(|e| e.to_string())?;
        let execution_time_ms = start.elapsed().as_millis();

        let mut columns = Vec::new();
        if let Some(first) = rows.first() {
            columns = first.columns().iter().map(|c| c.name().to_string()).collect();
        }

        let mut result_rows = Vec::with_capacity(rows.len());
        for row in &rows {
            let mut map = Map::new();
            for (idx, col) in row.columns().iter().enumerate() {
                let val = format_pg_value(row, idx);
                map.insert(col.name().to_string(), val);
            }
            result_rows.push(Value::Object(map));
        }

        let count = result_rows.len();

        Ok(QueryResult {
            columns,
            rows: result_rows,
            row_count: count,
            total_count: None,
            has_more: false,
            execution_time_ms,
            statement_type: Some("SELECT".into()),
            offset: None,
            limit: None,
        })
    }

    pub async fn get_table_data(
        &self,
        table_name: &str,
        schema: Option<&str>,
        limit: usize,
        offset: usize,
    ) -> Result<QueryResult, String> {
        let start = Instant::now();
        let client = self.pool.get().await.map_err(|e| e.to_string())?;
        let target = if let Some(s) = schema {
            if s != "default" {
                format!("\"{}\".\"{}\"", s, table_name)
            } else {
                format!("\"{}\"", table_name)
            }
        } else {
            format!("\"{}\"", table_name)
        };

        // Total count
        let count_sql = format!("SELECT COUNT(*) FROM {};", target);
        let total_count: Option<i64> = client
            .query_one(&count_sql, &[])
            .await
            .ok()
            .and_then(|r| r.get::<usize, i64>(0).into());

        let data_sql = format!("SELECT * FROM {} LIMIT {} OFFSET {};", target, limit, offset);
        let rows = client.query(&data_sql, &[]).await.map_err(|e| e.to_string())?;
        let execution_time_ms = start.elapsed().as_millis();

        let mut columns = Vec::new();
        if let Some(first) = rows.first() {
            columns = first.columns().iter().map(|c| c.name().to_string()).collect();
        }

        let mut result_rows = Vec::with_capacity(rows.len());
        for row in &rows {
            let mut map = Map::new();
            for (idx, col) in row.columns().iter().enumerate() {
                let val = format_pg_value(row, idx);
                map.insert(col.name().to_string(), val);
            }
            result_rows.push(Value::Object(map));
        }

        let count = result_rows.len();
        let has_more = match total_count {
            Some(t) => (offset + count) < t as usize,
            None => count == limit,
        };

        Ok(QueryResult {
            columns,
            rows: result_rows,
            row_count: count,
            total_count,
            has_more,
            execution_time_ms,
            statement_type: Some("SELECT".into()),
            offset: Some(offset),
            limit: Some(limit),
        })
    }

    pub async fn insert_row(
        &self,
        table_name: &str,
        schema: Option<&str>,
        data: &Map<String, Value>,
    ) -> Result<MutationResult, String> {
        let client = self.pool.get().await.map_err(|e| e.to_string())?;
        let target = if let Some(s) = schema {
            if s != "default" {
                format!("\"{}\".\"{}\"", s, table_name)
            } else {
                format!("\"{}\"", table_name)
            }
        } else {
            format!("\"{}\"", table_name)
        };

        let mut cols = Vec::new();
        let mut vals = Vec::new();
        for (k, v) in data {
            cols.push(format!("\"{}\"", k));
            match v {
                Value::Null => vals.push("NULL".to_string()),
                Value::Bool(b) => vals.push(if *b { "TRUE".into() } else { "FALSE".into() }),
                Value::Number(n) => vals.push(n.to_string()),
                Value::String(s) => vals.push(format!("'{}'", s.replace('\'', "''"))),
                other => vals.push(format!("'{}'", other.to_string().replace('\'', "''"))),
            }
        }

        let sql = format!(
            "INSERT INTO {} ({}) VALUES ({});",
            target,
            cols.join(", "),
            vals.join(", ")
        );

        let rows_affected = client.execute(&sql, &[]).await.map_err(|e| e.to_string())?;

        Ok(MutationResult {
            success: true,
            affected_rows: rows_affected,
            inserted_id: None,
            error: None,
        })
    }

    pub async fn update_row(
        &self,
        table_name: &str,
        schema: Option<&str>,
        primary_key: &Map<String, Value>,
        changes: &Map<String, Value>,
    ) -> Result<MutationResult, String> {
        let client = self.pool.get().await.map_err(|e| e.to_string())?;
        let target = if let Some(s) = schema {
            if s != "default" {
                format!("\"{}\".\"{}\"", s, table_name)
            } else {
                format!("\"{}\"", table_name)
            }
        } else {
            format!("\"{}\"", table_name)
        };

        let mut set_clauses = Vec::new();
        for (k, v) in changes {
            let val_str = match v {
                Value::Null => "NULL".to_string(),
                Value::Bool(b) => if *b { "TRUE".into() } else { "FALSE".into() },
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
                Value::Bool(b) => format!("= {}", if *b { "TRUE" } else { "FALSE" }),
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
            "UPDATE {} SET {} WHERE {};",
            target,
            set_clauses.join(", "),
            where_clauses.join(" AND ")
        );

        let rows_affected = client.execute(&sql, &[]).await.map_err(|e| e.to_string())?;

        Ok(MutationResult {
            success: true,
            affected_rows: rows_affected,
            inserted_id: None,
            error: None,
        })
    }

    pub async fn delete_row(
        &self,
        table_name: &str,
        schema: Option<&str>,
        primary_key: &Map<String, Value>,
    ) -> Result<MutationResult, String> {
        let client = self.pool.get().await.map_err(|e| e.to_string())?;
        let target = if let Some(s) = schema {
            if s != "default" {
                format!("\"{}\".\"{}\"", s, table_name)
            } else {
                format!("\"{}\"", table_name)
            }
        } else {
            format!("\"{}\"", table_name)
        };

        let mut where_clauses = Vec::new();
        for (k, v) in primary_key {
            let val_str = match v {
                Value::Null => "IS NULL".to_string(),
                Value::Bool(b) => format!("= {}", if *b { "TRUE" } else { "FALSE" }),
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

        let sql = format!("DELETE FROM {} WHERE {};", target, where_clauses.join(" AND "));
        let rows_affected = client.execute(&sql, &[]).await.map_err(|e| e.to_string())?;

        Ok(MutationResult {
            success: true,
            affected_rows: rows_affected,
            inserted_id: None,
            error: None,
        })
    }
}

fn format_pg_value(row: &tokio_postgres::Row, idx: usize) -> Value {
    use tokio_postgres::types::Type;
    let col_type = row.columns()[idx].type_();

    match *col_type {
        Type::BOOL => row
            .try_get::<usize, bool>(idx)
            .map(Value::Bool)
            .unwrap_or(Value::Null),
        Type::INT2 => row
            .try_get::<usize, i16>(idx)
            .map(|n| Value::Number(n.into()))
            .unwrap_or(Value::Null),
        Type::INT4 => row
            .try_get::<usize, i32>(idx)
            .map(|n| Value::Number(n.into()))
            .unwrap_or(Value::Null),
        Type::INT8 => row
            .try_get::<usize, i64>(idx)
            .map(|n| Value::Number(n.into()))
            .unwrap_or(Value::Null),
        Type::FLOAT4 => row
            .try_get::<usize, f32>(idx)
            .ok()
            .and_then(|f| serde_json::Number::from_f64(f as f64).map(Value::Number))
            .unwrap_or(Value::Null),
        Type::FLOAT8 => row
            .try_get::<usize, f64>(idx)
            .ok()
            .and_then(|f| serde_json::Number::from_f64(f).map(Value::Number))
            .unwrap_or(Value::Null),
        Type::VARCHAR | Type::TEXT | Type::BPCHAR | Type::NAME => row
            .try_get::<usize, String>(idx)
            .map(Value::String)
            .unwrap_or(Value::Null),
        Type::JSON | Type::JSONB => row
            .try_get::<usize, String>(idx)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(Value::Null),
        _ => {
            // Fallback to string representation
            if let Ok(s) = row.try_get::<usize, String>(idx) {
                Value::String(s)
            } else if let Ok(n) = row.try_get::<usize, i64>(idx) {
                Value::Number(n.into())
            } else if let Ok(f) = row.try_get::<usize, f64>(idx) {
                serde_json::Number::from_f64(f)
                    .map(Value::Number)
                    .unwrap_or(Value::Null)
            } else {
                Value::Null
            }
        }
    }
}
