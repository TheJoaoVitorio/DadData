pub mod engine;
pub mod commands;
pub mod storage;

use std::sync::Arc;
use engine::EngineManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let engine_manager = Arc::new(EngineManager::new());

    tauri::Builder::default()
        .manage(engine_manager)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::db_connect,
            commands::db_disconnect,
            commands::db_test_connection,
            commands::db_list_databases,
            commands::db_list_tables,
            commands::db_describe_table,
            commands::db_execute_query,
            commands::db_get_table_data,
            commands::db_insert_row,
            commands::db_update_row,
            commands::db_delete_row,
            commands::export_data,
            commands::storage_get_connections,
            commands::storage_save_connection,
            commands::storage_delete_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
