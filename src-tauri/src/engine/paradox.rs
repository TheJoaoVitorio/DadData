use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;
use chrono::NaiveDate;
use serde_json::{Map, Value};
use crate::engine::types::*;

#[derive(Debug, Clone)]
pub struct ParadoxField {
    pub name: String,
    pub type_code: u8,
    pub type_name: String,
    pub length: usize,
    pub offset: usize,
}

pub struct ParadoxTable {
    pub name: String,
    pub file_path: PathBuf,
    pub fields: Vec<ParadoxField>,
    pub rows: Vec<Map<String, Value>>,
}

pub struct ParadoxEngine {
    pub file_path: PathBuf,
    pub db_name: String,
    pub tables: Mutex<HashMap<String, ParadoxTable>>,
}

impl ParadoxEngine {
    pub fn open(file_or_dir: &str) -> Result<Self, String> {
        let path = PathBuf::from(file_or_dir);
        if !path.exists() {
            return Err(format!("Arquivo ou pasta Paradox não encontrado: {}", file_or_dir));
        }

        let db_name = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "paradox".into());

        let mut table_map = HashMap::new();

        if path.is_dir() {
            let entries = fs::read_dir(&path)
                .map_err(|e| format!("Erro ao ler diretório Paradox: {}", e))?;

            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.extension().map(|e| e.to_string_lossy().to_lowercase() == "db").unwrap_or(false) {
                    if let Ok(tbl) = Self::parse_db_file(&p) {
                        table_map.insert(tbl.name.clone(), tbl);
                    }
                }
            }
        } else {
            let tbl = Self::parse_db_file(&path)?;
            let main_name = tbl.name.clone();
            table_map.insert(main_name, tbl);

            if let Some(parent) = path.parent() {
                if let Ok(entries) = fs::read_dir(parent) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p != path && p.is_file() && p.extension().map(|e| e.to_string_lossy().to_lowercase() == "db").unwrap_or(false) {
                            if let Ok(other_tbl) = Self::parse_db_file(&p) {
                                table_map.insert(other_tbl.name.clone(), other_tbl);
                            }
                        }
                    }
                }
            }
        }

        if table_map.is_empty() {
            return Err("Nenhum arquivo de tabela Paradox (.DB) válido encontrado".into());
        }

        Ok(Self {
            file_path: path,
            db_name,
            tables: Mutex::new(table_map),
        })
    }

    fn parse_db_file(path: &Path) -> Result<ParadoxTable, String> {
        let table_name = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "TABLE".into());

        let mut file = File::open(path).map_err(|e| format!("Erro ao abrir {}: {}", table_name, e))?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).map_err(|e| format!("Erro ao ler {}: {}", table_name, e))?;

        if buffer.len() < 256 {
            return Err("Arquivo Paradox menor que o cabeçalho mínimo".into());
        }

        let record_size = u16::from_le_bytes([buffer[0], buffer[1]]) as usize;
        let header_size = u16::from_le_bytes([buffer[2], buffer[3]]) as usize;
        let block_size_code = buffer[5] as usize;
        let block_size = if block_size_code > 0 { block_size_code } else { 2 } * 1024;
        let field_count = u16::from_le_bytes([buffer[33], buffer[34]]) as usize;

        // Field descriptors offset
        let mut field_desc_offset = 0x78;
        if buffer.get(0x78).copied() == Some(0) && buffer.get(0x58).copied().unwrap_or(0) != 0 {
            field_desc_offset = 0x58;
        }

        let mut raw_fields = Vec::new();
        for _ in 0..field_count {
            if field_desc_offset + 2 > buffer.len() {
                break;
            }
            let type_code = buffer[field_desc_offset];
            let length = buffer[field_desc_offset + 1] as usize;
            raw_fields.push((type_code, length));
            field_desc_offset += 2;
        }

        let field_names = Self::extract_field_names(&buffer, field_count, header_size);
        let mut fields = Vec::new();
        let mut current_offset = 0;

        for (i, (type_code, length)) in raw_fields.into_iter().enumerate() {
            let name = field_names.get(i).cloned().unwrap_or_else(|| format!("FIELD_{}", i + 1));
            let type_name = Self::get_type_name(type_code);
            let effective_len = if length > 0 { length } else { Self::get_default_length(type_code) };

            fields.push(ParadoxField {
                name,
                type_code,
                type_name,
                length: effective_len,
                offset: current_offset,
            });

            current_offset += effective_len;
        }

        // Read records across all blocks
        let mut rows = Vec::new();
        let total_blocks = if block_size > 0 && buffer.len() > header_size {
            (buffer.len() - header_size) / block_size
        } else {
            0
        };

        for b in 0..total_blocks {
            let block_offset = header_size + b * block_size;
            if block_offset + 6 > buffer.len() {
                break;
            }

            let data_offset = i16::from_le_bytes([buffer[block_offset + 4], buffer[block_offset + 5]]) as usize;
            let records_in_block = if data_offset > 0 && record_size > 0 {
                data_offset / record_size
            } else {
                0
            };

            for r in 0..records_in_block {
                let rec_offset = block_offset + 6 + r * record_size;
                if rec_offset + record_size > buffer.len() {
                    break;
                }

                let mut row = Map::new();
                for f in &fields {
                    let val_offset = rec_offset + f.offset;
                    if val_offset + f.length <= buffer.len() {
                        let val = Self::read_field_value(&buffer, val_offset, f);
                        row.insert(f.name.clone(), val);
                    }
                }
                rows.push(row);
            }
        }

        Ok(ParadoxTable {
            name: table_name,
            file_path: path.to_path_buf(),
            fields,
            rows,
        })
    }

    fn extract_field_names(buffer: &[u8], field_count: usize, header_size: usize) -> Vec<String> {
        let max_search = (if header_size > 0 { header_size } else { 2048 }).min(buffer.len());
        for start in 120..max_search.saturating_sub(20) {
            let mut off = start;
            let mut candidate_names = Vec::new();
            let mut valid = true;

            for _ in 0..field_count {
                let mut name_bytes = Vec::new();
                while off < max_search && buffer[off] != 0 {
                    let b = buffer[off];
                    if (32..=126).contains(&b) {
                        name_bytes.push(b);
                        off += 1;
                    } else {
                        valid = false;
                        break;
                    }
                }
                off += 1; // Skip null terminator
                if !valid || name_bytes.is_empty() {
                    valid = false;
                    break;
                }
                candidate_names.push(String::from_utf8_lossy(&name_bytes).trim().to_string());
            }

            if valid && candidate_names.len() == field_count {
                return candidate_names;
            }
        }
        (0..field_count).map(|i| format!("FIELD_{}", i + 1)).collect()
    }

    fn get_type_name(code: u8) -> String {
        match code {
            0x01 => "ALPHA",
            0x02 => "DATE",
            0x03 => "SHORT",
            0x04 => "LONG",
            0x05 => "CURRENCY",
            0x06 => "NUMBER",
            0x09 => "LOGICAL",
            0x0c | 0x0d | 0x0e => "BLOB",
            0x10 => "TIME",
            0x14 | 0x16 => "AUTOINC",
            0x15 => "BCD",
            _ => "UNKNOWN",
        }
        .into()
    }

    fn get_default_length(code: u8) -> usize {
        match code {
            0x01 => 255,
            0x02 => 4,
            0x03 => 2,
            0x04 => 4,
            0x05 | 0x06 | 0x15 => 8,
            0x09 => 1,
            0x10 => 4,
            0x14 | 0x16 => 4,
            _ => 1,
        }
    }

    fn decode_latin1(slice: &[u8]) -> String {
        let null_idx = slice.iter().position(|&b| b == 0).unwrap_or(slice.len());
        let sub = &slice[..null_idx];
        sub.iter().map(|&b| b as char).collect::<String>().trim().to_string()
    }

    fn read_field_value(buffer: &[u8], offset: usize, field: &ParadoxField) -> Value {
        let b0 = buffer[offset];
        match field.type_code {
            0x01 => {
                let slice = &buffer[offset..offset + field.length];
                let s = Self::decode_latin1(slice);
                if s.is_empty() { Value::Null } else { Value::String(s) }
            }
            0x02 => {
                if buffer[offset..offset + 4].iter().all(|&b| b == 0) {
                    return Value::Null;
                }
                let days = (u32::from_be_bytes([buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]]) ^ 0x80000000) as i32;
                if let Some(date) = NaiveDate::from_num_days_from_ce_opt(days) {
                    Value::String(date.format("%Y-%m-%d").to_string())
                } else {
                    Value::Number(days.into())
                }
            }
            0x03 => {
                if buffer[offset..offset + 2].iter().all(|&b| b == 0) {
                    return Value::Null;
                }
                let raw = u16::from_be_bytes([buffer[offset], buffer[offset + 1]]) ^ 0x8000;
                Value::Number((raw as i16).into())
            }
            0x04 | 0x14 | 0x16 => {
                if buffer[offset..offset + 4].iter().all(|&b| b == 0) {
                    return Value::Null;
                }
                let raw = u32::from_be_bytes([buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3]]) ^ 0x80000000;
                Value::Number(raw.into())
            }
            0x05 | 0x06 | 0x15 => {
                if buffer[offset..offset + 8].iter().all(|&b| b == 0) {
                    return Value::Null;
                }
                let mut copy = [0u8; 8];
                copy.copy_from_slice(&buffer[offset..offset + 8]);
                if (b0 & 0x80) != 0 {
                    copy[0] ^= 0x80;
                } else {
                    for b in &mut copy {
                        *b = !*b;
                    }
                }
                let num = f64::from_be_bytes(copy);
                if num.is_nan() || num.is_infinite() {
                    Value::Null
                } else {
                    serde_json::Number::from_f64(num).map(Value::Number).unwrap_or(Value::Null)
                }
            }
            0x09 => {
                if b0 == 0 {
                    Value::Null
                } else {
                    Value::Bool((b0 & 0x7F) != 0)
                }
            }
            _ => {
                let slice = &buffer[offset..offset + field.length];
                let s = Self::decode_latin1(slice);
                if s.is_empty() { Value::Null } else { Value::String(s) }
            }
        }
    }

    pub fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let tables = self.tables.lock().map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        for (name, tbl) in tables.iter() {
            list.push(TableInfo {
                name: name.clone(),
                schema: Some("paradox".into()),
                row_count: Some(tbl.rows.len() as i64),
                table_type: "table".into(),
            });
        }
        list.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(list)
    }

    pub fn describe_table(&self, table_name: &str) -> Result<Vec<ColumnInfo>, String> {
        let tables = self.tables.lock().map_err(|e| e.to_string())?;
        let tbl = tables.get(table_name)
            .or_else(|| tables.values().next())
            .ok_or_else(|| format!("Tabela Paradox '{}' não encontrada", table_name))?;

        Ok(tbl.fields.iter().map(|f| ColumnInfo {
            name: f.name.clone(),
            col_type: f.type_name.clone(),
            nullable: true,
            is_primary_key: f.type_code == 0x14 || f.type_code == 0x16,
        }).collect())
    }

    pub fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let start = Instant::now();
        let tables = self.tables.lock().map_err(|e| e.to_string())?;

        let clean = sql.trim();
        let target_name = clean
            .split_whitespace()
            .skip_while(|w| !w.eq_ignore_ascii_case("FROM"))
            .nth(1)
            .map(|s| s.trim_matches(|c| c == '"' || c == '\'' || c == '`' || c == '[' || c == ']').to_string());

        let tbl = match target_name {
            Some(ref name) => tables.get(name).or_else(|| tables.values().next()),
            None => tables.values().next(),
        }.ok_or_else(|| "Nenhuma tabela Paradox disponível".to_string())?;

        let columns: Vec<String> = tbl.fields.iter().map(|f| f.name.clone()).collect();
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
            .ok_or_else(|| format!("Tabela Paradox '{}' não encontrada", table_name))?;

        let columns: Vec<String> = tbl.fields.iter().map(|f| f.name.clone()).collect();
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
        let tbl = tables.get_mut(table_name).ok_or_else(|| format!("Tabela Paradox '{}' não encontrada", table_name))?;
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
        let tbl = tables.get_mut(table_name).ok_or_else(|| format!("Tabela Paradox '{}' não encontrada", table_name))?;
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
        let tbl = tables.get_mut(table_name).ok_or_else(|| format!("Tabela Paradox '{}' não encontrada", table_name))?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn get_paradox_test_dir() -> PathBuf {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir.join("../db_test/Paradox")
    }

    #[test]
    fn test_paradox_open_directory_and_introspect() {
        let test_dir = get_paradox_test_dir();
        if !test_dir.exists() {
            println!("db_test/Paradox não encontrado, ignorando teste local.");
            return;
        }

        let engine = ParadoxEngine::open(test_dir.to_str().unwrap()).expect("Should open Paradox directory");
        let tables = engine.list_tables().expect("Should list tables");

        // Verify that tables were discovered from directory
        let table_names: Vec<String> = tables.iter().map(|t| t.name.clone()).collect();
        println!("Discovered tables: {:?}", table_names);
        assert!(table_names.contains(&"TabCli".to_string()));
        assert!(table_names.contains(&"TabEst1".to_string()));
        assert!(table_names.contains(&"TabEst3A".to_string()));
        assert!(table_names.contains(&"TabEst8".to_string()));
        assert!(table_names.contains(&"TabFor".to_string()));

        // Check TabCli structure and row count
        let tab_cli_cols = engine.describe_table("TabCli").expect("Should describe TabCli");
        assert_eq!(tab_cli_cols.len(), 40);

        // Fetch first page of TabCli (limit 10, offset 0)
        let page1 = engine.get_table_data("TabCli", 10, 0).expect("Should fetch page 1 of TabCli");
        assert_eq!(page1.rows.len(), 10);
        assert_eq!(page1.total_count, Some(1051));
        
        let first_row = &page1.rows[0];
        println!("TabCli first row: {:?}", first_row);
        assert!(first_row.get("Controle").is_some());
        assert!(first_row.get("Codigo").is_some());
        assert!(first_row.get("Nome").is_some());

        // Check TabEst1 structure and row count
        let tab_est1_cols = engine.describe_table("TabEst1").expect("Should describe TabEst1");
        assert_eq!(tab_est1_cols.len(), 38);

        // Check TabEst3A structure and row count (63146 rows)
        let tab_est3a_cols = engine.describe_table("TabEst3A").expect("Should describe TabEst3A");
        assert_eq!(tab_est3a_cols.len(), 29);

        // Fetch slice of TabEst3A (limit 5, offset 0)
        let page_est3a = engine.get_table_data("TabEst3A", 5, 0).expect("Should fetch 5 rows of TabEst3A");
        assert_eq!(page_est3a.rows.len(), 5);
        assert_eq!(page_est3a.total_count, Some(63146));
    }

    #[test]
    fn test_paradox_open_single_file() {
        let test_dir = get_paradox_test_dir();
        let file_path = test_dir.join("TabCli.db");
        if !file_path.exists() {
            println!("TabCli.db não encontrado, ignorando teste local.");
            return;
        }

        // Opening single file should also discover sibling tables in directory
        let engine = ParadoxEngine::open(file_path.to_str().unwrap()).expect("Should open Paradox file");
        let tables = engine.list_tables().expect("Should list tables");
        let table_names: Vec<String> = tables.iter().map(|t| t.name.clone()).collect();
        assert!(table_names.contains(&"TabCli".to_string()));
        
        let page = engine.get_table_data("TabCli", 5, 0).expect("Should fetch data");
        assert_eq!(page.rows.len(), 5);
    }
}
