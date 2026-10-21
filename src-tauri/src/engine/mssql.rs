use std::time::Instant;
use serde_json::{json, Map, Value};
use crate::engine::types::*;

pub struct MssqlEngine {
    pub host: String,
    pub port: u16,
    pub db_name: String,
    pub auth_type: String,
    pub server_version: String,
    pub tables: Map<String, Value>,
}

impl MssqlEngine {
    pub fn connect(config: &ConnectionConfig) -> Result<Self, String> {
        let host = config.host.clone().unwrap_or_else(|| "localhost".into());
        let port = config.port.unwrap_or(1433);
        let db_name = config.database.clone().unwrap_or_else(|| "master".into());
        let auth_type = config.auth_type.clone().unwrap_or_else(|| "sql".into());

        let auth_desc = if auth_type == "windows" {
            "Windows Integrated Authentication"
        } else {
            "SQL Server Authentication"
        };

        let server_version = format!(
            "Microsoft SQL Server ({}:{}) [{}]",
            host, port, auth_desc
        );

        let mut tables = Map::new();

        // Sample SQL Server tables (AdventureWorks/Northwind style)
        let cols_customers = json!([
            { "name": "CustomerID", "type": "INT", "nullable": false, "isPrimaryKey": true },
            { "name": "CompanyName", "type": "NVARCHAR(100)", "nullable": false, "isPrimaryKey": false },
            { "name": "ContactName", "type": "NVARCHAR(60)", "nullable": false, "isPrimaryKey": false },
            { "name": "Email", "type": "NVARCHAR(100)", "nullable": true, "isPrimaryKey": false },
            { "name": "Phone", "type": "NVARCHAR(25)", "nullable": true, "isPrimaryKey": false }
        ]);

        let rows_customers = json!([
            { "CustomerID": 1, "CompanyName": "Contoso Retail Brasil", "ContactName": "Eduardo Santos", "Email": "eduardo@contoso.com.br", "Phone": "(11) 3456-7890" },
            { "CustomerID": 2, "CompanyName": "Fabrikam Componentes", "ContactName": "Camila Oliveira", "Email": "camila@fabrikam.com", "Phone": "(41) 9876-5432" },
            { "CustomerID": 3, "CompanyName": "Litware Soluções em TI", "ContactName": "Rodrigo Silva", "Email": "rodrigo@litware.com.br", "Phone": "(21) 2345-6789" }
        ]);

        let cols_orders = json!([
            { "name": "OrderID", "type": "INT", "nullable": false, "isPrimaryKey": true },
            { "name": "CustomerID", "type": "INT", "nullable": false, "isPrimaryKey": false },
            { "name": "OrderDate", "type": "DATETIME2", "nullable": false, "isPrimaryKey": false },
            { "name": "TotalAmount", "type": "MONEY", "nullable": false, "isPrimaryKey": false }
        ]);

        let rows_orders = json!([
            { "OrderID": 10001, "CustomerID": 1, "OrderDate": "2024-05-12T10:30:00", "TotalAmount": 14500.00 },
            { "OrderID": 10002, "CustomerID": 2, "OrderDate": "2024-05-14T14:15:00", "TotalAmount": 8200.50 },
            { "OrderID": 10003, "CustomerID": 3, "OrderDate": "2024-05-15T09:00:00", "TotalAmount": 32100.75 }
        ]);

        tables.insert("Customers".into(), json!({ "columns": cols_customers, "rows": rows_customers }));
        tables.insert("Orders".into(), json!({ "columns": cols_orders, "rows": rows_orders }));

        Ok(Self {
            host,
            port,
            db_name,
            auth_type,
            server_version,
            tables,
        })
    }

    pub fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let mut list = Vec::new();
        for (name, data) in &self.tables {
            let row_count = data.get("rows").and_then(|r| r.as_array()).map(|a| a.len() as i64);
            list.push(TableInfo {
                name: name.clone(),
                schema: Some("dbo".into()),
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
        Err(format!("Tabela SQL Server '{}' não encontrada", table_name))
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
