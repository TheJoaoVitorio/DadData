use std::path::PathBuf;
use std::time::Instant;
use serde_json::{json, Map, Value};
use crate::engine::types::*;

pub struct AccessEngine {
    pub file_path: PathBuf,
    pub db_name: String,
    pub tables: Map<String, Value>,
}

impl AccessEngine {
    pub fn open(file_path: &str) -> Result<Self, String> {
        let path = PathBuf::from(file_path);
        if !path.exists() {
            return Err(format!("Arquivo Access não encontrado: {}", file_path));
        }

        let db_name = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "database.mdb".into());

        let mut tables = Map::new();

        // Sample Access Jet tables
        let cols_customers = json!([
            { "name": "CustomerID", "type": "INTEGER", "nullable": false, "isPrimaryKey": true },
            { "name": "CompanyName", "type": "TEXT", "nullable": false, "isPrimaryKey": false },
            { "name": "ContactName", "type": "TEXT", "nullable": true, "isPrimaryKey": false },
            { "name": "City", "type": "TEXT", "nullable": true, "isPrimaryKey": false },
            { "name": "Country", "type": "TEXT", "nullable": true, "isPrimaryKey": false }
        ]);

        let rows_customers = json!([
            { "CustomerID": 1, "CompanyName": "Alfreds Futterkiste", "ContactName": "Maria Anders", "City": "Berlin", "Country": "Germany" },
            { "CustomerID": 2, "CompanyName": "Ana Trujillo Emparedados", "ContactName": "Ana Trujillo", "City": "México D.F.", "Country": "Mexico" },
            { "CustomerID": 3, "CompanyName": "Antonio Moreno Taquería", "ContactName": "Antonio Moreno", "City": "México D.F.", "Country": "Mexico" },
            { "CustomerID": 4, "CompanyName": "Around the Horn", "ContactName": "Thomas Hardy", "City": "London", "Country": "UK" },
            { "CustomerID": 5, "CompanyName": "Berglunds snabbköp", "ContactName": "Christina Berglund", "City": "Luleå", "Country": "Sweden" }
        ]);

        let cols_orders = json!([
            { "name": "OrderID", "type": "INTEGER", "nullable": false, "isPrimaryKey": true },
            { "name": "CustomerID", "type": "INTEGER", "nullable": false, "isPrimaryKey": false },
            { "name": "OrderDate", "type": "DATE", "nullable": false, "isPrimaryKey": false },
            { "name": "Freight", "type": "CURRENCY", "nullable": true, "isPrimaryKey": false }
        ]);

        let rows_orders = json!([
            { "OrderID": 10248, "CustomerID": 1, "OrderDate": "2024-07-04", "Freight": 32.38 },
            { "OrderID": 10249, "CustomerID": 2, "OrderDate": "2024-07-05", "Freight": 11.61 },
            { "OrderID": 10250, "CustomerID": 3, "OrderDate": "2024-07-08", "Freight": 65.83 },
            { "OrderID": 10251, "CustomerID": 4, "OrderDate": "2024-07-08", "Freight": 41.34 }
        ]);

        tables.insert("Customers".into(), json!({ "columns": cols_customers, "rows": rows_customers }));
        tables.insert("Orders".into(), json!({ "columns": cols_orders, "rows": rows_orders }));

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
                schema: Some("access".into()),
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
        Err(format!("Tabela Access '{}' não encontrada", table_name))
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
