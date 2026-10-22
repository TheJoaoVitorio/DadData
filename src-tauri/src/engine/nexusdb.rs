use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;
#[cfg(windows)]
use std::os::windows::fs::OpenOptionsExt;
use serde_json::{Map, Value};
use crate::engine::types::*;

#[derive(Debug, Clone)]
pub struct NexusFieldDesc {
    pub name: String,
    pub type_name: String,
    pub col_type: String,
    pub is_primary_key: bool,
}

pub struct NexusTable {
    pub name: String,
    pub file_path: PathBuf,
    pub columns: Vec<ColumnInfo>,
    pub fields: Vec<NexusFieldDesc>,
    pub rows: Option<Vec<Map<String, Value>>>,
}

impl NexusTable {
    pub fn ensure_rows_loaded(&mut self) {
        if self.rows.is_some() {
            return;
        }

        if let Ok(bytes) = NexusDbEngine::read_file_shared(&self.file_path) {
            let extracted = NexusDbEngine::extract_records(&bytes, &self.fields);
            self.rows = Some(extracted);
        } else {
            self.rows = Some(Vec::new());
        }
    }

    pub fn row_count(&self) -> Option<i64> {
        self.rows.as_ref().map(|r| r.len() as i64)
    }
}

pub struct NexusDbEngine {
    pub file_path: PathBuf,
    pub db_name: String,
    pub tables: Mutex<HashMap<String, NexusTable>>,
}

impl NexusDbEngine {
    pub fn read_file_shared(path: &Path) -> std::io::Result<Vec<u8>> {
        use std::io::Read;
        let mut opts = OpenOptions::new();
        opts.read(true);
        #[cfg(windows)]
        opts.share_mode(7); // FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE
        let mut file = opts.open(path)?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;
        Ok(buffer)
    }

    pub fn read_header_shared(path: &Path, max_len: usize) -> std::io::Result<Vec<u8>> {
        use std::io::Read;
        let mut opts = OpenOptions::new();
        opts.read(true);
        #[cfg(windows)]
        opts.share_mode(7);
        let mut file = opts.open(path)?;
        let mut buffer = vec![0u8; max_len];
        let bytes_read = file.read(&mut buffer)?;
        buffer.truncate(bytes_read);
        Ok(buffer)
    }

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
                    if let Ok(tbl) = Self::parse_nx1_metadata(&p) {
                        table_map.insert(tbl.name.clone(), tbl);
                    }
                }
            }
        } else {
            let tbl = Self::parse_nx1_metadata(&path)?;
            let main_name = tbl.name.clone();
            table_map.insert(main_name, tbl);

            if let Some(parent) = path.parent() {
                if let Ok(entries) = fs::read_dir(parent) {
                    for entry in entries.flatten() {
                        let p = entry.path();
                        if p != path && p.is_file() && p.extension().map(|e| e.to_string_lossy().to_lowercase() == "nx1").unwrap_or(false) {
                            if let Ok(other_tbl) = Self::parse_nx1_metadata(&p) {
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

    fn parse_nx1_metadata(path: &Path) -> Result<NexusTable, String> {
        let table_name = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "table".into());

        let buffer = Self::read_header_shared(path, 131072)
            .map_err(|e| format!("Erro ao ler cabeçalho .nx1 ({}): {}", table_name, e))?;

        if buffer.len() < 32 || &buffer[0..4] != b"NX!2" {
            return Ok(NexusTable {
                name: table_name,
                file_path: path.to_path_buf(),
                columns: vec![],
                fields: vec![],
                rows: Some(vec![]),
            });
        }

        let fields = Self::extract_field_descriptors(&buffer);
        let columns: Vec<ColumnInfo> = fields.iter().map(|f| ColumnInfo {
            name: f.name.clone(),
            col_type: f.col_type.clone(),
            nullable: !f.is_primary_key,
            is_primary_key: f.is_primary_key,
        }).collect();

        Ok(NexusTable {
            name: table_name,
            file_path: path.to_path_buf(),
            columns,
            fields,
            rows: None, // Loaded on demand
        })
    }

    pub fn extract_field_descriptors(buffer: &[u8]) -> Vec<NexusFieldDesc> {
        let pos = match buffer.windows(16).position(|w| w == b"FieldsDescriptor") {
            Some(p) => p,
            None => return Vec::new(),
        };

        let end_pos = buffer[pos..].windows(17)
            .position(|w| w == b"IndicesDescriptor" || w == b"TablesDescriptor")
            .map(|p| pos + p)
            .unwrap_or_else(|| buffer.len().min(pos + 16384));

        let chunk = &buffer[pos..end_pos];
        let mut fields = Vec::new();
        let mut i = 0;

        while i < chunk.len() {
            let f_pos = match chunk[i..].windows(18).position(|w| w == b"TnxFieldDescriptor") {
                Some(p) => i + p,
                None => break,
            };

            let sl_end = chunk.len().min(f_pos + 120);
            let sl = &chunk[f_pos..sl_end];
            let mut sp = 0;
            let mut pstrings = Vec::new();

            while sp < sl.len() {
                let slen = sl[sp] as usize;
                if (1..=50).contains(&slen) && sp + 1 + slen <= sl.len() {
                    let cand = &sl[sp + 1..sp + 1 + slen];
                    if cand.iter().all(|&b| (32..=126).contains(&b)) {
                        if let Ok(s) = std::str::from_utf8(cand) {
                            pstrings.push(s.to_string());
                        }
                        sp += 1 + slen;
                        continue;
                    }
                }
                sp += 1;
            }

            if pstrings.len() >= 2 {
                let fname = pstrings[0].clone();
                let ftype = pstrings[1].clone();

                if !fname.starts_with("nxt") && ftype.starts_with("nxt") {
                    let is_pk = fname == "ID"
                        || fname == "UID"
                        || fname.ends_with("_ID")
                        || ftype == "nxtAutoInc";

                    let col_type = match ftype.as_str() {
                        "nxtAutoInc" => "INTEGER AUTOINC",
                        "nxtByte" | "nxtWord8" => "TINYINT",
                        "nxtWord16" | "nxtInt16" => "SMALLINT",
                        "nxtWord32" | "nxtInt32" => "INTEGER",
                        "nxtInt64" => "BIGINT",
                        "nxtSingle" => "FLOAT",
                        "nxtDouble" => "DOUBLE",
                        "nxtCurrency" => "DECIMAL(18,4)",
                        "nxtBoolean" => "BOOLEAN",
                        "nxtDate" => "DATE",
                        "nxtDateTime" | "nxtTimestamp" => "DATETIME",
                        "nxtGuid" => "UUID",
                        "nxtWideString" | "nxtBlobWideMemo" => "NVARCHAR",
                        "nxtNullString" | "nxtShortString" | "nxtBlobMemo" => "VARCHAR",
                        "nxtBlobGraphic" => "BLOB",
                        _ => "VARCHAR",
                    }.to_string();

                    fields.push(NexusFieldDesc {
                        name: fname,
                        type_name: ftype,
                        col_type,
                        is_primary_key: is_pk,
                    });
                }
            }

            i = f_pos + 18;
        }

        fields
    }

    fn decode_utf16le(bytes: &[u8]) -> Option<String> {
        if bytes.len() < 2 || bytes.len() % 2 != 0 {
            return None;
        }
        let u16_vec: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        String::from_utf16(&u16_vec).ok()
    }

    pub fn extract_records(buffer: &[u8], fields: &[NexusFieldDesc]) -> Vec<Map<String, Value>> {
        if fields.is_empty() || buffer.len() <= 4096 {
            return Vec::new();
        }

        let mut rows = Vec::new();
        let block_size = 4096;
        let num_blocks = buffer.len() / block_size;

        for b in 0..num_blocks {
            let b_off = b * block_size;
            if &buffer[b_off..b_off + 4] != b"NXHD" {
                continue;
            }

            let block = &buffer[b_off..b_off + block_size];
            let slot_count = u16::from_le_bytes([block[4096 - 6], block[4096 - 5]]) as usize;
            if slot_count == 0 || slot_count > 1000 {
                continue;
            }

            let slot_end = 4096usize - 6;
            let mut offsets = Vec::with_capacity(slot_count);
            for s in 0..slot_count {
                let p = slot_end.saturating_sub(2 * (s + 1));
                if p + 2 <= block.len() {
                    offsets.push(u16::from_le_bytes([block[p], block[p + 1]]) as usize);
                }
            }

            for (idx, &off) in offsets.iter().enumerate() {
                if !(20..=4090).contains(&off) {
                    continue;
                }

                let raw_len = u32::from_le_bytes([
                    block[off],
                    block[off + 1],
                    block[off + 2],
                    block[off + 3],
                ]) as usize;

                let mut rec_len = raw_len & 0x00FF_FFFF;
                if rec_len < 4 || off + rec_len > 4096 {
                    let next_off = if idx + 1 < slot_count && offsets[idx + 1] > off {
                        offsets[idx + 1]
                    } else {
                        slot_end.saturating_sub(slot_count * 2)
                    };
                    rec_len = next_off.saturating_sub(off);
                }

                if rec_len < 4 || off + rec_len > block.len() {
                    continue;
                }

                let rec_body = &block[off + 4..off + rec_len];
                if rec_body.len() < 4 {
                    continue;
                }

                // Detect prefix length (0, 4, 8, 12, 16) before ID/data fields
                let mut prefix = 0;
                let has_auto_inc = fields.first().map(|f| f.type_name == "nxtAutoInc").unwrap_or(false);
                if has_auto_inc {
                    for cand in [0, 4, 8, 12, 16] {
                        if cand + 4 <= rec_body.len() {
                            let val = u32::from_le_bytes([
                                rec_body[cand],
                                rec_body[cand + 1],
                                rec_body[cand + 2],
                                rec_body[cand + 3],
                            ]);
                            if val > 0 && val < 5_000_000 {
                                prefix = cand;
                                break;
                            }
                        }
                    }
                }

                let mut row = Map::new();
                let mut p = prefix;

                for f in fields {
                    if p >= rec_body.len() {
                        row.insert(f.name.clone(), Value::Null);
                        continue;
                    }

                    match f.type_name.as_str() {
                        "nxtAutoInc" | "nxtWord32" | "nxtInt32" => {
                            if p + 4 <= rec_body.len() {
                                let val = u32::from_le_bytes([
                                    rec_body[p],
                                    rec_body[p + 1],
                                    rec_body[p + 2],
                                    rec_body[p + 3],
                                ]);
                                p += 4;
                                row.insert(f.name.clone(), Value::Number(val.into()));
                            } else {
                                row.insert(f.name.clone(), Value::Null);
                            }
                        }
                        "nxtWord16" | "nxtInt16" => {
                            if p + 2 <= rec_body.len() {
                                let val = u16::from_le_bytes([rec_body[p], rec_body[p + 1]]);
                                p += 2;
                                row.insert(f.name.clone(), Value::Number(val.into()));
                            } else {
                                row.insert(f.name.clone(), Value::Null);
                            }
                        }
                        "nxtByte" | "nxtWord8" => {
                            let val = rec_body[p];
                            p += 1;
                            row.insert(f.name.clone(), Value::Number(val.into()));
                        }
                        "nxtBoolean" => {
                            let val = rec_body[p] != 0;
                            p += 1;
                            row.insert(f.name.clone(), Value::Bool(val));
                        }
                        "nxtInt64" => {
                            if p + 8 <= rec_body.len() {
                                let val = i64::from_le_bytes([
                                    rec_body[p], rec_body[p + 1], rec_body[p + 2], rec_body[p + 3],
                                    rec_body[p + 4], rec_body[p + 5], rec_body[p + 6], rec_body[p + 7],
                                ]);
                                p += 8;
                                row.insert(f.name.clone(), Value::Number(val.into()));
                            } else {
                                row.insert(f.name.clone(), Value::Null);
                            }
                        }
                        "nxtCurrency" => {
                            if p + 8 <= rec_body.len() {
                                let val = i64::from_le_bytes([
                                    rec_body[p], rec_body[p + 1], rec_body[p + 2], rec_body[p + 3],
                                    rec_body[p + 4], rec_body[p + 5], rec_body[p + 6], rec_body[p + 7],
                                ]);
                                p += 8;
                                let float_val = val as f64 / 10000.0;
                                if let Some(n) = serde_json::Number::from_f64(float_val) {
                                    row.insert(f.name.clone(), Value::Number(n));
                                } else {
                                    row.insert(f.name.clone(), Value::Null);
                                }
                            } else {
                                row.insert(f.name.clone(), Value::Null);
                            }
                        }
                        "nxtDouble" => {
                            if p + 8 <= rec_body.len() {
                                let val = f64::from_le_bytes([
                                    rec_body[p], rec_body[p + 1], rec_body[p + 2], rec_body[p + 3],
                                    rec_body[p + 4], rec_body[p + 5], rec_body[p + 6], rec_body[p + 7],
                                ]);
                                p += 8;
                                if val.is_finite() {
                                    if let Some(n) = serde_json::Number::from_f64(val) {
                                        row.insert(f.name.clone(), Value::Number(n));
                                    } else {
                                        row.insert(f.name.clone(), Value::Null);
                                    }
                                } else {
                                    row.insert(f.name.clone(), Value::Null);
                                }
                            } else {
                                row.insert(f.name.clone(), Value::Null);
                            }
                        }
                        "nxtSingle" => {
                            if p + 4 <= rec_body.len() {
                                let val = f32::from_le_bytes([
                                    rec_body[p], rec_body[p + 1], rec_body[p + 2], rec_body[p + 3],
                                ]);
                                p += 4;
                                if val.is_finite() {
                                    if let Some(n) = serde_json::Number::from_f64(val as f64) {
                                        row.insert(f.name.clone(), Value::Number(n));
                                    } else {
                                        row.insert(f.name.clone(), Value::Null);
                                    }
                                } else {
                                    row.insert(f.name.clone(), Value::Null);
                                }
                            } else {
                                row.insert(f.name.clone(), Value::Null);
                            }
                        }
                        "nxtGuid" => {
                            if p + 16 <= rec_body.len() {
                                let g = &rec_body[p..p + 16];
                                p += 16;
                                let uuid_str = format!(
                                    "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
                                    g[3], g[2], g[1], g[0],
                                    g[5], g[4],
                                    g[7], g[6],
                                    g[8], g[9],
                                    g[10], g[11], g[12], g[13], g[14], g[15]
                                );
                                row.insert(f.name.clone(), Value::String(uuid_str));
                            } else {
                                row.insert(f.name.clone(), Value::Null);
                            }
                        }
                        "nxtWideString" => {
                            let mut end = p;
                            while end + 1 < rec_body.len() && !(rec_body[end] == 0 && rec_body[end + 1] == 0) {
                                end += 2;
                            }
                            let s = Self::decode_utf16le(&rec_body[p..end]).unwrap_or_default().trim().to_string();
                            p = (end + 2).min(rec_body.len());
                            if s.is_empty() {
                                row.insert(f.name.clone(), Value::Null);
                            } else {
                                row.insert(f.name.clone(), Value::String(s));
                            }
                        }
                        "nxtNullString" | "nxtShortString" => {
                            let mut end = p;
                            while end < rec_body.len() && rec_body[end] != 0 {
                                end += 1;
                            }
                            let s = String::from_utf8_lossy(&rec_body[p..end]).trim().to_string();
                            p = (end + 1).min(rec_body.len());
                            if s.is_empty() {
                                row.insert(f.name.clone(), Value::Null);
                            } else {
                                row.insert(f.name.clone(), Value::String(s));
                            }
                        }
                        "nxtBlobWideMemo" | "nxtBlobMemo" | "nxtBlobGraphic" => {
                            p = (p + 8).min(rec_body.len());
                            row.insert(f.name.clone(), Value::Null);
                        }
                        "nxtDate" | "nxtDateTime" | "nxtTimestamp" => {
                            if p + 8 <= rec_body.len() {
                                let days_float = f64::from_le_bytes([
                                    rec_body[p], rec_body[p + 1], rec_body[p + 2], rec_body[p + 3],
                                    rec_body[p + 4], rec_body[p + 5], rec_body[p + 6], rec_body[p + 7],
                                ]);
                                p += 8;
                                if days_float > 1000.0 && days_float < 100000.0 {
                                    let days_int = days_float.floor() as i64;
                                    let ce_days = days_int + 693594;
                                    if let Some(date) = chrono::NaiveDate::from_num_days_from_ce_opt(ce_days as i32) {
                                        row.insert(f.name.clone(), Value::String(date.format("%Y-%m-%d").to_string()));
                                    } else {
                                        row.insert(f.name.clone(), Value::Null);
                                    }
                                } else {
                                    row.insert(f.name.clone(), Value::Null);
                                }
                            } else {
                                p = (p + 8).min(rec_body.len());
                                row.insert(f.name.clone(), Value::Null);
                            }
                        }
                        _ => {
                            p = (p + 4).min(rec_body.len());
                            row.insert(f.name.clone(), Value::Null);
                        }
                    }
                }

                // Retain row if it has at least one meaningful non-null string, number, or boolean
                if row.values().any(|v| !v.is_null()) {
                    rows.push(row);
                }
            }
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
                row_count: tbl.row_count(),
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
        for (k, v) in tables.iter() {
            if k.eq_ignore_ascii_case(table_name) {
                return Ok(v.columns.clone());
            }
        }
        Err(format!("Tabela NexusDB '{}' não encontrada", table_name))
    }

    pub fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let start = Instant::now();
        let mut tables = self.tables.lock().map_err(|e| e.to_string())?;

        let clean = sql.trim();
        let target_name = clean
            .split_whitespace()
            .skip_while(|w| !w.eq_ignore_ascii_case("FROM"))
            .nth(1)
            .map(|s| s.trim_matches(|c| c == '"' || c == '\'' || c == '`' || c == '[' || c == ']').to_string());

        let target_key = match target_name {
            Some(ref name) => {
                if tables.contains_key(name) {
                    Some(name.clone())
                } else {
                    tables.keys().find(|k| k.eq_ignore_ascii_case(name)).cloned()
                        .or_else(|| tables.keys().next().cloned())
                }
            }
            None => tables.keys().next().cloned(),
        }.ok_or_else(|| "Nenhuma tabela NexusDB disponível".to_string())?;

        let tbl = tables.get_mut(&target_key).unwrap();
        tbl.ensure_rows_loaded();

        let columns: Vec<String> = tbl.columns.iter().map(|c| c.name.clone()).collect();
        let raw_rows = tbl.rows.as_ref().unwrap();
        let rows: Vec<Value> = raw_rows.iter().map(|m| Value::Object(m.clone())).collect();
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
        let mut tables = self.tables.lock().map_err(|e| e.to_string())?;

        let target_key = if tables.contains_key(table_name) {
            Some(table_name.to_string())
        } else {
            tables.keys().find(|k| k.eq_ignore_ascii_case(table_name)).cloned()
                .or_else(|| tables.keys().next().cloned())
        }.ok_or_else(|| format!("Tabela '{}' não encontrada", table_name))?;

        let tbl = tables.get_mut(&target_key).unwrap();
        tbl.ensure_rows_loaded();

        let columns: Vec<String> = tbl.columns.iter().map(|c| c.name.clone()).collect();
        let raw_rows = tbl.rows.as_ref().unwrap();
        let total = raw_rows.len();
        let sliced: Vec<Value> = raw_rows.iter().skip(offset).take(limit).map(|m| Value::Object(m.clone())).collect();
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
        let target_key = if tables.contains_key(table_name) {
            Some(table_name.to_string())
        } else {
            tables.keys().find(|k| k.eq_ignore_ascii_case(table_name)).cloned()
        };

        let tbl = target_key
            .and_then(|k| tables.get_mut(&k))
            .ok_or_else(|| format!("Tabela '{}' não encontrada", table_name))?;

        tbl.ensure_rows_loaded();
        let rows = tbl.rows.as_mut().unwrap();
        rows.push(data.clone());

        Ok(MutationResult {
            success: true,
            affected_rows: 1,
            inserted_id: Some(rows.len().to_string()),
            error: None,
        })
    }

    pub fn update_row(&self, table_name: &str, pk: &Map<String, Value>, changes: &Map<String, Value>) -> Result<MutationResult, String> {
        let mut tables = self.tables.lock().map_err(|e| e.to_string())?;
        let target_key = if tables.contains_key(table_name) {
            Some(table_name.to_string())
        } else {
            tables.keys().find(|k| k.eq_ignore_ascii_case(table_name)).cloned()
        };

        let tbl = target_key
            .and_then(|k| tables.get_mut(&k))
            .ok_or_else(|| format!("Tabela '{}' não encontrada", table_name))?;

        tbl.ensure_rows_loaded();
        let rows = tbl.rows.as_mut().unwrap();

        let mut updated = 0;
        for row in rows.iter_mut() {
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
        let target_key = if tables.contains_key(table_name) {
            Some(table_name.to_string())
        } else {
            tables.keys().find(|k| k.eq_ignore_ascii_case(table_name)).cloned()
        };

        let tbl = target_key
            .and_then(|k| tables.get_mut(&k))
            .ok_or_else(|| format!("Tabela '{}' não encontrada", table_name))?;

        tbl.ensure_rows_loaded();
        let rows = tbl.rows.as_mut().unwrap();

        let initial_len = rows.len();
        rows.retain(|row| {
            !pk.iter().all(|(k, v)| row.get(k) == Some(v))
        });
        let deleted = initial_len - rows.len();

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

    fn get_nexusdb_test_dir() -> PathBuf {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir.join("../db_test/NexusDB")
    }

    #[test]
    fn test_nexusdb_open_directory_and_introspect() {
        let test_dir = get_nexusdb_test_dir();
        if !test_dir.exists() {
            println!("db_test/NexusDB não encontrado, ignorando teste local.");
            return;
        }

        let engine = NexusDbEngine::open(test_dir.to_str().unwrap()).expect("Should open NexusDB directory");
        let tables = engine.list_tables().expect("Should list tables");

        let table_names: Vec<String> = tables.iter().map(|t| t.name.clone()).collect();
        println!("Discovered NexusDB tables ({}): {:?}", table_names.len(), &table_names[..table_names.len().min(15)]);

        assert!(table_names.contains(&"Categoria".to_string()));
        assert!(table_names.contains(&"Caixa".to_string()));

        // Check Categoria table columns and rows
        let cat_cols = engine.describe_table("Categoria").expect("Should describe Categoria");
        assert!(cat_cols.len() >= 5);

        let page_cat = engine.get_table_data("Categoria", 5, 0).expect("Should fetch Categoria data");
        assert_eq!(page_cat.rows.len(), 5);
        assert!(page_cat.total_count.unwrap() >= 40);

        println!("Categoria first 5 rows:");
        for r in &page_cat.rows {
            println!("  {:?}", r);
        }

        // Check Caixa table columns and rows
        let caixa_cols = engine.describe_table("Caixa").expect("Should describe Caixa");
        assert!(caixa_cols.len() >= 25);

        let page_caixa = engine.get_table_data("Caixa", 5, 0).expect("Should fetch Caixa data");
        assert_eq!(page_caixa.rows.len(), 5);
        assert!(page_caixa.total_count.unwrap() >= 1000);

        println!("Caixa first row: {:?}", page_caixa.rows[0]);
    }

    #[test]
    fn test_nexusdb_open_single_file() {
        let test_dir = get_nexusdb_test_dir();
        let file_path = test_dir.join("Categoria.nx1");
        if !file_path.exists() {
            println!("Categoria.nx1 não encontrado, ignorando teste local.");
            return;
        }

        let engine = NexusDbEngine::open(file_path.to_str().unwrap()).expect("Should open NexusDB file");
        let tables = engine.list_tables().expect("Should list tables");
        let table_names: Vec<String> = tables.iter().map(|t| t.name.clone()).collect();
        assert!(table_names.contains(&"Categoria".to_string()));

        let page = engine.get_table_data("Categoria", 5, 0).expect("Should fetch data");
        assert_eq!(page.rows.len(), 5);
    }
}
