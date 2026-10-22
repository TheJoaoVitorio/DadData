use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;
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

        if let Ok(bytes) = fs::read(&self.file_path) {
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

        // Fast metadata read: read first 64KB (or full file if small)
        let file_meta = fs::metadata(path).map_err(|e| format!("Erro ao acessar .nx1 ({}): {}", table_name, e))?;
        let read_len = (file_meta.len() as usize).min(131072);

        let mut file = fs::File::open(path).map_err(|e| format!("Erro ao abrir .nx1 ({}): {}", table_name, e))?;
        use std::io::Read;
        let mut buffer = vec![0u8; read_len];
        file.read_exact(&mut buffer).map_err(|e| format!("Erro ao ler cabeçalho .nx1 ({}): {}", table_name, e))?;

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
            rows: None, // Lazy-loaded on demand
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
            .unwrap_or_else(|| buffer.len().min(pos + 8192));

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

    fn extract_wide_strings(body: &[u8]) -> Vec<String> {
        let mut result = Vec::new();
        let mut p = 0;
        while p + 3 < body.len() {
            if body[p + 1] == 0 && body[p + 3] == 0 && body[p] != 0 {
                let mut end = p;
                while end + 1 < body.len() && !(body[end] == 0 && body[end + 1] == 0) {
                    end += 2;
                }
                if end > p {
                    let slice = &body[p..end];
                    if let Some(s) = Self::decode_utf16le(slice) {
                        let trimmed = s.trim().to_string();
                        if !trimmed.is_empty() && trimmed.chars().any(|c| c.is_alphanumeric()) {
                            result.push(trimmed);
                            p = end + 2;
                            continue;
                        }
                    }
                }
            }
            p += 1;
        }
        result
    }

    fn extract_ascii_strings(body: &[u8]) -> Vec<String> {
        let mut result = Vec::new();
        let mut p = 0;
        while p < body.len() {
            if (32..=126).contains(&body[p]) {
                let start = p;
                while p < body.len() && (32..=126).contains(&body[p]) {
                    p += 1;
                }
                if p - start >= 2 {
                    let s = String::from_utf8_lossy(&body[start..p]).trim().to_string();
                    if s.chars().any(|c| c.is_alphanumeric()) {
                        result.push(s);
                    }
                }
            } else {
                p += 1;
            }
        }
        result
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

                let ws_list = Self::extract_wide_strings(rec_body);
                let ascii_list = Self::extract_ascii_strings(rec_body);

                let mut row = Map::new();
                let mut ws_idx = 0;
                let mut ascii_idx = 0;
                let mut id_assigned = false;

                for f in fields {
                    match f.type_name.as_str() {
                        "nxtWideString" | "nxtBlobWideMemo" => {
                            if ws_idx < ws_list.len() {
                                row.insert(f.name.clone(), Value::String(ws_list[ws_idx].clone()));
                                ws_idx += 1;
                            } else {
                                row.insert(f.name.clone(), Value::Null);
                            }
                        }
                        "nxtNullString" | "nxtShortString" | "nxtBlobMemo" => {
                            if ascii_idx < ascii_list.len() {
                                row.insert(f.name.clone(), Value::String(ascii_list[ascii_idx].clone()));
                                ascii_idx += 1;
                            } else {
                                row.insert(f.name.clone(), Value::Null);
                            }
                        }
                        "nxtAutoInc" | "nxtWord32" | "nxtInt32" => {
                            if !id_assigned && rec_body.len() >= 4 {
                                let val = u32::from_le_bytes([
                                    rec_body[0],
                                    rec_body[1],
                                    rec_body[2],
                                    rec_body[3],
                                ]);
                                if val > 0 && val < 10_000_000 {
                                    row.insert(f.name.clone(), Value::Number(val.into()));
                                    id_assigned = true;
                                } else {
                                    row.insert(f.name.clone(), Value::Null);
                                }
                            } else {
                                row.insert(f.name.clone(), Value::Null);
                            }
                        }
                        _ => {
                            row.insert(f.name.clone(), Value::Null);
                        }
                    }
                }

                // Only keep records that contain at least one meaningful non-null string or value
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

        assert!(table_names.contains(&"Cliente".to_string()));
        assert!(table_names.contains(&"Produto".to_string()));
        assert!(table_names.contains(&"Categoria".to_string()));

        // Check Cliente table columns and rows
        let cliente_cols = engine.describe_table("Cliente").expect("Should describe Cliente");
        assert!(cliente_cols.len() >= 40);
        let col_names: Vec<String> = cliente_cols.iter().map(|c| c.name.clone()).collect();
        assert!(col_names.contains(&"Nome".to_string()));
        assert!(col_names.contains(&"Endereco".to_string()));

        let page_cliente = engine.get_table_data("Cliente", 10, 0).expect("Should fetch Cliente data");
        assert_eq!(page_cliente.rows.len(), 10);
        assert!(page_cliente.total_count.unwrap() > 500);

        let first_cliente = &page_cliente.rows[0];
        println!("Cliente first row: {:?}", first_cliente);
        assert!(first_cliente.get("Nome").is_some());

        // Check Produto table columns and rows
        let prod_cols = engine.describe_table("Produto").expect("Should describe Produto");
        assert!(prod_cols.len() >= 80);

        let page_prod = engine.get_table_data("Produto", 5, 0).expect("Should fetch Produto data");
        assert_eq!(page_prod.rows.len(), 5);
        assert!(page_prod.total_count.unwrap() > 800);

        let first_prod = &page_prod.rows[0];
        println!("Produto first row: {:?}", first_prod);

        // Check Categoria table columns and rows
        let cat_cols = engine.describe_table("Categoria").expect("Should describe Categoria");
        assert!(cat_cols.len() >= 5);

        let page_cat = engine.get_table_data("Categoria", 5, 0).expect("Should fetch Categoria data");
        assert_eq!(page_cat.rows.len(), 5);
        assert!(page_cat.total_count.unwrap() >= 40);
    }

    #[test]
    fn test_nexusdb_open_single_file() {
        let test_dir = get_nexusdb_test_dir();
        let file_path = test_dir.join("Cliente.nx1");
        if !file_path.exists() {
            println!("Cliente.nx1 não encontrado, ignorando teste local.");
            return;
        }

        let engine = NexusDbEngine::open(file_path.to_str().unwrap()).expect("Should open NexusDB file");
        let tables = engine.list_tables().expect("Should list tables");
        let table_names: Vec<String> = tables.iter().map(|t| t.name.clone()).collect();
        assert!(table_names.contains(&"Cliente".to_string()));

        let page = engine.get_table_data("Cliente", 5, 0).expect("Should fetch data");
        assert_eq!(page.rows.len(), 5);
    }
}
