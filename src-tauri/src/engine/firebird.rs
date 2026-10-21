use std::path::Path;
use std::str::FromStr;
use std::sync::Mutex;
use std::time::Instant;
use rsfbclient::{
    builder_native, builder_pure_rust, Charset, Queryable, Row, SimpleConnection, SqlType,
};
use serde_json::{json, Map, Value};
use crate::engine::types::*;

pub struct FirebirdEngine {
    conn: Mutex<SimpleConnection>,
    pub db_name: String,
    pub server_version: String,
}

fn fb_sql_type_to_json(val: &SqlType) -> Value {
    match val {
        SqlType::Null => Value::Null,
        SqlType::Text(t) => Value::String(t.clone()),
        SqlType::Integer(i) => json!(i),
        SqlType::Int128(i) => json!(i.to_string()),
        SqlType::Floating(f) => json!(f),
        SqlType::Timestamp(ts) => Value::String(ts.to_string()),
        SqlType::Binary(b) => Value::String(format!("{:02X?}", b)),
        SqlType::Boolean(b) => json!(b),
    }
}

fn find_fbclient_dll(db_path: Option<&str>) -> Option<String> {
    if let Some(p) = db_path {
        if let Some(parent) = Path::new(p).parent() {
            let local_dll = parent.join("fbclient.dll");
            if local_dll.exists() {
                return Some(local_dll.to_string_lossy().to_string());
            }
        }
    }

    let candidates = [
        r"C:\Program Files\Firebird\Firebird_5_0\fbclient.dll",
        r"C:\Program Files\Firebird\Firebird_4_0\fbclient.dll",
        r"C:\Program Files\Firebird\Firebird_3_0\fbclient.dll",
        r"C:\Program Files\Firebird\Firebird_2_5\bin\fbclient.dll",
        r"C:\Program Files (x86)\Firebird\Firebird_5_0\fbclient.dll",
        r"C:\Program Files (x86)\Firebird\Firebird_4_0\fbclient.dll",
        r"C:\Program Files (x86)\Firebird\Firebird_3_0\fbclient.dll",
        r"C:\Program Files (x86)\Firebird\Firebird_2_5\bin\fbclient.dll",
        r"C:\Windows\System32\fbclient.dll",
        r"C:\Windows\SysWOW64\fbclient.dll",
    ];

    for c in &candidates {
        if Path::new(c).exists() {
            return Some((*c).to_string());
        }
    }

    None
}

impl FirebirdEngine {
    pub fn connect(config: &ConnectionConfig) -> Result<Self, String> {
        let user = config.user.as_deref().unwrap_or("SYSDBA");
        let password = config.password.as_deref().unwrap_or("masterkey");
        let cs = Charset::from_str("WIN1252").unwrap_or_else(|_| Charset::from_str("utf8").unwrap());

        let candidate_path = config.file_path.as_deref().or_else(|| {
            if let Some(db) = config.database.as_deref() {
                let db_lower = db.to_lowercase();
                if db_lower.ends_with(".fdb")
                    || db_lower.ends_with(".gdb")
                    || db_lower.ends_with(".ib")
                    || db.contains('\\')
                    || db.contains('/')
                {
                    return Some(db);
                }
            }
            None
        });

        let mut last_error: Option<String> = None;

        // Mode 1: Local file embedded / native attempt if fbclient.dll exists
        if let Some(path_str) = candidate_path {
            if let Some(dll_path) = find_fbclient_dll(Some(path_str)) {
                let builder = builder_native();
                let native_res = builder
                    .with_dyn_load(dll_path.clone())
                    .with_embedded()
                    .db_name(path_str)
                    .user(user)
                    .charset(cs.clone())
                    .connect();

                match native_res {
                    Ok(conn) => {
                        let name = Path::new(path_str)
                            .file_name()
                            .map(|f| f.to_string_lossy().to_string())
                            .unwrap_or_else(|| "DATABASE.FDB".into());

                        return Ok(Self {
                            conn: Mutex::new(conn.into()),
                            db_name: name,
                            server_version: format!("Firebird Embedded (via {})", dll_path),
                        });
                    }
                    Err(e) => {
                        last_error = Some(format!("Tentativa Embedded ({}) falhou: {}", dll_path, e));
                    }
                }
            }
        }

        // Mode 2: TCP Wire protocol via pure Rust (works for servers and local Firebird service)
        let host = config.host.as_deref().unwrap_or("127.0.0.1");
        let port = config.port.unwrap_or(3050);
        let db_target = candidate_path.or(config.database.as_deref()).unwrap_or("DATABASE.FDB");

        let mut pure_builder = builder_pure_rust();
        let pure_res = pure_builder
            .host(host)
            .port(port)
            .db_name(db_target)
            .user(user)
            .pass(password)
            .charset(cs.clone())
            .connect();

        match pure_res {
            Ok(conn) => {
                let name = Path::new(db_target)
                    .file_name()
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or_else(|| db_target.to_string());

                Ok(Self {
                    conn: Mutex::new(conn.into()),
                    db_name: name,
                    server_version: format!("Firebird ({}:{}) [Wire Protocol]", host, port),
                })
            }
            Err(e) => {
                let detail = if let Some(prev) = last_error {
                    format!("{}; Falha via protocolo Wire TCP ({}:{}): {}", prev, host, port, e)
                } else {
                    format!("Falha ao conectar no Firebird ({}:{}): {}", host, port, e)
                };
                Err(detail)
            }
        }
    }

    pub fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;
        let sql = r#"
            SELECT TRIM(RDB$RELATION_NAME) AS TABLE_NAME
            FROM RDB$RELATIONS
            WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
              AND RDB$VIEW_BLR IS NULL
            ORDER BY RDB$RELATION_NAME ASC;
        "#;

        let rows: Vec<Row> = conn
            .query(sql, ())
            .map_err(|e| format!("Erro ao listar tabelas do Firebird: {}", e))?;

        let mut tables = Vec::new();
        for r in rows {
            if let Some(col) = r.cols.first() {
                if let SqlType::Text(t) = &col.value {
                    tables.push(TableInfo {
                        name: t.trim().to_string(),
                        schema: Some("firebird".into()),
                        row_count: None,
                        table_type: "table".into(),
                    });
                }
            }
        }

        let view_sql = r#"
            SELECT TRIM(RDB$RELATION_NAME) AS VIEW_NAME
            FROM RDB$RELATIONS
            WHERE (RDB$SYSTEM_FLAG = 0 OR RDB$SYSTEM_FLAG IS NULL)
              AND RDB$VIEW_BLR IS NOT NULL
            ORDER BY RDB$RELATION_NAME ASC;
        "#;
        if let Ok(v_rows) = conn.query::<(), Row>(view_sql, ()) {
            for r in v_rows {
                if let Some(col) = r.cols.first() {
                    if let SqlType::Text(t) = &col.value {
                        tables.push(TableInfo {
                            name: t.trim().to_string(),
                            schema: Some("firebird".into()),
                            row_count: None,
                            table_type: "view".into(),
                        });
                    }
                }
            }
        }

        Ok(tables)
    }

    pub fn describe_table(&self, table_name: &str) -> Result<Vec<ColumnInfo>, String> {
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;
        let sql = format!(
            r#"
            SELECT 
                TRIM(rf.RDB$FIELD_NAME) AS FIELD_NAME,
                f.RDB$FIELD_TYPE,
                COALESCE(rf.RDB$NULL_FLAG, 0) AS IS_NOT_NULL
            FROM RDB$RELATION_FIELDS rf
            JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
            WHERE TRIM(rf.RDB$RELATION_NAME) = UPPER('{}')
            ORDER BY rf.RDB$FIELD_POSITION ASC;
            "#,
            table_name.replace('\'', "''")
        );

        let rows: Vec<Row> = conn
            .query(&sql, ())
            .map_err(|e| format!("Erro ao descrever tabela Firebird: {}", e))?;

        let mut cols = Vec::new();
        for r in rows {
            let col_name = r.cols.get(0).and_then(|c| match &c.value {
                SqlType::Text(t) => Some(t.trim().to_string()),
                _ => None,
            }).unwrap_or_default();

            let type_code = r.cols.get(1).and_then(|c| match &c.value {
                SqlType::Integer(i) => Some(*i),
                _ => None,
            }).unwrap_or(0);

            let not_null = r.cols.get(2).and_then(|c| match &c.value {
                SqlType::Integer(i) => Some(*i == 1),
                _ => None,
            }).unwrap_or(false);

            let type_str = match type_code {
                7 => "SMALLINT",
                8 => "INTEGER",
                10 => "FLOAT",
                12 => "DATE",
                13 => "TIME",
                14 => "CHAR",
                16 => "BIGINT",
                27 => "DOUBLE PRECISION",
                35 => "TIMESTAMP",
                37 => "VARCHAR",
                261 => "BLOB",
                _ => "VARCHAR",
            };

            cols.push(ColumnInfo {
                name: col_name,
                col_type: type_str.into(),
                nullable: !not_null,
                is_primary_key: false,
            });
        }
        Ok(cols)
    }

    pub fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let start = Instant::now();
        let mut conn = self.conn.lock().map_err(|e| e.to_string())?;
        let rows: Vec<Row> = conn
            .query(sql, ())
            .map_err(|e| format!("Erro ao executar query Firebird: {}", e))?;
        let execution_time_ms = start.elapsed().as_millis();

        let mut columns = Vec::new();
        if let Some(first) = rows.first() {
            columns = first.cols.iter().map(|c| c.name.to_string()).collect();
        }

        let mut res_rows = Vec::new();
        for r in rows {
            let mut map = Map::new();
            for col in r.cols {
                map.insert(col.name.to_string(), fb_sql_type_to_json(&col.value));
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

    pub fn get_table_data(&self, table_name: &str, limit: usize, offset: usize) -> Result<QueryResult, String> {
        let sql = format!(
            "SELECT FIRST {} SKIP {} * FROM \"{}\";",
            limit, offset, table_name
        );
        self.execute_query(&sql)
    }
}
