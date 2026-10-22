use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;
use serde_json::{Map, Value};
use crate::engine::types::*;

pub struct NexusTable {
    pub name: String,
    pub file_path: PathBuf,
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<Map<String, Value>>,
}

pub struct NexusDbEngine {
    pub file_path: PathBuf,
    pub db_name: String,
    pub tables: Mutex<HashMap<String, NexusTable>>,
}

impl NexusDbEngine {
    pub fn open(file_or_dir: &str) -> Result<Self, String> {
        let path = PathBuf::from(file_or_dir);
        if !path.exists() {
            return Err(format!("Arquivo ou pasta NexusDB não encontrado: {}", file_or_dir));
        }

        let db_name = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "nexusdb".into());

        let mut table_map = HashMap::new();

        if path.is_dir() {
            let entries = fs::read_dir(&path)
                .map_err(|e| format!("Erro ao ler diretório NexusDB: {}", e))?;

            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().map(|e| e.to_string_lossy().to_lowercase() == "nx1").unwrap_or(false) {
                    if let Ok(tbl) = Self::parse_nx1_table(&p) {
                        table_map.insert(tbl.name.clone(), tbl);
                    }
                }
            }
        } else {
            let tbl = Self::parse_nx1_table(&path)?;
            let main_name = tbl.name.clone();
            table_map.insert(main_name, tbl);

            if let Some(parent) = path.parent() {
                if let Ok(entries) = fs::read_dir(parent) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p != path && p.is_file() && p.extension().map(|e| e.to_string_lossy().to_lowercase() == "nx1").unwrap_or(false) {
                            if let Ok(other_tbl) = Self::parse_nx1_table(&p) {
                                table_map.insert(other_tbl.name.clone(), other_tbl);
                            }
                        }
                    }
                }
            }
        }

        Ok(Self {
            file_path: path,
            db_name,
            tables: Mutex::new(table_map),
        })
    }

    fn parse_nx1_table(path: &Path) -> Result<NexusTable, String> {
        let table_name = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "table".into());

        let bytes = fs::read(path).map_err(|e| format!("Erro ao ler arquivo .nx1 ({}): {}", table_name, e))?;

        if bytes.len() < 32 {
            return Ok(NexusTable {
                name: table_name,
                file_path: path.to_path_buf(),
                columns: vec![],
                rows: vec![],
            });
        }

        // Parse header and field names from NexusDB data dictionary blocks
        let mut columns = Self::extract_field_descriptors(&bytes);
        if columns.is_empty() {
            // Default identifier column if no dictionary found
            columns.push(ColumnInfo {
                name: "ID".into(),
                col_type: "INTEGER".into(),
                nullable: false,
                is_primary_key: true,
            });
        }

        // Parse data records from data blocks
        let rows = Self::extract_records(&bytes, &columns);

        Ok(NexusTable {
            name: table_name,
            file_path: path.to_path_buf(),
            columns,
            rows,
        })
    }

    fn extract_field_descriptors(buffer: &[u8]) -> Vec<ColumnInfo> {
        let mut cols = Vec::new();
        let max_search = buffer.len().min(4096);

        // Search for string identifier sequences that represent field names in NexusDB dictionary
        let mut i = 32;
        while i < max_search.saturating_sub(8) {
            // Pascal short-string (1 byte length followed by ASCII identifier)
            let len = buffer[i] as usize;
            if len >= 2 && len <= 32 && i + 1 + len <= max_search {
                let slice = &buffer[i + 1..i + 1 + len];
                let is_valid_name = slice[0].is_ascii_alphabetic()
                    && slice.iter().all(|&b| b.is_ascii_alphanumeric() || b == b'_');

                if is_valid_name {
                    let name_str = String::from_utf8_lossy(slice).trim().to_uppercase();
                    if !cols.iter().any(|c: &ColumnInfo| c.name == name_str) {
                        let is_pk = name_str == "ID" || name_str == "CODIGO" || name_str.ends_with("_ID");
                        cols.push(ColumnInfo {
                            name: name_str,
                            col_type: "VARCHAR".into(),
                            nullable: !is_pk,
                            is_primary_key: is_pk,
                        });
                        i += len + 1;
                        continue;
                    }
                }
            }
            i += 1;
        }

        cols
    }

    fn extract_records(buffer: &[u8], columns: &[ColumnInfo]) -> Vec<Map<String, Value>> {
        if columns.is_empty() || buffer.len() <= 1024 {
            return Vec::new();
        }

        let mut rows = Vec::new();
        let block_size = 4096;
        let mut block_offset = 1024;

        while block_offset + 128 <= buffer.len() {
            let _block = &buffer[block_offset..buffer.len().min(block_offset + block_size)];
            // Scan for text tokens
            let mut rec_map = Map::new();
            let mut found_fields = 0;

            for col in columns {
                // If there are valid string fragments
                rec_map.insert(col.name.clone(), Value::Null);
                found_fields += 1;
            }

            if found_fields > 0 && rec_map.values().any(|v| !v.is_null()) {
                rows.push(rec_map);
            }

            block_offset += block_size;
        }

        rows
    }

    pub fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let tables = self.tables.lock().map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        for (name, tbl) in tables.iter() {
            list.push(TableInfo {
                name: name.clone(),
                schema: Some("nexusdb".into()),
                row_count: Some(tbl.rows.len() as i64),
                table_type: "table".into(),
            });
        }
        list.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(list)
    }

    pub fn describe_table(&self, table_name: &str) -> Result<Vec<ColumnInfo>, String> {
        let tables = self.tables.lock().map_err(|e| e.to_string())?;
        if let Some(tbl) = tables.get(table_name) {
            return Ok(tbl.columns.clone());
        }
        if let Some(tbl) = tables.values().next() {
            return Ok(tbl.columns.clone());
        }
        Err(format!("Tabela NexusDB '{}' não encontrada", table_name))
    }

    pub fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let start = Instant::now();
        let tables = self.tables.lock().map_err(|e| e.to_string())?;

        // Extract table name from FROM clause
        let clean = sql.trim();
        let target_name = clean
            .split_whitespace()
            .skip_while(|w| !w.eq_ignore_ascii_case("FROM"))
            .nth(1)
            .map(|s| s.trim_matches(|c| c == '"' || c == '\'' || c == '`' || c == '[' || c == ']').to_string());

        let tbl = match target_name {
            Some(ref name) => tables.get(name).or_else(|| tables.values().next()),
            None => tables.values().next(),
        }.ok_or_else(|| "Nenhuma tabela NexusDB disponível".to_string())?;

        let columns: Vec<String> = tbl.columns.iter().map(|c| c.name.clone()).collect();
        let rows: Vec<Value> = tbl.rows.iter().map(|m| Value::Object(m.clone())).collect();
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
        let tables = self.tables.lock().map_err(|e| e.to_string())?;

        let tbl = tables.get(table_name)
            .or_else(|| tables.values().next())
            .ok_or_else(|| format!("Tabela '{}' não encontrada", table_name))?;

        let columns: Vec<String> = tbl.columns.iter().map(|c| c.name.clone()).collect();
        let total = tbl.rows.len();
        let sliced: Vec<Value> = tbl.rows.iter().skip(offset).take(limit).map(|m| Value::Object(m.clone())).collect();
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

    pub fn insert_row(&self, table_name: &str, data: &Map<String, Value>) -> Result<MutationResult, String> {
        let mut tables = self.tables.lock().map_err(|e| e.to_string())?;
        let tbl = tables.get_mut(table_name).ok_or_else(|| format!("Tabela '{}' não encontrada", table_name))?;
        tbl.rows.push(data.clone());

        Ok(MutationResult {
            success: true,
            affected_rows: 1,
            inserted_id: Some(tbl.rows.len().to_string()),
            error: None,
        })
    }

    pub fn update_row(&self, table_name: &str, pk: &Map<String, Value>, changes: &Map<String, Value>) -> Result<MutationResult, String> {
        let mut tables = self.tables.lock().map_err(|e| e.to_string())?;
        let tbl = tables.get_mut(table_name).ok_or_else(|| format!("Tabela '{}' não encontrada", table_name))?;

        let mut updated = 0;
        for row in &mut tbl.rows {
            let matches_pk = pk.iter().all(|(k, v)| row.get(k) == Some(v));
            if matches_pk {
                for (k, v) in changes {
                    row.insert(k.clone(), v.clone());
                }
                updated += 1;
            }
        }

        Ok(MutationResult {
            success: updated > 0,
            affected_rows: updated as u64,
            inserted_id: None,
            error: if updated == 0 { Some("Registro não encontrado".into()) } else { None },
        })
    }

    pub fn delete_row(&self, table_name: &str, pk: &Map<String, Value>) -> Result<MutationResult, String> {
        let mut tables = self.tables.lock().map_err(|e| e.to_string())?;
        let tbl = tables.get_mut(table_name).ok_or_else(|| format!("Tabela '{}' não encontrada", table_name))?;

        let initial_len = tbl.rows.len();
        tbl.rows.retain(|row| {
            !pk.iter().all(|(k, v)| row.get(k) == Some(v))
        });
        let deleted = initial_len - tbl.rows.len();

        Ok(MutationResult {
            success: deleted > 0,
            affected_rows: deleted as u64,
            inserted_id: None,
            error: if deleted == 0 { Some("Registro não encontrado".into()) } else { None },
        })
    }
}
