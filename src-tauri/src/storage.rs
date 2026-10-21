use rusqlite::{params, Connection};
use std::path::PathBuf;
use crate::engine::types::ConnectionConfig;

pub struct LocalStorage;

impl LocalStorage {
    fn db_path() -> PathBuf {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let mut path = PathBuf::from(appdata);
            path.push("DadData");
            let _ = std::fs::create_dir_all(&path);
            path.push("daddata_storage.db");
            return path;
        }
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let mut path = PathBuf::from(userprofile);
            path.push(".daddata");
            let _ = std::fs::create_dir_all(&path);
            path.push("daddata_storage.db");
            return path;
        }
        PathBuf::from("daddata_storage.db")
    }

    fn open_connection() -> Result<Connection, String> {
        let path = Self::db_path();
        let conn = Connection::open(&path)
            .map_err(|e| format!("Falha ao abrir banco local SQLite de configuração: {}", e))?;

        conn.execute(
            r#"
            CREATE TABLE IF NOT EXISTS saved_connections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                db_type TEXT NOT NULL,
                host TEXT,
                port INTEGER,
                database_name TEXT,
                username TEXT,
                password TEXT,
                ssl INTEGER,
                file_path TEXT,
                directory_path TEXT,
                auth_type TEXT,
                updated_at TEXT
            );
            "#,
            [],
        )
        .map_err(|e| format!("Falha ao inicializar tabela de configurações: {}", e))?;

        Ok(conn)
    }

    pub fn get_saved_connections() -> Result<Vec<ConnectionConfig>, String> {
        let conn = Self::open_connection()?;
        let mut stmt = conn
            .prepare(
                r#"
                SELECT 
                    id, name, db_type, host, port, database_name, username, 
                    password, ssl, file_path, directory_path, auth_type 
                FROM saved_connections 
                ORDER BY updated_at DESC, name ASC;
                "#,
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let db_type: String = row.get(2)?;
                let host: Option<String> = row.get(3)?;
                let port_i64: Option<i64> = row.get(4)?;
                let database: Option<String> = row.get(5)?;
                let user: Option<String> = row.get(6)?;
                let password: Option<String> = row.get(7)?;
                let ssl_int: Option<i64> = row.get(8)?;
                let file_path: Option<String> = row.get(9)?;
                let directory_path: Option<String> = row.get(10)?;
                let auth_type: Option<String> = row.get(11)?;

                Ok(ConnectionConfig {
                    id,
                    name,
                    db_type,
                    host,
                    port: port_i64.map(|p| p as u16),
                    database,
                    user,
                    password,
                    ssl: ssl_int.map(|s| s != 0),
                    file_path,
                    directory_path,
                    auth_type,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut configs = Vec::new();
        for r in rows {
            if let Ok(c) = r {
                configs.push(c);
            }
        }
        Ok(configs)
    }

    pub fn save_connection(config: &ConnectionConfig) -> Result<(), String> {
        let conn = Self::open_connection()?;
        let updated_at = chrono::Utc::now().to_rfc3339();

        conn.execute(
            r#"
            INSERT INTO saved_connections (
                id, name, db_type, host, port, database_name, username, 
                password, ssl, file_path, directory_path, auth_type, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                db_type = excluded.db_type,
                host = excluded.host,
                port = excluded.port,
                database_name = excluded.database_name,
                username = excluded.username,
                password = excluded.password,
                ssl = excluded.ssl,
                file_path = excluded.file_path,
                directory_path = excluded.directory_path,
                auth_type = excluded.auth_type,
                updated_at = excluded.updated_at;
            "#,
            params![
                config.id,
                config.name,
                config.db_type,
                config.host,
                config.port.map(|p| p as i64),
                config.database,
                config.user,
                config.password,
                config.ssl.map(|s| if s { 1 } else { 0 }),
                config.file_path,
                config.directory_path,
                config.auth_type,
                updated_at,
            ],
        )
        .map_err(|e| format!("Erro ao salvar conexão no SQLite local: {}", e))?;

        Ok(())
    }

    pub fn delete_connection(id: &str) -> Result<(), String> {
        let conn = Self::open_connection()?;
        conn.execute("DELETE FROM saved_connections WHERE id = ?1;", params![id])
            .map_err(|e| format!("Erro ao excluir conexão do SQLite local: {}", e))?;
        Ok(())
    }
}
