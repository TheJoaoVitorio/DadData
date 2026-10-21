pub mod types;
pub mod export;
pub mod sqlite;
pub mod postgres;

use std::collections::HashMap;
use tokio::sync::RwLock;
use crate::engine::types::*;
use crate::engine::sqlite::SqliteEngine;
use crate::engine::postgres::PostgresEngine;

pub enum ActiveEngine {
    Sqlite(SqliteEngine),
    Postgres(PostgresEngine),
}

pub struct EngineManager {
    engines: RwLock<HashMap<String, ActiveEngine>>,
}

impl EngineManager {
    pub fn new() -> Self {
        Self {
            engines: RwLock::new(HashMap::new()),
        }
    }

    pub async fn connect(&self, config: ConnectionConfig) -> Result<ConnectionResult, String> {
        let conn_id = config.id.clone();
        match config.db_type.to_lowercase().as_str() {
            "postgres" | "postgresql" => {
                let engine = PostgresEngine::connect(&config).await?;
                let db_name = engine.db_name.clone();
                let mut map = self.engines.write().await;
                map.insert(conn_id.clone(), ActiveEngine::Postgres(engine));

                Ok(ConnectionResult {
                    success: true,
                    connection_id: conn_id,
                    message: Some("Conectado com sucesso via Rust Engine".into()),
                    server_version: Some("PostgreSQL (Native Rust tokio-postgres)".into()),
                    database_name: Some(db_name),
                })
            }
            "sqlite" => {
                let path = config
                    .file_path
                    .as_deref()
                    .ok_or_else(|| "Caminho do arquivo SQLite não informado".to_string())?;

                let engine = SqliteEngine::open(path)?;
                let db_name = engine.db_name.clone();
                let mut map = self.engines.write().await;
                map.insert(conn_id.clone(), ActiveEngine::Sqlite(engine));

                Ok(ConnectionResult {
                    success: true,
                    connection_id: conn_id,
                    message: Some("Conectado com sucesso via Rust Engine".into()),
                    server_version: Some("SQLite 3 (Native Rust rusqlite)".into()),
                    database_name: Some(db_name),
                })
            }
            other => Err(format!(
                "Tipo de banco '{}' não suportado diretamente pelo Rust Engine no momento.",
                other
            )),
        }
    }

    pub async fn disconnect(&self, connection_id: &str) -> Result<(), String> {
        let mut map = self.engines.write().await;
        map.remove(connection_id);
        Ok(())
    }

    pub async fn list_databases(&self, config: ConnectionConfig) -> Result<Vec<String>, String> {
        if config.db_type.to_lowercase().contains("postgres") {
            let engine = PostgresEngine::connect(&config).await?;
            engine.list_databases().await
        } else {
            Ok(vec![])
        }
    }

    pub async fn list_tables(&self, connection_id: &str) -> Result<Vec<TableInfo>, String> {
        let map = self.engines.read().await;
        let engine = map
            .get(connection_id)
            .ok_or_else(|| "Conexão não encontrada no Rust Engine".to_string())?;

        match engine {
            ActiveEngine::Postgres(pg) => pg.list_tables().await,
            ActiveEngine::Sqlite(sq) => sq.list_tables(),
        }
    }

    pub async fn describe_table(
        &self,
        connection_id: &str,
        table_name: &str,
        schema: Option<&str>,
    ) -> Result<Vec<ColumnInfo>, String> {
        let map = self.engines.read().await;
        let engine = map
            .get(connection_id)
            .ok_or_else(|| "Conexão não encontrada no Rust Engine".to_string())?;

        match engine {
            ActiveEngine::Postgres(pg) => pg.describe_table(table_name, schema).await,
            ActiveEngine::Sqlite(sq) => sq.describe_table(table_name),
        }
    }

    pub async fn execute_query(
        &self,
        connection_id: &str,
        sql: &str,
    ) -> Result<QueryResult, String> {
        let map = self.engines.read().await;
        let engine = map
            .get(connection_id)
            .ok_or_else(|| "Conexão não encontrada no Rust Engine".to_string())?;

        match engine {
            ActiveEngine::Postgres(pg) => pg.execute_query(sql).await,
            ActiveEngine::Sqlite(sq) => sq.execute_query(sql),
        }
    }

    pub async fn get_table_data(
        &self,
        connection_id: &str,
        table_name: &str,
        schema: Option<&str>,
        limit: usize,
        offset: usize,
    ) -> Result<QueryResult, String> {
        let map = self.engines.read().await;
        let engine = map
            .get(connection_id)
            .ok_or_else(|| "Conexão não encontrada no Rust Engine".to_string())?;

        match engine {
            ActiveEngine::Postgres(pg) => pg.get_table_data(table_name, schema, limit, offset).await,
            ActiveEngine::Sqlite(sq) => sq.get_table_data(table_name, limit, offset),
        }
    }

    pub async fn insert_row(
        &self,
        connection_id: &str,
        table_name: &str,
        schema: Option<&str>,
        data: serde_json::Value,
    ) -> Result<MutationResult, String> {
        let map_data = data
            .as_object()
            .ok_or_else(|| "Dados para inserção devem ser um objeto JSON".to_string())?;

        let map = self.engines.read().await;
        let engine = map
            .get(connection_id)
            .ok_or_else(|| "Conexão não encontrada no Rust Engine".to_string())?;

        match engine {
            ActiveEngine::Postgres(pg) => pg.insert_row(table_name, schema, map_data).await,
            ActiveEngine::Sqlite(sq) => sq.insert_row(table_name, map_data),
        }
    }

    pub async fn update_row(
        &self,
        connection_id: &str,
        table_name: &str,
        schema: Option<&str>,
        primary_key: serde_json::Value,
        changes: serde_json::Value,
    ) -> Result<MutationResult, String> {
        let pk_map = primary_key
            .as_object()
            .ok_or_else(|| "Chave primária deve ser um objeto JSON".to_string())?;
        let changes_map = changes
            .as_object()
            .ok_or_else(|| "Alterações devem ser um objeto JSON".to_string())?;

        let map = self.engines.read().await;
        let engine = map
            .get(connection_id)
            .ok_or_else(|| "Conexão não encontrada no Rust Engine".to_string())?;

        match engine {
            ActiveEngine::Postgres(pg) => pg.update_row(table_name, schema, pk_map, changes_map).await,
            ActiveEngine::Sqlite(sq) => sq.update_row(table_name, pk_map, changes_map),
        }
    }

    pub async fn delete_row(
        &self,
        connection_id: &str,
        table_name: &str,
        schema: Option<&str>,
        primary_key: serde_json::Value,
    ) -> Result<MutationResult, String> {
        let pk_map = primary_key
            .as_object()
            .ok_or_else(|| "Chave primária deve ser um objeto JSON".to_string())?;

        let map = self.engines.read().await;
        let engine = map
            .get(connection_id)
            .ok_or_else(|| "Conexão não encontrada no Rust Engine".to_string())?;

        match engine {
            ActiveEngine::Postgres(pg) => pg.delete_row(table_name, schema, pk_map).await,
            ActiveEngine::Sqlite(sq) => sq.delete_row(table_name, pk_map),
        }
    }
}
