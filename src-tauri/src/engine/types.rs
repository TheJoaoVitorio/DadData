use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub db_type: String,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub database: Option<String>,
    pub user: Option<String>,
    pub password: Option<String>,
    pub ssl: Option<bool>,
    pub file_path: Option<String>,
    pub directory_path: Option<String>,
    pub auth_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionResult {
    pub success: bool,
    pub connection_id: String,
    pub message: Option<String>,
    pub server_version: Option<String>,
    pub database_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableInfo {
    pub name: String,
    pub schema: Option<String>,
    pub row_count: Option<i64>,
    #[serde(rename = "type")]
    pub table_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub col_type: String,
    pub nullable: bool,
    pub is_primary_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub columns: Vec<String>,
    pub rows: Vec<serde_json::Value>,
    pub row_count: usize,
    pub total_count: Option<i64>,
    pub has_more: bool,
    pub execution_time_ms: u128,
    pub statement_type: Option<String>,
    pub offset: Option<usize>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MutationResult {
    pub success: bool,
    pub affected_rows: u64,
    pub inserted_id: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub format: String, // "csv" or "xlsx"
    pub target_file_path: String,
    pub sheet_name: Option<String>,
    pub table_name: Option<String>,
    pub query: Option<String>,
    pub columns: Option<Vec<String>>,
    pub rows: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub success: bool,
    pub file_path: String,
    pub row_count: usize,
    pub file_size_bytes: u64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedService {
    pub id: String,
    pub name: String,
    pub label: String,
    pub status: String, // "running", "stopped", "not_installed"
    pub port: Option<u16>,
    pub version: Option<String>,
    pub tools: std::collections::HashMap<String, String>,
    pub is_portable: bool,
    pub service_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupOptions {
    pub connection_id: String,
    pub database_name: Option<String>,
    pub output_path: String,
    pub format: String, // "sql", "custom", "tar", "zip", "bak"
    pub dump_type: String, // "full", "schema_only", "data_only"
    pub drop_existing: Option<bool>,
    pub custom_tool_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreOptions {
    pub connection_id: String,
    pub database_name: Option<String>,
    pub input_path: String,
    pub format: Option<String>,
    pub drop_first: Option<bool>,
    pub custom_tool_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEvent {
    pub stream: String, // "stdout", "stderr", "info", "error"
    pub message: String,
    pub timestamp: String,
    pub percentage: Option<u8>,
    pub is_done: bool,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseTreeNode {
    pub id: String,
    pub label: String,
    pub node_type: String, // "database", "schema", "table_folder", "view_folder", "proc_folder", "trigger_folder", "table", "view", "procedure", "trigger", "index", "column"
    pub schema: Option<String>,
    pub row_count: Option<i64>,
    pub children: Vec<DatabaseTreeNode>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DdlResult {
    pub object_name: String,
    pub object_type: String,
    pub ddl: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableToolStatus {
    pub id: String,
    pub name: String,
    pub is_installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub download_url: Option<String>,
    pub size_bytes: Option<u64>,
}
