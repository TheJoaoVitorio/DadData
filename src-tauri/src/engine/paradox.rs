use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Instant;
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

pub struct ParadoxEngine {
    pub file_path: PathBuf,
    pub db_name: String,
    pub fields: Vec<ParadoxField>,
    pub rows: Vec<Map<String, Value>>,
}

impl ParadoxEngine {
    pub fn open(file_path: &str) -> Result<Self, String> {
        let path = PathBuf::from(file_path);
        if !path.exists() {
            return Err(format!("Arquivo Paradox não encontrado: {}", file_path));
        }

        let db_name = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "database.db".into());

        let mut file = File::open(&path).map_err(|e| format!("Erro ao abrir arquivo Paradox: {}", e))?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|e| format!("Erro ao ler arquivo Paradox: {}", e))?;

        if buffer.len() < 256 {
            return Err("Arquivo Paradox inválido: menor que cabeçalho mínimo".into());
        }

        let record_size = u16::from_le_bytes([buffer[0], buffer[1]]) as usize;
        let header_size = u16::from_le_bytes([buffer[2], buffer[3]]) as usize;
        let block_size_code = buffer[5] as usize;
        let block_size = if block_size_code > 0 { block_size_code } else { 2 } * 1024;
        let record_count = u32::from_le_bytes([buffer[6], buffer[7], buffer[8], buffer[9]]) as usize;
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

        // Read records across blocks
        let mut rows = Vec::new();
        let mut block_offset = if header_size > 0 { header_size } else { 2048 };

        while block_offset + block_size <= buffer.len() && rows.len() < record_count {
            let data_offset = u16::from_le_bytes([buffer[block_offset + 4], buffer[block_offset + 5]]) as usize;
            let records_in_block = if data_offset > 0 && record_size > 0 {
                if data_offset < record_size {
                    data_offset
                } else {
                    (data_offset / record_size) + 1
                }
            } else {
                (block_size.saturating_sub(6)) / (if record_size > 0 { record_size } else { 1 })
            };

            let valid_records = records_in_block.min(record_count - rows.len());

            for r in 0..valid_records {
                let rec_offset = block_offset + 6 + r * record_size;
                if rec_offset + record_size > buffer.len() {
                    break;
                }

                let mut row = Map::new();
                row.insert("_rowId".into(), Value::Number((rows.len() + 1).into()));

                for f in &fields {
                    let val_offset = rec_offset + f.offset;
                    if val_offset + f.length <= buffer.len() {
                        let val = Self::read_field_value(&buffer, val_offset, f);
                        row.insert(f.name.clone(), val);
                    }
                }
                rows.push(row);
            }
            block_offset += block_size;
        }

        Ok(Self {
            file_path: path,
            db_name,
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
            0x05 | 0x06 => 8,
            0x09 => 1,
            0x10 => 4,
            0x14 | 0x16 => 4,
            _ => 1,
        }
    }

    fn read_field_value(buffer: &[u8], offset: usize, field: &ParadoxField) -> Value {
        let b0 = buffer[offset];
        match field.type_code {
            0x01 => {
                let slice = &buffer[offset..offset + field.length];
                let null_idx = slice.iter().position(|&b| b == 0).unwrap_or(slice.len());
                let s = String::from_utf8_lossy(&slice[..null_idx]).trim().to_string();
                if s.is_empty() { Value::Null } else { Value::String(s) }
            }
            0x03 => {
                if b0 == 0 && buffer[offset + 1] == 0 {
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
            0x05 | 0x06 => {
                if b0 == 0 {
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
                serde_json::Number::from_f64(num).map(Value::Number).unwrap_or(Value::Null)
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
                let null_idx = slice.iter().position(|&b| b == 0).unwrap_or(slice.len());
                let s = String::from_utf8_lossy(&slice[..null_idx]).trim().to_string();
                if s.is_empty() { Value::Null } else { Value::String(s) }
            }
        }
    }

    pub fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let parent = self.file_path.parent().unwrap_or_else(|| Path::new("."));
        let mut tables = Vec::new();

        // Main table
        let main_name = self.file_path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "TABLE".into());
        tables.push(TableInfo {
            name: main_name,
            schema: Some("paradox".into()),
            row_count: Some(self.rows.len() as i64),
            table_type: "table".into(),
        });

        // Scan sibling .db files
        if let Ok(entries) = std::fs::read_dir(parent) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p != self.file_path && p.extension().map(|e| e.to_string_lossy().to_lowercase()) == Some("db".into()) {
                    let name = p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
                    if !name.is_empty() {
                        tables.push(TableInfo {
                            name,
                            schema: Some("paradox".into()),
                            row_count: None,
                            table_type: "table".into(),
                        });
                    }
                }
            }
        }

        Ok(tables)
    }

    pub fn describe_table(&self, _table_name: &str) -> Result<Vec<ColumnInfo>, String> {
        Ok(self.fields.iter().map(|f| ColumnInfo {
            name: f.name.clone(),
            col_type: f.type_name.clone(),
            nullable: true,
            is_primary_key: f.type_code == 0x14 || f.type_code == 0x16,
        }).collect())
    }

    pub fn execute_query(&self, _sql: &str) -> Result<QueryResult, String> {
        let start = Instant::now();
        let columns: Vec<String> = self.fields.iter().map(|f| f.name.clone()).collect();
        let rows: Vec<Value> = self.rows.iter().map(|m| Value::Object(m.clone())).collect();
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

    pub fn get_table_data(&self, _table_name: &str, limit: usize, offset: usize) -> Result<QueryResult, String> {
        let start = Instant::now();
        let columns: Vec<String> = self.fields.iter().map(|f| f.name.clone()).collect();
        let total = self.rows.len();
        let sliced: Vec<Value> = self.rows.iter().skip(offset).take(limit).map(|m| Value::Object(m.clone())).collect();
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
