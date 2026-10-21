use mysql_async::prelude::*;
use mysql_async::{Opts, OptsBuilder, Pool};
use std::time::Instant;
use serde_json::{json, Map, Value};
use crate::engine::types::*;

pub struct MysqlEngine {
    pool: Pool,
    pub db_name: String,
    pub server_version: String,
}

fn mysql_val_to_json(val: mysql_async::Value) -> Value {
    match val {
        mysql_async::Value::NULL => Value::Null,
        mysql_async::Value::Bytes(bytes) => {
            match String::from_utf8(bytes) {
                Ok(s) => Value::String(s),
                Err(e) => Value::String(String::from_utf8_lossy(e.as_bytes()).to_string()),
            }
        }
        mysql_async::Value::Int(i) => json!(i),
        mysql_async::Value::UInt(u) => json!(u),
        mysql_async::Value::Float(f) => json!(f),
        mysql_async::Value::Double(d) => json!(d),
        mysql_async::Value::Date(year, month, day, hour, min, sec, _micro) => {
            if hour == 0 && min == 0 && sec == 0 {
                Value::String(format!("{:04}-{:02}-{:02}", year, month, day))
            } else {
                Value::String(format!(
                    "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
                    year, month, day, hour, min, sec
                ))
            }
        }
        mysql_async::Value::Time(_is_neg, _days, hours, mins, secs, _micros) => {
            Value::String(format!("{:02}:{:02}:{:02}", hours, mins, secs))
        }
    }
}

impl MysqlEngine {
    pub async fn list_databases(config: &ConnectionConfig) -> Result<Vec<String>, String> {
        let host = config.host.clone().unwrap_or_else(|| "127.0.0.1".into());
        let port = config.port.unwrap_or(3306);
        let user = config.user.clone().unwrap_or_else(|| "root".into());
        let password = config.password.clone().unwrap_or_default();

        let builder = OptsBuilder::default()
            .ip_or_hostname(host.clone())
            .tcp_port(port)
            .user(Some(user))
            .pass(Some(password));

        let opts: Opts = builder.into();
        let pool = Pool::new(opts);
        let mut conn = pool
            .get_conn()
            .await
            .map_err(|e| format!("Falha ao conectar no servidor MySQL ({}:{}): {}", host, port, e))?;

        let rows: Vec<String> = conn
            .query("SHOW DATABASES;")
            .await
            .map_err(|e| format!("Erro ao listar databases do MySQL: {}", e))?;

        let filtered: Vec<String> = rows
            .into_iter()
            .filter(|db| !["information_schema", "performance_schema", "sys"].contains(&db.as_str()))
            .collect();

        Ok(filtered)
    }

    pub async fn connect(config: &ConnectionConfig) -> Result<Self, String> {
        let host = config.host.clone().unwrap_or_else(|| "127.0.0.1".into());
        let port = config.port.unwrap_or(3306);
        let user = config.user.clone().unwrap_or_else(|| "root".into());
        let password = config.password.clone().unwrap_or_default();
        let db_opt = config.database.clone().filter(|d| !d.trim().is_empty());

        let mut builder = OptsBuilder::default()
            .ip_or_hostname(host.clone())
            .tcp_port(port)
            .user(Some(user))
            .pass(Some(password));

        if let Some(ref db) = db_opt {
            builder = builder.db_name(Some(db.clone()));
        }

        let opts: Opts = builder.into();
        let pool = Pool::new(opts);

        let mut conn = pool
            .get_conn()
            .await
            .map_err(|e| format!("Falha na conexão MySQL ({}:{}): {}", host, port, e))?;

        let version: Option<String> = conn.query_first("SELECT VERSION();").await.unwrap_or(None);
        let ver_str = version.unwrap_or_else(|| "8.0".into());

        let active_db: String = if let Some(d) = db_opt {
            d
        } else {
            conn.query_first("SELECT DATABASE();")
                .await
                .ok()
                .flatten()
                .unwrap_or_else(|| "mysql".into())
        };

        Ok(Self {
            pool,
            db_name: active_db,
            server_version: format!("MySQL Server {}", ver_str),
        })
    }

    pub async fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let mut conn = self.pool.get_conn().await.map_err(|e| e.to_string())?;
        let rows: Vec<(String, String)> = conn
            .query(
                r#"
                SELECT TABLE_NAME, TABLE_TYPE 
                FROM information_schema.tables 
                WHERE TABLE_SCHEMA = DATABASE()
                ORDER BY TABLE_NAME ASC;
                "#,
            )
            .await
            .map_err(|e| format!("Erro ao listar tabelas do MySQL: {}", e))?;

        let tables = rows
            .into_iter()
            .map(|(name, t_type)| TableInfo {
                name,
                schema: Some("mysql".into()),
                row_count: None,
                table_type: if t_type.contains("VIEW") { "view".into() } else { "table".into() },
            })
            .collect();

        Ok(tables)
    }

    pub async fn describe_table(&self, table_name: &str) -> Result<Vec<ColumnInfo>, String> {
        let mut conn = self.pool.get_conn().await.map_err(|e| e.to_string())?;
        let sql = format!(
            r#"
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
            FROM information_schema.columns
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{}'
            ORDER BY ORDINAL_POSITION ASC;
            "#,
            table_name
        );

        let rows: Vec<(String, String, String, String)> = conn
            .query(&sql)
            .await
            .map_err(|e| format!("Erro ao obter metadados da tabela '{}': {}", table_name, e))?;

        let cols = rows
            .into_iter()
            .map(|(name, d_type, is_null, col_key)| ColumnInfo {
                name,
                col_type: d_type.to_uppercase(),
                nullable: is_null.to_uppercase() == "YES",
                is_primary_key: col_key == "PRI",
            })
            .collect();

        Ok(cols)
    }

    pub async fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let start = Instant::now();
        let mut conn = self.pool.get_conn().await.map_err(|e| e.to_string())?;
        let rows: Vec<mysql_async::Row> = conn.query(sql).await.map_err(|e| e.to_string())?;
        let execution_time_ms = start.elapsed().as_millis();

        let mut columns = Vec::new();
        if let Some(first) = rows.first() {
            columns = first.columns_ref().iter().map(|c| c.name_str().to_string()).collect();
        }

        let mut res_rows = Vec::new();
        for r in &rows {
            let mut map = Map::new();
            for (i, c) in r.columns_ref().iter().enumerate() {
                let raw_val = r.get_opt::<mysql_async::Value, _>(i).and_then(Result::ok).unwrap_or(mysql_async::Value::NULL);
                map.insert(c.name_str().to_string(), mysql_val_to_json(raw_val));
            }
            res_rows.push(Value::Object(map));
        }

        let count = res_rows.len();
        Ok(QueryResult {
            columns,
            rows: res_rows,
            row_count: count,
            total_count: Some(count as i64),
            has_more: false,
            execution_time_ms,
            statement_type: Some("SELECT".into()),
            offset: None,
            limit: None,
        })
    }

    pub async fn get_table_data(&self, table_name: &str, limit: usize, offset: usize) -> Result<QueryResult, String> {
        let sql = format!("SELECT * FROM `{}` LIMIT {} OFFSET {};", table_name, limit, offset);
        self.execute_query(&sql).await
    }
}
