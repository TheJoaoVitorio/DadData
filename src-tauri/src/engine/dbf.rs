use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Instant;
use serde_json::{Map, Value};
use crate::engine::types::*;

#[derive(Debug, Clone)]
pub struct DbfField {
    pub name: String,
    pub field_type: char,
    pub length: usize,
    pub decimal_count: usize,
    pub offset: usize,
}

pub struct DbfEngine {
    pub file_path: PathBuf,
    pub db_name: String,
    pub fields: Vec<DbfField>,
    pub rows: Vec<Map<String, Value>>,
}

impl DbfEngine {
    pub fn open(file_path: &str) -> Result<Self, String> {
        let path = PathBuf::from(file_path);
        if !path.exists() {
            return Err(format!("Arquivo DBF não encontrado: {}", file_path));
        }

        let db_name = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "database.dbf".into());

        let mut file = File::open(&path).map_err(|e| format!("Erro ao abrir arquivo DBF: {}", e))?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|e| format!("Erro ao ler arquivo DBF: {}", e))?;

        if buffer.len() < 32 {
            return Err("Arquivo DBF inválido: cabeçalho muito pequeno".into());
        }

        let record_count = u32::from_le_bytes([buffer[4], buffer[5], buffer[6], buffer[7]]) as usize;
        let header_length = u16::from_le_bytes([buffer[8], buffer[9]]) as usize;
        let record_length = u16::from_le_bytes([buffer[10], buffer[11]]) as usize;

        let mut fields = Vec::new();
        let mut current_offset = 1; // 1 byte for deletion flag

        let mut pos = 32;
        while pos < header_length && pos + 32 <= buffer.len() {
            if buffer[pos] == 0x0d {
                break;
            }

            let name_slice = &buffer[pos..pos + 11];
            let null_idx = name_slice.iter().position(|&b| b == 0).unwrap_or(name_slice.len());
            let name = String::from_utf8_lossy(&name_slice[..null_idx]).trim().to_string();

            let field_type = buffer[pos + 11] as char;
            let length = buffer[pos + 16] as usize;
            let decimal_count = buffer[pos + 17] as usize;

            fields.push(DbfField {
                name,
                field_type,
                length,
                decimal_count,
                offset: current_offset,
            });

            current_offset += length;
            pos += 32;
        }

        let mut rows = Vec::new();
        let mut rec_start = header_length;

        for i in 0..record_count {
            if rec_start + record_length > buffer.len() {
                break;
            }

            let deletion_flag = buffer[rec_start];
            let is_deleted = deletion_flag == 0x2a; // '*'

            if !is_deleted {
                let mut row = Map::new();
                row.insert("_rowId".into(), Value::Number((i + 1).into()));

                for f in &fields {
                    let field_start = rec_start + f.offset;
                    if field_start + f.length <= buffer.len() {
                        let raw_bytes = &buffer[field_start..field_start + f.length];
                        let raw_str = String::from_utf8_lossy(raw_bytes).trim().to_string();

                        let parsed_val = match f.field_type {
                            'N' | 'F' => {
                                if raw_str.is_empty() {
                                    Value::Null
                                } else if f.decimal_count > 0 {
                                    raw_str.parse::<f64>().ok().and_then(|num| serde_json::Number::from_f64(num).map(Value::Number)).unwrap_or(Value::Null)
                                } else {
                                    raw_str.parse::<i64>().ok().map(|num| Value::Number(num.into())).unwrap_or(Value::Null)
                                }
                            }
                            'D' => {
                                if raw_str.len() == 8 {
                                    let y = &raw_str[0..4];
                                    let m = &raw_str[4..6];
                                    let d = &raw_str[6..8];
                                    Value::String(format!("{}-{}-{}", y, m, d))
                                } else {
                                    Value::Null
                                }
                            }
                            'L' => {
                                let c = raw_str.chars().next().unwrap_or(' ');
                                Value::Bool(c == 'T' || c == 't' || c == 'Y' || c == 'y')
                            }
                            'I' => {
                                if field_start + 4 <= buffer.len() {
                                    let num = i32::from_le_bytes([
                                        buffer[field_start],
                                        buffer[field_start + 1],
                                        buffer[field_start + 2],
                                        buffer[field_start + 3],
                                    ]);
                                    Value::Number(num.into())
                                } else {
                                    Value::Null
                                }
                            }
                            _ => {
                                if raw_str.is_empty() {
                                    Value::Null
                                } else {
                                    Value::String(raw_str)
                                }
                            }
                        };
                        row.insert(f.name.clone(), parsed_val);
                    }
                }
                rows.push(row);
            }
            rec_start += record_length;
        }

        Ok(Self {
            file_path: path,
            db_name,
            fields,
            rows,
        })
    }

    pub fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let parent = self.file_path.parent().unwrap_or_else(|| Path::new("."));
        let mut tables = Vec::new();

        let main_name = self.file_path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_else(|| "TABLE".into());
        tables.push(TableInfo {
            name: main_name,
            schema: Some("dbf".into()),
            row_count: Some(self.rows.len() as i64),
            table_type: "table".into(),
        });

        if let Ok(entries) = std::fs::read_dir(parent) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p != self.file_path && p.extension().map(|e| e.to_string_lossy().to_lowercase()) == Some("dbf".into()) {
                    let name = p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
                    if !name.is_empty() {
                        tables.push(TableInfo {
                            name,
                            schema: Some("dbf".into()),
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
            col_type: match f.field_type {
                'C' => format!("CHAR({})", f.length),
                'N' => if f.decimal_count > 0 { format!("NUMERIC({},{})", f.length, f.decimal_count) } else { format!("INTEGER({})", f.length) },
                'D' => "DATE".into(),
                'L' => "LOGICAL".into(),
                'M' => "MEMO".into(),
                'I' => "INTEGER".into(),
                _ => "VARCHAR".into(),
            },
            nullable: true,
            is_primary_key: f.name.to_uppercase() == "ID" || f.name.to_uppercase() == "CODIGO",
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
