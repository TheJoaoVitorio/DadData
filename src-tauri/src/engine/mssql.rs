use std::time::Instant;
use tiberius::{AuthMethod, Client, ColumnData, Config, SqlBrowser};
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio_util::compat::{Compat, TokioAsyncWriteCompatExt};
use serde_json::{json, Map, Value};
use crate::engine::types::*;

pub struct MssqlEngine {
    client: Mutex<Client<Compat<TcpStream>>>,
    pub db_name: String,
    pub server_version: String,
}

fn mssql_col_to_json(col: ColumnData<'static>) -> Value {
    match col {
        ColumnData::U8(v) => v.map(|x| json!(x)).unwrap_or(Value::Null),
        ColumnData::I16(v) => v.map(|x| json!(x)).unwrap_or(Value::Null),
        ColumnData::I32(v) => v.map(|x| json!(x)).unwrap_or(Value::Null),
        ColumnData::I64(v) => v.map(|x| json!(x)).unwrap_or(Value::Null),
        ColumnData::F32(v) => v.map(|x| json!(x)).unwrap_or(Value::Null),
        ColumnData::F64(v) => v.map(|x| json!(x)).unwrap_or(Value::Null),
        ColumnData::Bit(v) => v.map(|x| json!(x)).unwrap_or(Value::Null),
        ColumnData::String(v) => v.map(|x| json!(x.into_owned())).unwrap_or(Value::Null),
        ColumnData::Guid(v) => v.map(|x| json!(x.to_string())).unwrap_or(Value::Null),
        ColumnData::Binary(v) => v.map(|x| json!(format!("{:02X?}", x.into_owned()))).unwrap_or(Value::Null),
        ColumnData::Numeric(v) => v.map(|x| json!(format!("{:?}", x))).unwrap_or(Value::Null),
        ColumnData::Xml(v) => v.map(|x| json!(format!("{:?}", x))).unwrap_or(Value::Null),
        ColumnData::DateTime(v) => v.map(|x| json!(format!("{:?}", x))).unwrap_or(Value::Null),
        ColumnData::SmallDateTime(v) => v.map(|x| json!(format!("{:?}", x))).unwrap_or(Value::Null),
        ColumnData::Time(v) => v.map(|x| json!(format!("{:?}", x))).unwrap_or(Value::Null),
        ColumnData::Date(v) => v.map(|x| json!(format!("{:?}", x))).unwrap_or(Value::Null),
        ColumnData::DateTime2(v) => v.map(|x| json!(format!("{:?}", x))).unwrap_or(Value::Null),
        ColumnData::DateTimeOffset(v) => v.map(|x| json!(format!("{:?}", x))).unwrap_or(Value::Null),
    }
}

impl MssqlEngine {
    pub async fn connect_client(config_in: &ConnectionConfig) -> Result<(Client<Compat<TcpStream>>, String), String> {
        let mut config = Config::new();
        let host_raw = config_in.host.as_deref().unwrap_or("localhost");

        let (host_str, instance_opt) = if let Some(idx) = host_raw.find('\\') {
            (&host_raw[..idx], Some(&host_raw[idx + 1..]))
        } else {
            (host_raw, None)
        };

        let resolved_host = match host_str.trim() {
            "." | "(local)" | "" => "127.0.0.1",
            other => other,
        };

        config.host(resolved_host);

        if let Some(inst) = instance_opt {
            config.instance_name(inst);
        } else if let Some(p) = config_in.port {
            config.port(p);
        } else {
            config.port(1433);
        }

        if let Some(db) = &config_in.database {
            if !db.trim().is_empty() {
                config.database(db);
            }
        }

        let auth_type = config_in.auth_type.as_deref().unwrap_or("sql");
        if auth_type == "windows" {
            let user = config_in.user.as_deref().unwrap_or("");
            let pass = config_in.password.as_deref().unwrap_or("");
            if !user.is_empty() {
                config.authentication(AuthMethod::windows(user, pass));
            } else {
                config.authentication(AuthMethod::Integrated);
            }
        } else {
            let user = config_in.user.as_deref().unwrap_or("sa");
            let pass = config_in.password.as_deref().unwrap_or("");
            config.authentication(AuthMethod::sql_server(user, pass));
        }

        config.trust_cert();

        let tcp = TcpStream::connect_named(&config).await.map_err(|e| {
            format!("Falha de conexão com o SQL Server (Host: {}): {}", host_raw, e)
        })?;
        tcp.set_nodelay(true).map_err(|e| e.to_string())?;

        let client = Client::connect(config, tcp.compat_write()).await.map_err(|e| {
            format!("Falha na autenticação do SQL Server: {}", e)
        })?;

        let display_server = if let Some(inst) = instance_opt {
            format!("{}\\{}", resolved_host, inst)
        } else {
            format!("{}:{}", resolved_host, config_in.port.unwrap_or(1433))
        };

        Ok((client, display_server))
    }

    pub async fn list_databases(config_in: &ConnectionConfig) -> Result<Vec<String>, String> {
        let (mut client, _) = Self::connect_client(config_in).await?;
        let stream = client
            .simple_query("SELECT name FROM sys.databases WHERE state = 0 AND name NOT IN ('model') ORDER BY name ASC;")
            .await
            .map_err(|e| format!("Erro ao listar databases do SQL Server: {}", e))?;

        let rows = stream.into_first_result().await.map_err(|e| e.to_string())?;
        let mut dbs = Vec::new();
        for r in rows {
            if let Some(name) = r.get::<&str, _>(0) {
                dbs.push(name.to_string());
            }
        }
        Ok(dbs)
    }

    pub async fn connect(config_in: &ConnectionConfig) -> Result<Self, String> {
        let (mut client, server_str) = Self::connect_client(config_in).await?;

        let stream = client.simple_query("SELECT @@VERSION, DB_NAME();").await.map_err(|e| e.to_string())?;
        let rows = stream.into_first_result().await.map_err(|e| e.to_string())?;

        let (ver_str, current_db) = if let Some(first_row) = rows.first() {
            let ver = first_row.get::<&str, _>(0).unwrap_or("Microsoft SQL Server");
            let short_ver = ver.lines().next().unwrap_or(ver).to_string();
            let db = first_row.get::<&str, _>(1).unwrap_or("master").to_string();
            (short_ver, db)
        } else {
            ("Microsoft SQL Server".to_string(), "master".to_string())
        };

        let resolved_db = config_in.database.clone().filter(|d| !d.trim().is_empty()).unwrap_or(current_db);

        Ok(Self {
            client: Mutex::new(client),
            db_name: resolved_db,
            server_version: format!("{} ({})", ver_str, server_str),
        })
    }

    pub async fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let mut client = self.client.lock().await;
        let stream = client.simple_query(r#"
            SELECT TABLE_NAME, TABLE_SCHEMA, TABLE_TYPE 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
            ORDER BY TABLE_SCHEMA, TABLE_NAME;
        "#).await.map_err(|e| format!("Erro ao listar tabelas do SQL Server: {}", e))?;

        let rows = stream.into_first_result().await.map_err(|e| e.to_string())?;
        let mut tables = Vec::new();
        for r in rows {
            let t_name = r.get::<&str, _>(0).unwrap_or("").to_string();
            let schema = r.get::<&str, _>(1).map(|s| s.to_string());
            let t_type = r.get::<&str, _>(2).unwrap_or("BASE TABLE");

            tables.push(TableInfo {
                name: t_name,
                schema: schema.or(Some("dbo".into())),
                row_count: None,
                table_type: if t_type.contains("VIEW") { "view".into() } else { "table".into() },
            });
        }
        Ok(tables)
    }

    pub async fn describe_table(&self, table_name: &str, schema: Option<&str>) -> Result<Vec<ColumnInfo>, String> {
        let mut client = self.client.lock().await;
        let schema_filter = schema.unwrap_or("dbo");
        let sql = format!(r#"
            SELECT c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE,
                   COALESCE(COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity'), 0) AS is_identity
            FROM INFORMATION_SCHEMA.COLUMNS c
            WHERE c.TABLE_NAME = '{}' AND c.TABLE_SCHEMA = '{}'
            ORDER BY c.ORDINAL_POSITION ASC;
        "#, table_name.replace('\'', "''"), schema_filter.replace('\'', "''"));

        let stream = client.simple_query(&sql).await.map_err(|e| format!("Erro ao descrever tabela: {}", e))?;
        let rows = stream.into_first_result().await.map_err(|e| e.to_string())?;

        let mut cols = Vec::new();
        for r in rows {
            let col_name = r.get::<&str, _>(0).unwrap_or("").to_string();
            let data_type = r.get::<&str, _>(1).unwrap_or("VARCHAR").to_uppercase();
            let is_nullable = r.get::<&str, _>(2).unwrap_or("YES").to_uppercase() == "YES";
            let is_pk = r.get::<i32, _>(3).unwrap_or(0) == 1;

            cols.push(ColumnInfo {
                name: col_name,
                col_type: data_type,
                nullable: is_nullable,
                is_primary_key: is_pk,
            });
        }
        Ok(cols)
    }

    pub async fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let start = Instant::now();
        let stmt_type = crate::engine::sql_evaluator::get_statement_type(sql);
        let mut client = self.client.lock().await;
        let stream = client.simple_query(sql).await.map_err(|e| format!("Erro ao executar query no SQL Server: {}", e))?;
        let execution_time_ms = start.elapsed().as_millis();

        let rows = stream.into_first_result().await.map_err(|e| e.to_string())?;

        if rows.is_empty() && (stmt_type == "INSERT" || stmt_type == "UPDATE" || stmt_type == "DELETE") {
            return Ok(QueryResult {
                columns: vec!["STATUS".into()],
                rows: vec![serde_json::json!({ "STATUS": format!("Comando {} executado com sucesso no SQL Server", stmt_type) })],
                row_count: 1,
                total_count: Some(1),
                has_more: false,
                execution_time_ms,
                statement_type: Some(stmt_type.into()),
                offset: None,
                limit: None,
            });
        }
        let columns: Vec<String> = if let Some(first) = rows.first() {
            first.columns().iter().map(|c| c.name().to_string()).collect()
        } else {
            Vec::new()
        };

        let mut res_rows = Vec::new();
        for r in rows {
            let mut map = Map::new();
            for (col_name, val) in columns.iter().zip(r.into_iter()) {
                map.insert(col_name.clone(), mssql_col_to_json(val));
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
            statement_type: Some(stmt_type.into()),
            offset: None,
            limit: None,
        })
    }

    pub async fn get_table_data(&self, table_name: &str, schema: Option<&str>, limit: usize, offset: usize) -> Result<QueryResult, String> {
        let start = Instant::now();
        let s = schema.filter(|sch| !sch.trim().is_empty()).unwrap_or("dbo");
        let safe_schema = s.replace(']', "]]");
        let safe_table = table_name.replace(']', "]]");
        let mut client = self.client.lock().await;

        // 1. Total row count query
        let count_sql = format!(
            "SELECT CAST(COUNT_BIG(*) AS VARCHAR(32)) FROM [{}].[{}];",
            safe_schema, safe_table
        );
        let total_count: Option<i64> = match client.simple_query(&count_sql).await {
            Ok(stream) => {
                if let Ok(rows) = stream.into_first_result().await {
                    rows.first().and_then(|r| {
                        if let Some(s) = r.get::<&str, _>(0) {
                            s.parse::<i64>().ok()
                        } else if let Some(n) = r.get::<i64, _>(0) {
                            Some(n)
                        } else if let Some(n) = r.get::<i32, _>(0) {
                            Some(n as i64)
                        } else {
                            None
                        }
                    })
                } else {
                    None
                }
            }
            Err(_) => None,
        };

        // 2. Data chunk query: use TOP for initial batch, OFFSET/FETCH for subsequent pages
        let rows = if offset == 0 {
            let sql = format!(
                "SELECT TOP {} * FROM [{}].[{}];",
                limit, safe_schema, safe_table
            );
            let stream = client.simple_query(&sql).await.map_err(|e| {
                format!("Erro ao buscar dados da tabela '{}': {}", table_name, e)
            })?;
            stream.into_first_result().await.map_err(|e| e.to_string())?
        } else {
            let sql = format!(
                "SELECT * FROM [{}].[{}] ORDER BY (SELECT NULL) OFFSET {} ROWS FETCH NEXT {} ROWS ONLY;",
                safe_schema, safe_table, offset, limit
            );
            let stream = client.simple_query(&sql).await.map_err(|e| {
                format!("Erro ao paginar dados da tabela '{}' (offset {}): {}", table_name, offset, e)
            })?;
            stream.into_first_result().await.map_err(|e| e.to_string())?
        };

        let execution_time_ms = start.elapsed().as_millis();

        let columns: Vec<String> = if let Some(first) = rows.first() {
            first.columns().iter().map(|c| c.name().to_string()).collect()
        } else {
            Vec::new()
        };

        let mut res_rows = Vec::new();
        for r in rows {
            let mut map = Map::new();
            for (col_name, val) in columns.iter().zip(r.into_iter()) {
                map.insert(col_name.clone(), mssql_col_to_json(val));
            }
            res_rows.push(Value::Object(map));
        }

        let count = res_rows.len();
        let has_more = match total_count {
            Some(t) => (offset + count) < t as usize,
            None => count == limit,
        };

        Ok(QueryResult {
            columns,
            rows: res_rows,
            row_count: count,
            total_count,
            has_more,
            execution_time_ms,
            statement_type: Some("SELECT".into()),
            offset: Some(offset),
            limit: Some(limit),
        })
    }
}
