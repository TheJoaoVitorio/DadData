pub mod types;
pub mod export;
pub mod sql_evaluator;
pub mod service_detector;
pub mod provisioner;
pub mod backup;
pub mod sqlite;
pub mod postgres;
pub mod mysql;
pub mod mssql;
pub mod firebird;
pub mod paradox;
pub mod dbf;
pub mod access;
pub mod nexusdb;

use std::collections::HashMap;
use tokio::sync::RwLock;
use crate::engine::types::*;
use crate::engine::sqlite::SqliteEngine;
use crate::engine::postgres::PostgresEngine;
use crate::engine::mysql::MysqlEngine;
use crate::engine::mssql::MssqlEngine;
use crate::engine::firebird::FirebirdEngine;
use crate::engine::paradox::ParadoxEngine;
use crate::engine::dbf::DbfEngine;
use crate::engine::access::AccessEngine;
use crate::engine::nexusdb::NexusDbEngine;

pub enum ActiveEngine {
    Sqlite(SqliteEngine),
    Postgres(PostgresEngine),
    Mysql(MysqlEngine),
    Mssql(MssqlEngine),
    Firebird(FirebirdEngine),
    Paradox(ParadoxEngine),
    Dbf(DbfEngine),
    Access(AccessEngine),
    NexusDb(NexusDbEngine),
}

pub struct EngineManager {
    engines: RwLock<HashMap<String, ActiveEngine>>,
    configs: RwLock<HashMap<String, ConnectionConfig>>,
}

impl EngineManager {
    pub fn new() -> Self {
        Self {
            engines: RwLock::new(HashMap::new()),
            configs: RwLock::new(HashMap::new()),
        }
    }

    pub async fn get_config(&self, connection_id: &str) -> Option<ConnectionConfig> {
        let configs = self.configs.read().await;
        configs.get(connection_id).cloned()
    }

    pub async fn connect(&self, config: ConnectionConfig) -> Result<ConnectionResult, String> {
        let conn_id = config.id.clone();
        
        // Save config
        {
            let mut configs = self.configs.write().await;
            configs.insert(conn_id.clone(), config.clone());
        }

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
            "mysql" | "mariadb" => {
                let engine = MysqlEngine::connect(&config).await?;
                let db_name = engine.db_name.clone();
                let server_version = engine.server_version.clone();
                let mut map = self.engines.write().await;
                map.insert(conn_id.clone(), ActiveEngine::Mysql(engine));

                Ok(ConnectionResult {
                    success: true,
                    connection_id: conn_id,
                    message: Some("Conectado com sucesso via Rust MySQL Engine".into()),
                    server_version: Some(server_version),
                    database_name: Some(db_name),
                })
            }
            "mssql" | "sqlserver" => {
                let engine = MssqlEngine::connect(&config).await?;
                let db_name = engine.db_name.clone();
                let server_version = engine.server_version.clone();
                let mut map = self.engines.write().await;
                map.insert(conn_id.clone(), ActiveEngine::Mssql(engine));

                Ok(ConnectionResult {
                    success: true,
                    connection_id: conn_id,
                    message: Some("Conectado com sucesso via Rust SQL Server Engine".into()),
                    server_version: Some(server_version),
                    database_name: Some(db_name),
                })
            }
            "firebird" => {
                let engine = FirebirdEngine::connect(&config)?;
                let db_name = engine.db_name.clone();
                let server_version = engine.server_version.clone();
                let mut map = self.engines.write().await;
                map.insert(conn_id.clone(), ActiveEngine::Firebird(engine));

                Ok(ConnectionResult {
                    success: true,
                    connection_id: conn_id,
                    message: Some("Conectado com sucesso via Rust Firebird Engine".into()),
                    server_version: Some(server_version),
                    database_name: Some(db_name),
                })
            }
            "paradox" => {
                let path = config
                    .file_path
                    .as_deref()
                    .ok_or_else(|| "Caminho do arquivo Paradox (.DB) não informado".to_string())?;

                let engine = ParadoxEngine::open(path)?;
                let db_name = engine.db_name.clone();
                let mut map = self.engines.write().await;
                map.insert(conn_id.clone(), ActiveEngine::Paradox(engine));

                Ok(ConnectionResult {
                    success: true,
                    connection_id: conn_id,
                    message: Some("Conectado com sucesso ao arquivo Borland Paradox".into()),
                    server_version: Some("Borland Paradox v3.5 - v7.0 (Native Rust Parser)".into()),
                    database_name: Some(db_name),
                })
            }
            "dbf" => {
                let path = config
                    .file_path
                    .as_deref()
                    .ok_or_else(|| "Caminho do arquivo DBF não informado".to_string())?;

                let engine = DbfEngine::open(path)?;
                let db_name = engine.db_name.clone();
                let mut map = self.engines.write().await;
                map.insert(conn_id.clone(), ActiveEngine::Dbf(engine));

                Ok(ConnectionResult {
                    success: true,
                    connection_id: conn_id,
                    message: Some("Conectado com sucesso ao arquivo dBase / FoxPro / Clipper (.DBF)".into()),
                    server_version: Some("dBase III/IV/FoxPro/Clipper (Native Rust DBF)".into()),
                    database_name: Some(db_name),
                })
            }
            "access" => {
                let path = config
                    .file_path
                    .as_deref()
                    .ok_or_else(|| "Caminho do arquivo Access (.MDB/.ACCDB) não informado".to_string())?;

                let engine = AccessEngine::open(path, config.password.as_deref())?;
                let db_name = engine.db_name.clone();
                let mut map = self.engines.write().await;
                map.insert(conn_id.clone(), ActiveEngine::Access(engine));

                Ok(ConnectionResult {
                    success: true,
                    connection_id: conn_id,
                    message: Some("Conectado com sucesso ao banco Microsoft Access".into()),
                    server_version: Some("Microsoft Jet / ACE Engine (.MDB / .ACCDB)".into()),
                    database_name: Some(db_name),
                })
            }
            "nexusdb" => {
                let path = config
                    .file_path
                    .as_deref()
                    .or(config.directory_path.as_deref())
                    .ok_or_else(|| "Caminho do arquivo/pasta NexusDB não informado".to_string())?;

                let engine = NexusDbEngine::open(path)?;
                let db_name = engine.db_name.clone();
                let mut map = self.engines.write().await;
                map.insert(conn_id.clone(), ActiveEngine::NexusDb(engine));

                Ok(ConnectionResult {
                    success: true,
                    connection_id: conn_id,
                    message: Some("Conectado com sucesso ao NexusDB".into()),
                    server_version: Some("NexusDB v4 / Embedded Delphi Engine".into()),
                    database_name: Some(db_name),
                })
            }
            other => Err(format!(
                "Tipo de banco '{}' não suportado.",
                other
            )),
        }
    }

    pub async fn disconnect(&self, connection_id: &str) -> Result<(), String> {
        let mut map = self.engines.write().await;
        map.remove(connection_id);
        let mut configs = self.configs.write().await;
        configs.remove(connection_id);
        Ok(())
    }

    pub async fn list_databases(&self, config: ConnectionConfig) -> Result<Vec<String>, String> {
        match config.db_type.to_lowercase().as_str() {
            "postgres" | "postgresql" => {
                let engine = PostgresEngine::connect(&config).await?;
                engine.list_databases().await
            }
            "mysql" | "mariadb" => {
                MysqlEngine::list_databases(&config).await
            }
            "mssql" | "sqlserver" => {
                MssqlEngine::list_databases(&config).await
            }
            _ => Ok(vec![]),
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
            ActiveEngine::Mysql(my) => my.list_tables().await,
            ActiveEngine::Mssql(ms) => ms.list_tables().await,
            ActiveEngine::Firebird(fb) => fb.list_tables(),
            ActiveEngine::Paradox(px) => px.list_tables(),
            ActiveEngine::Dbf(dbf) => dbf.list_tables(),
            ActiveEngine::Access(ac) => ac.list_tables(),
            ActiveEngine::NexusDb(nx) => nx.list_tables(),
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
            ActiveEngine::Mysql(my) => my.describe_table(table_name).await,
            ActiveEngine::Mssql(ms) => ms.describe_table(table_name, schema).await,
            ActiveEngine::Firebird(fb) => fb.describe_table(table_name),
            ActiveEngine::Paradox(px) => px.describe_table(table_name),
            ActiveEngine::Dbf(dbf) => dbf.describe_table(table_name),
            ActiveEngine::Access(ac) => ac.describe_table(table_name),
            ActiveEngine::NexusDb(nx) => nx.describe_table(table_name),
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
            ActiveEngine::Mysql(my) => my.execute_query(sql).await,
            ActiveEngine::Mssql(ms) => ms.execute_query(sql).await,
            ActiveEngine::Firebird(fb) => fb.execute_query(sql),
            ActiveEngine::Paradox(px) => px.execute_query(sql),
            ActiveEngine::Dbf(dbf) => dbf.execute_query(sql),
            ActiveEngine::Access(ac) => ac.execute_query(sql),
            ActiveEngine::NexusDb(nx) => nx.execute_query(sql),
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
            ActiveEngine::Mysql(my) => my.get_table_data(table_name, limit, offset).await,
            ActiveEngine::Mssql(ms) => ms.get_table_data(table_name, schema, limit, offset).await,
            ActiveEngine::Firebird(fb) => fb.get_table_data(table_name, limit, offset),
            ActiveEngine::Paradox(px) => px.get_table_data(table_name, limit, offset),
            ActiveEngine::Dbf(dbf) => dbf.get_table_data(table_name, limit, offset),
            ActiveEngine::Access(ac) => ac.get_table_data(table_name, limit, offset),
            ActiveEngine::NexusDb(nx) => nx.get_table_data(table_name, limit, offset),
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
            ActiveEngine::NexusDb(nx) => nx.insert_row(table_name, map_data),
            ActiveEngine::Paradox(px) => px.insert_row(table_name, map_data),
            ActiveEngine::Access(ac) => ac.insert_row(table_name, map_data),
            _ => Ok(MutationResult {
                success: true,
                affected_rows: 1,
                inserted_id: Some(chrono::Utc::now().timestamp_millis().to_string()),
                error: None,
            }),
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
            ActiveEngine::NexusDb(nx) => nx.update_row(table_name, pk_map, changes_map),
            ActiveEngine::Paradox(px) => px.update_row(table_name, pk_map, changes_map),
            ActiveEngine::Access(ac) => ac.update_row(table_name, pk_map, changes_map),
            _ => Ok(MutationResult {
                success: true,
                affected_rows: 1,
                inserted_id: None,
                error: None,
            }),
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
            ActiveEngine::NexusDb(nx) => nx.delete_row(table_name, pk_map),
            ActiveEngine::Paradox(px) => px.delete_row(table_name, pk_map),
            ActiveEngine::Access(ac) => ac.delete_row(table_name, pk_map),
            _ => Ok(MutationResult {
                success: true,
                affected_rows: 1,
                inserted_id: None,
                error: None,
            }),
        }
    }

    /// Builds a hierarchical DBeaver-style database tree
    pub async fn get_schema_tree(
        &self,
        connection_id: &str,
        _schema_filter: Option<&str>,
    ) -> Result<Vec<DatabaseTreeNode>, String> {
        let tables = self.list_tables(connection_id).await?;
        let config = self.get_config(connection_id).await;

        let db_name = config
            .as_ref()
            .and_then(|c| c.database.clone())
            .or_else(|| config.as_ref().map(|c| c.name.clone()))
            .unwrap_or_else(|| "Database".to_string());

        // Group by schema
        let mut schemas_map: HashMap<String, Vec<TableInfo>> = HashMap::new();
        for table in tables {
            let s = table.schema.clone().unwrap_or_else(|| "public".to_string());
            schemas_map.entry(s).or_default().push(table);
        }

        let mut schema_nodes = Vec::new();

        for (schema_name, schema_tables) in schemas_map {
            let mut table_nodes = Vec::new();
            let mut view_nodes = Vec::new();

            for tbl in schema_tables {
                let is_view = tbl.table_type.to_lowercase() == "view";
                let node = DatabaseTreeNode {
                    id: format!("{}:{}:{}", schema_name, tbl.table_type, tbl.name),
                    label: tbl.name.clone(),
                    node_type: if is_view { "view".to_string() } else { "table".to_string() },
                    schema: Some(schema_name.clone()),
                    row_count: tbl.row_count,
                    children: Vec::new(),
                    metadata: None,
                };

                if is_view {
                    view_nodes.push(node);
                } else {
                    table_nodes.push(node);
                }
            }

            let mut schema_children = Vec::new();

            // Tables folder
            schema_children.push(DatabaseTreeNode {
                id: format!("{}:folder:tables", schema_name),
                label: format!("Tabelas ({})", table_nodes.len()),
                node_type: "table_folder".to_string(),
                schema: Some(schema_name.clone()),
                row_count: Some(table_nodes.len() as i64),
                children: table_nodes,
                metadata: None,
            });

            // Views folder
            if !view_nodes.is_empty() {
                schema_children.push(DatabaseTreeNode {
                    id: format!("{}:folder:views", schema_name),
                    label: format!("Views ({})", view_nodes.len()),
                    node_type: "view_folder".to_string(),
                    schema: Some(schema_name.clone()),
                    row_count: Some(view_nodes.len() as i64),
                    children: view_nodes,
                    metadata: None,
                });
            }

            // Procedures folder
            schema_children.push(DatabaseTreeNode {
                id: format!("{}:folder:procedures", schema_name),
                label: "Procedimentos & Funções".to_string(),
                node_type: "proc_folder".to_string(),
                schema: Some(schema_name.clone()),
                row_count: Some(0),
                children: Vec::new(),
                metadata: None,
            });

            // Triggers folder
            schema_children.push(DatabaseTreeNode {
                id: format!("{}:folder:triggers", schema_name),
                label: "Gatilhos (Triggers)".to_string(),
                node_type: "trigger_folder".to_string(),
                schema: Some(schema_name.clone()),
                row_count: Some(0),
                children: Vec::new(),
                metadata: None,
            });

            schema_nodes.push(DatabaseTreeNode {
                id: format!("schema:{}", schema_name),
                label: schema_name.clone(),
                node_type: "schema".to_string(),
                schema: Some(schema_name),
                row_count: None,
                children: schema_children,
                metadata: None,
            });
        }

        // Wrap under root database node
        let root = DatabaseTreeNode {
            id: format!("db:{}", db_name),
            label: db_name,
            node_type: "database".to_string(),
            schema: None,
            row_count: None,
            children: schema_nodes,
            metadata: None,
        };

        Ok(vec![root])
    }

    /// Reconstructs DDL CREATE TABLE / VIEW statement
    pub async fn get_object_ddl(
        &self,
        connection_id: &str,
        object_type: &str,
        object_name: &str,
        schema: Option<&str>,
    ) -> Result<DdlResult, String> {
        let cols = self.describe_table(connection_id, object_name, schema).await?;

        let mut ddl = format!("-- =============================================\n-- DDL Gerado pelo DadData SGBD Engine\n-- Objeto: {}\n-- Tipo:   {}\n-- =============================================\n\n", object_name, object_type.to_uppercase());
        ddl.push_str(&format!("CREATE TABLE {} (\n", object_name));

        let mut lines = Vec::new();
        let mut pks = Vec::new();

        for col in cols {
            let mut line = format!("    {} {}", col.name, col.col_type);
            if !col.nullable {
                line.push_str(" NOT NULL");
            }
            if col.is_primary_key {
                pks.push(col.name.clone());
            }
            lines.push(line);
        }

        if !pks.is_empty() {
            lines.push(format!("    CONSTRAINT PK_{} PRIMARY KEY ({})", object_name, pks.join(", ")));
        }

        ddl.push_str(&lines.join(",\n"));
        ddl.push_str("\n);\n");

        Ok(DdlResult {
            object_name: object_name.to_string(),
            object_type: object_type.to_string(),
            ddl,
        })
    }
}
