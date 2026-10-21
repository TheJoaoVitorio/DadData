use std::path::PathBuf;
use std::time::Instant;
use serde_json::{json, Map, Value};
use crate::engine::types::*;

pub struct NexusDbEngine {
    pub file_path: PathBuf,
    pub db_name: String,
    pub tables: Map<String, Value>,
}

impl NexusDbEngine {
    pub fn open(file_path: &str) -> Result<Self, String> {
        let path = PathBuf::from(file_path);
        let db_name = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "nexus.nx1".into());

        let mut tables = Map::new();

        // Sample tables structure for NexusDB v4
        let cols = json!([
            { "name": "ACCOUNT_ID", "type": "INTEGER", "nullable": false, "isPrimaryKey": true },
            { "name": "ACCOUNT_NUMBER", "type": "VARCHAR(30)", "nullable": false, "isPrimaryKey": false },
            { "name": "BRANCH", "type": "VARCHAR(10)", "nullable": false, "isPrimaryKey": false },
            { "name": "BALANCE", "type": "DECIMAL(15,2)", "nullable": false, "isPrimaryKey": false },
            { "name": "STATUS", "type": "VARCHAR(15)", "nullable": false, "isPrimaryKey": false }
        ]);

        let rows = json!([
            { "ACCOUNT_ID": 1001, "ACCOUNT_NUMBER": "98451-2", "BRANCH": "0101", "BALANCE": 125430.80, "STATUS": "ACTIVE" },
            { "ACCOUNT_ID": 1002, "ACCOUNT_NUMBER": "44129-8", "BRANCH": "0101", "BALANCE": 43200.00, "STATUS": "ACTIVE" },
            { "ACCOUNT_ID": 1003, "ACCOUNT_NUMBER": "12903-5", "BRANCH": "0204", "BALANCE": 9810.50, "STATUS": "DORMANT" },
            { "ACCOUNT_ID": 1004, "ACCOUNT_NUMBER": "77218-0", "BRANCH": "0308", "BALANCE": 341900.20, "STATUS": "ACTIVE" }
        ]);

        tables.insert("ACCOUNTS".into(), json!({ "columns": cols, "rows": rows }));

        Ok(Self {
            file_path: path,
            db_name,
            tables,
        })
    }

    pub fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let mut list = Vec::new();
        for (name, data) in &self.tables {
            let row_count = data.get("rows").and_then(|r| r.as_array()).map(|a| a.len() as i64);
            list.push(TableInfo {
                name: name.clone(),
                schema: Some("nexusdb".into()),
                row_count,
                table_type: "table".into(),
            });
        }
        Ok(list)
    }

    pub fn describe_table(&self, table_name: &str) -> Result<Vec<ColumnInfo>, String> {
        let table = self.tables.get(table_name).or_else(|| self.tables.values().next());
        if let Some(t) = table {
            if let Some(cols) = t.get("columns").and_then(|c| c.as_array()) {
                let parsed: Result<Vec<ColumnInfo>, _> = serde_json::from_value(Value::Array(cols.clone()));
                return parsed.map_err(|e| e.to_string());
            }
        }
        Err(format!("Tabela NexusDB '{}' não encontrada", table_name))
    }

    pub fn execute_query(&self, _sql: &str) -> Result<QueryResult, String> {
        let start = Instant::now();
        let (_name, data) = self.tables.iter().next().ok_or_else(|| "Nenhuma tabela disponível".to_string())?;
        let rows = data.get("rows").and_then(|r| r.as_array()).cloned().unwrap_or_default();
        let columns = if let Some(first) = rows.first().and_then(|r| r.as_object()) {
            first.keys().cloned().collect()
        } else {
            vec![]
        };

        let count = rows.len();
        Ok(QueryResult {
            columns,
            rows,
            row_count: count,
            total_count: Some(count as i64),
            has_more: false,
            execution_time_ms: start.elapsed().as_millis(),
            statement_type: Some("SELECT".into()),
            offset: None,
            limit: None,
        })
    }

    pub fn get_table_data(&self, table_name: &str, limit: usize, offset: usize) -> Result<QueryResult, String> {
        let start = Instant::now();
        let data = self.tables.get(table_name).or_else(|| self.tables.values().next()).ok_or_else(|| "Tabela não encontrada".to_string())?;
        let rows = data.get("rows").and_then(|r| r.as_array()).cloned().unwrap_or_default();
        let columns = if let Some(first) = rows.first().and_then(|r| r.as_object()) {
            first.keys().cloned().collect()
        } else {
            vec![]
        };

        let total = rows.len();
        let sliced: Vec<Value> = rows.into_iter().skip(offset).take(limit).collect();
        let count = sliced.len();
        let has_more = (offset + count) < total;

        Ok(QueryResult {
            columns,
            rows: sliced,
            row_count: count,
            total_count: Some(total as i64),
            has_more,
            execution_time_ms: start.elapsed().as_millis(),
            statement_type: Some("SELECT".into()),
            offset: Some(offset),
            limit: Some(limit),
        })
    }
}
