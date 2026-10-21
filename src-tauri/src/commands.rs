use std::sync::Arc;
use tauri::State;
use crate::engine::EngineManager;
use crate::engine::types::*;
use crate::engine::export::*;

#[tauri::command]
pub async fn db_connect(
    state: State<'_, Arc<EngineManager>>,
    config: ConnectionConfig,
) -> Result<ConnectionResult, String> {
    state.connect(config).await
}

#[tauri::command]
pub async fn db_disconnect(
    state: State<'_, Arc<EngineManager>>,
    connection_id: String,
) -> Result<(), String> {
    state.disconnect(&connection_id).await
}

#[tauri::command]
pub async fn db_test_connection(
    state: State<'_, Arc<EngineManager>>,
    config: ConnectionConfig,
) -> Result<ConnectionResult, String> {
    let conn_id = config.id.clone();
    let res = state.connect(config).await?;
    let _ = state.disconnect(&conn_id).await;
    Ok(res)
}

#[tauri::command]
pub async fn db_list_databases(
    state: State<'_, Arc<EngineManager>>,
    config: ConnectionConfig,
) -> Result<Vec<String>, String> {
    state.list_databases(config).await
}

#[tauri::command]
pub async fn db_list_tables(
    state: State<'_, Arc<EngineManager>>,
    connection_id: String,
) -> Result<Vec<TableInfo>, String> {
    state.list_tables(&connection_id).await
}

#[tauri::command]
pub async fn db_describe_table(
    state: State<'_, Arc<EngineManager>>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
) -> Result<Vec<ColumnInfo>, String> {
    state.describe_table(&connection_id, &table_name, schema.as_deref()).await
}

#[tauri::command]
pub async fn db_execute_query(
    state: State<'_, Arc<EngineManager>>,
    connection_id: String,
    query: String,
) -> Result<QueryResult, String> {
    state.execute_query(&connection_id, &query).await
}

#[tauri::command]
pub async fn db_get_table_data(
    state: State<'_, Arc<EngineManager>>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<QueryResult, String> {
    state
        .get_table_data(
            &connection_id,
            &table_name,
            schema.as_deref(),
            limit.unwrap_or(300),
            offset.unwrap_or(0),
        )
        .await
}

#[tauri::command]
pub async fn db_insert_row(
    state: State<'_, Arc<EngineManager>>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    data: serde_json::Value,
) -> Result<MutationResult, String> {
    state.insert_row(&connection_id, &table_name, schema.as_deref(), data).await
}

#[tauri::command]
pub async fn db_update_row(
    state: State<'_, Arc<EngineManager>>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    primary_key: serde_json::Value,
    changes: serde_json::Value,
) -> Result<MutationResult, String> {
    state
        .update_row(
            &connection_id,
            &table_name,
            schema.as_deref(),
            primary_key,
            changes,
        )
        .await
}

#[tauri::command]
pub async fn db_delete_row(
    state: State<'_, Arc<EngineManager>>,
    connection_id: String,
    table_name: String,
    schema: Option<String>,
    primary_key: serde_json::Value,
) -> Result<MutationResult, String> {
    state
        .delete_row(&connection_id, &table_name, schema.as_deref(), primary_key)
        .await
}

#[tauri::command]
pub async fn export_data(
    _state: State<'_, Arc<EngineManager>>,
    options: ExportOptions,
) -> Result<ExportResult, String> {
    let rows = options.rows.clone().unwrap_or_default();
    let columns = if let Some(cols) = &options.columns {
        cols.clone()
    } else if let Some(first) = rows.first().and_then(|r| r.as_object()) {
        first.keys().cloned().collect()
    } else {
        vec![]
    };

    let target_file_path = options.target_file_path.clone();
    let is_excel = options.format.to_lowercase() == "xlsx" || target_file_path.ends_with(".xlsx");

    let count = if is_excel {
        export_to_excel(
            &target_file_path,
            options.sheet_name.as_deref(),
            &columns,
            &rows,
        )?
    } else {
        export_to_csv(&target_file_path, &columns, &rows)?
    };

    let file_size_bytes = std::fs::metadata(&target_file_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(ExportResult {
        success: true,
        file_path: target_file_path,
        row_count: count,
        file_size_bytes,
        message: format!("Exportados {} registros com sucesso!", count),
    })
}
