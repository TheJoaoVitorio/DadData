use std::time::Instant;
use serde_json::{Map, Value};
use crate::engine::types::*;

/// Identifies the SQL statement type (SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, etc.)
pub fn get_statement_type(sql: &str) -> &'static str {
    let clean = sql.trim();
    let first_word = clean
        .split(|c: char| c.is_whitespace() || c == '(' || c == ';')
        .find(|s| !s.is_empty())
        .map(|s| s.to_ascii_uppercase())
        .unwrap_or_default();

    match first_word.as_str() {
        "SELECT" | "WITH" => "SELECT",
        "INSERT" => "INSERT",
        "UPDATE" => "UPDATE",
        "DELETE" => "DELETE",
        "CREATE" => "CREATE",
        "DROP" => "DROP",
        "ALTER" => "ALTER",
        "TRUNCATE" => "TRUNCATE",
        "SHOW" => "SHOW",
        "DESCRIBE" | "DESC" => "DESCRIBE",
        "PRAGMA" => "PRAGMA",
        _ => "OTHER",
    }
}

/// Strips enclosing quotes (', ", `, [ ]) from an identifier
pub fn strip_identifier(s: &str) -> &str {
    let trimmed = s.trim();
    if (trimmed.starts_with('\'') && trimmed.ends_with('\''))
        || (trimmed.starts_with('"') && trimmed.ends_with('"'))
        || (trimmed.starts_with('`') && trimmed.ends_with('`'))
    {
        if trimmed.len() >= 2 {
            &trimmed[1..trimmed.len() - 1]
        } else {
            trimmed
        }
    } else if trimmed.starts_with('[') && trimmed.ends_with(']') {
        if trimmed.len() >= 2 {
            &trimmed[1..trimmed.len() - 1]
        } else {
            trimmed
        }
    } else {
        trimmed
    }
}

/// Parses a string token into a serde_json::Value (handles strings with quotes, numbers, bools, null)
pub fn parse_literal_value(raw: &str) -> Value {
    let s = raw.trim();
    if s.is_empty() {
        return Value::Null;
    }
    if s.eq_ignore_ascii_case("NULL") {
        return Value::Null;
    }
    if s.eq_ignore_ascii_case("TRUE") {
        return Value::Bool(true);
    }
    if s.eq_ignore_ascii_case("FALSE") {
        return Value::Bool(false);
    }
    // Quoted string '...' or "..."
    if (s.starts_with('\'') && s.ends_with('\'')) || (s.starts_with('"') && s.ends_with('"')) {
        if s.len() >= 2 {
            return Value::String(s[1..s.len() - 1].replace("''", "'"));
        }
        return Value::String("".into());
    }
    // Number (integer or float)
    if let Ok(i) = s.parse::<i64>() {
        return Value::Number(i.into());
    }
    if let Ok(f) = s.parse::<f64>() {
        if let Some(num) = serde_json::Number::from_f64(f) {
            return Value::Number(num);
        }
    }
    // Fallback: unquoted string
    Value::String(s.to_string())
}

/// Evaluates a simple WHERE clause against a row
/// Supports: col = val, col != val, col <> val, col > val, col < val, col >= val, col <= val, col LIKE 'val'
pub fn matches_where_clause(row: &Map<String, Value>, where_clause: &str) -> bool {
    let trimmed = where_clause.trim();
    if trimmed.is_empty() {
        return true;
    }

    // Split multiple conditions by AND
    let conditions = trimmed.split(" AND ");
    for cond in conditions {
        let cond_trim = cond.trim();
        if cond_trim.is_empty() {
            continue;
        }

        // Try operators: >=, <=, !=, <>, =, >, <, LIKE, ILIKE
        let op_info = if let Some(idx) = cond_trim.find(">=") {
            Some((idx, 2, ">="))
        } else if let Some(idx) = cond_trim.find("<=") {
            Some((idx, 2, "<="))
        } else if let Some(idx) = cond_trim.find("!=") {
            Some((idx, 2, "!="))
        } else if let Some(idx) = cond_trim.find("<>") {
            Some((idx, 2, "<>"))
        } else if let Some(idx) = cond_trim.to_uppercase().find(" ILIKE ") {
            Some((idx, 7, "ILIKE"))
        } else if let Some(idx) = cond_trim.to_uppercase().find(" LIKE ") {
            Some((idx, 6, "LIKE"))
        } else if let Some(idx) = cond_trim.find('=') {
            Some((idx, 1, "="))
        } else if let Some(idx) = cond_trim.find('>') {
            Some((idx, 1, ">"))
        } else if let Some(idx) = cond_trim.find('<') {
            Some((idx, 1, "<"))
        } else {
            None
        };

        if let Some((idx, op_len, op)) = op_info {
            let left_col = strip_identifier(&cond_trim[..idx]);
            let right_val_raw = cond_trim[idx + op_len..].trim();
            let target_val = parse_literal_value(right_val_raw);

            // Find matching column in row (case-insensitive)
            let actual_val = row
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(left_col))
                .map(|(_, v)| v)
                .unwrap_or(&Value::Null);

            let matched = match op {
                "=" => values_equal(actual_val, &target_val),
                "!=" | "<>" => !values_equal(actual_val, &target_val),
                "LIKE" | "ILIKE" => {
                    let act_str = val_to_str(actual_val);
                    let pat_str = val_to_str(&target_val);
                    like_match(&act_str, &pat_str, op == "ILIKE")
                }
                ">" => compare_values(actual_val, &target_val) > 0,
                "<" => compare_values(actual_val, &target_val) < 0,
                ">=" => compare_values(actual_val, &target_val) >= 0,
                "<=" => compare_values(actual_val, &target_val) <= 0,
                _ => true,
            };

            if !matched {
                return false;
            }
        }
    }

    true
}

fn values_equal(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Null, Value::Null) => true,
        (Value::Bool(x), Value::Bool(y)) => x == y,
        (Value::Number(x), Value::Number(y)) => x.as_f64() == y.as_f64(),
        (Value::String(x), Value::String(y)) => x == y,
        (Value::String(x), Value::Number(y)) => x == &y.to_string(),
        (Value::Number(x), Value::String(y)) => &x.to_string() == y,
        _ => false,
    }
}

fn compare_values(a: &Value, b: &Value) -> i8 {
    if let (Some(x), Some(y)) = (a.as_f64(), b.as_f64()) {
        if x < y {
            -1
        } else if x > y {
            1
        } else {
            0
        }
    } else {
        let sx = val_to_str(a);
        let sy = val_to_str(b);
        sx.cmp(&sy) as i8
    }
}

fn val_to_str(v: &Value) -> String {
    match v {
        Value::Null => "".into(),
        Value::Bool(b) => if *b { "true".into() } else { "false".into() },
        Value::Number(n) => n.to_string(),
        Value::String(s) => s.clone(),
        _ => v.to_string(),
    }
}

fn like_match(haystack: &str, pattern: &str, case_insensitive: bool) -> bool {
    let (h, p) = if case_insensitive {
        (haystack.to_lowercase(), pattern.to_lowercase())
    } else {
        (haystack.to_string(), pattern.to_string())
    };

    let p_clean = p.trim_matches('\'').trim_matches('"');
    if p_clean == "%" {
        return true;
    }
    if p_clean.starts_with('%') && p_clean.ends_with('%') && p_clean.len() >= 2 {
        let sub = &p_clean[1..p_clean.len() - 1];
        return h.contains(sub);
    }
    if p_clean.starts_with('%') {
        let sub = &p_clean[1..];
        return h.ends_with(sub);
    }
    if p_clean.ends_with('%') {
        let sub = &p_clean[..p_clean.len() - 1];
        return h.starts_with(sub);
    }
    h == p_clean
}

/// Extracts table name from a SQL query
pub fn extract_target_table(sql: &str) -> Option<String> {
    let clean = sql.trim();
    let upper = clean.to_ascii_uppercase();

    if let Some(idx) = upper.find(" FROM ") {
        let rest = &clean[idx + 6..].trim();
        let name = rest
            .split_whitespace()
            .next()
            .map(|s| s.trim_end_matches(';'))
            .map(strip_identifier);
        return name.map(|s| s.to_string());
    }

    if let Some(idx) = upper.find(" INTO ") {
        let rest = &clean[idx + 6..].trim();
        let name = rest
            .split(|c: char| c.is_whitespace() || c == '(')
            .find(|s| !s.is_empty())
            .map(strip_identifier);
        return name.map(|s| s.to_string());
    }

    if upper.starts_with("UPDATE ") {
        let rest = &clean[7..].trim();
        let name = rest
            .split(|c: char| c.is_whitespace() || c == ';')
            .find(|s| !s.is_empty())
            .map(strip_identifier);
        return name.map(|s| s.to_string());
    }

    None
}

/// Executes an in-memory SELECT operation on a table's rows
pub fn execute_select(
    table_columns: &[String],
    table_rows: &[Map<String, Value>],
    sql: &str,
    start: Instant,
) -> Result<QueryResult, String> {
    let clean = sql.trim();
    let upper = clean.to_ascii_uppercase();

    // 1. Extract projected columns between SELECT and FROM
    let select_part = if let Some(from_idx) = upper.find(" FROM ") {
        &clean[6..from_idx].trim()
    } else {
        "*"
    };

    let projected_columns: Vec<String> = if select_part == "*" {
        table_columns.to_vec()
    } else {
        select_part
            .split(',')
            .map(|c| strip_identifier(c.trim()).to_string())
            .collect()
    };

    // 2. Extract WHERE clause
    let mut where_clause = "";
    if let Some(w_idx) = upper.find(" WHERE ") {
        let after_where = &clean[w_idx + 7..];
        // Stop before ORDER BY, GROUP BY, LIMIT
        let end_idx = [" ORDER BY ", " GROUP BY ", " LIMIT ", ";"]
            .iter()
            .filter_map(|kw| after_where.to_ascii_uppercase().find(kw))
            .min()
            .unwrap_or(after_where.len());
        where_clause = &after_where[..end_idx].trim();
    }

    // 3. Extract LIMIT / OFFSET
    let mut limit: Option<usize> = None;
    let mut offset: Option<usize> = None;

    if let Some(l_idx) = upper.find(" LIMIT ") {
        let after_limit = &clean[l_idx + 7..].trim_end_matches(';').trim();
        let parts: Vec<&str> = after_limit.split_whitespace().collect();
        if let Some(num_str) = parts.first() {
            if let Ok(l) = num_str.parse::<usize>() {
                limit = Some(l);
            }
        }
        if let Some(off_idx) = after_limit.to_ascii_uppercase().find("OFFSET ") {
            let off_str = &after_limit[off_idx + 7..].trim();
            if let Ok(o) = off_str.parse::<usize>() {
                offset = Some(o);
            }
        }
    }

    // 4. Filter matching rows
    let mut filtered_rows: Vec<Map<String, Value>> = table_rows
        .iter()
        .filter(|row| matches_where_clause(row, where_clause))
        .map(|row| {
            if select_part == "*" {
                row.clone()
            } else {
                let mut projected = Map::new();
                for col in &projected_columns {
                    // Match case-insensitive
                    let val = row
                        .iter()
                        .find(|(k, _)| k.eq_ignore_ascii_case(col))
                        .map(|(_, v)| v.clone())
                        .unwrap_or(Value::Null);
                    projected.insert(col.clone(), val);
                }
                projected
            }
        })
        .collect();

    // 5. Apply pagination (OFFSET and LIMIT)
    let total_count = filtered_rows.len();
    let off = offset.unwrap_or(0);
    if off > 0 {
        if off < filtered_rows.len() {
            filtered_rows.drain(..off);
        } else {
            filtered_rows.clear();
        }
    }
    let has_more = if let Some(lim) = limit {
        if filtered_rows.len() > lim {
            filtered_rows.truncate(lim);
            true
        } else {
            false
        }
    } else {
        false
    };

    let execution_time_ms = start.elapsed().as_millis();
    let row_count = filtered_rows.len();

    Ok(QueryResult {
        columns: projected_columns,
        rows: filtered_rows.into_iter().map(Value::Object).collect(),
        row_count,
        total_count: Some(total_count as i64),
        has_more,
        execution_time_ms,
        statement_type: Some("SELECT".into()),
        offset,
        limit,
    })
}

/// Executes an INSERT statement on a given table's rows
/// Syntax: INSERT INTO <table> [(col1, col2)] VALUES (val1, val2)
pub fn execute_insert(
    table_columns: &[String],
    table_rows: &mut Vec<Map<String, Value>>,
    sql: &str,
    start: Instant,
) -> Result<QueryResult, String> {
    let clean = sql.trim();
    let upper = clean.to_ascii_uppercase();

    let values_idx = upper.find(" VALUES").ok_or_else(|| {
        "Cláusula 'VALUES' não encontrada no comando INSERT".to_string()
    })?;

    // Extract columns if present: INSERT INTO tbl (a, b) VALUES ...
    let before_values = &clean[..values_idx].trim();
    let target_columns = if let (Some(open), Some(close)) = (before_values.find('('), before_values.rfind(')')) {
        let inside = &before_values[open + 1..close];
        inside.split(',').map(|c| strip_identifier(c.trim()).to_string()).collect()
    } else {
        table_columns.to_vec()
    };

    // Extract values inside (...)
    let after_values = &clean[values_idx + 7..].trim();
    let val_open = after_values.find('(').ok_or_else(|| "Parêntese de abertura '(' não encontrado em VALUES".to_string())?;
    let val_close = after_values.rfind(')').ok_or_else(|| "Parêntese de fechamento ')' não encontrado em VALUES".to_string())?;
    let val_str = &after_values[val_open + 1..val_close];

    let raw_values = split_sql_csv(val_str);

    let mut new_row = Map::new();
    for col in table_columns {
        new_row.insert(col.clone(), Value::Null);
    }

    for (idx, col_name) in target_columns.iter().enumerate() {
        if idx < raw_values.len() {
            let parsed = parse_literal_value(&raw_values[idx]);
            // Match case-insensitively with table column
            if let Some(existing_key) = new_row.keys().find(|k| k.eq_ignore_ascii_case(col_name)).cloned() {
                new_row.insert(existing_key, parsed);
            } else {
                new_row.insert(col_name.clone(), parsed);
            }
        }
    }

    table_rows.push(new_row);
    let execution_time_ms = start.elapsed().as_millis();

    Ok(QueryResult {
        columns: vec!["AFFECTED_ROWS".into()],
        rows: vec![serde_json::json!({ "AFFECTED_ROWS": 1 })],
        row_count: 1,
        total_count: Some(1),
        has_more: false,
        execution_time_ms,
        statement_type: Some("INSERT".into()),
        offset: None,
        limit: None,
    })
}

/// Executes an UPDATE statement on a given table's rows
/// Syntax: UPDATE <table> SET col1 = val1, col2 = val2 [WHERE condition]
pub fn execute_update(
    table_rows: &mut [Map<String, Value>],
    sql: &str,
    start: Instant,
) -> Result<QueryResult, String> {
    let clean = sql.trim();
    let upper = clean.to_ascii_uppercase();

    let set_idx = upper.find(" SET ").ok_or_else(|| {
        "Cláusula 'SET' não encontrada no comando UPDATE".to_string()
    })?;

    let where_idx = upper.find(" WHERE ");
    let set_part = match where_idx {
        Some(w) => &clean[set_idx + 5..w].trim(),
        None => &clean[set_idx + 5..].trim_end_matches(';').trim(),
    };

    let where_part = where_idx.map(|w| clean[w + 7..].trim_end_matches(';').trim()).unwrap_or("");

    // Parse SET assignments: col1 = val1, col2 = val2
    let assignments_raw = split_sql_csv(set_part);
    let mut assignments = Vec::new();
    for assign in assignments_raw {
        if let Some(eq_pos) = assign.find('=') {
            let col = strip_identifier(&assign[..eq_pos]).to_string();
            let val = parse_literal_value(&assign[eq_pos + 1..]);
            assignments.push((col, val));
        }
    }

    let mut affected = 0;
    for row in table_rows.iter_mut() {
        if matches_where_clause(row, where_part) {
            for (col, val) in &assignments {
                if let Some(k) = row.keys().find(|k| k.eq_ignore_ascii_case(col)).cloned() {
                    row.insert(k, val.clone());
                } else {
                    row.insert(col.clone(), val.clone());
                }
            }
            affected += 1;
        }
    }

    let execution_time_ms = start.elapsed().as_millis();
    Ok(QueryResult {
        columns: vec!["AFFECTED_ROWS".into()],
        rows: vec![serde_json::json!({ "AFFECTED_ROWS": affected })],
        row_count: affected,
        total_count: Some(affected as i64),
        has_more: false,
        execution_time_ms,
        statement_type: Some("UPDATE".into()),
        offset: None,
        limit: None,
    })
}

/// Executes a DELETE statement on a given table's rows
/// Syntax: DELETE FROM <table> [WHERE condition]
pub fn execute_delete(
    table_rows: &mut Vec<Map<String, Value>>,
    sql: &str,
    start: Instant,
) -> Result<QueryResult, String> {
    let clean = sql.trim();
    let upper = clean.to_ascii_uppercase();

    let where_part = if let Some(w_idx) = upper.find(" WHERE ") {
        &clean[w_idx + 7..].trim()
    } else {
        ""
    };

    let initial_count = table_rows.len();
    table_rows.retain(|row| !matches_where_clause(row, where_part));
    let affected = initial_count - table_rows.len();

    let execution_time_ms = start.elapsed().as_millis();
    Ok(QueryResult {
        columns: vec!["AFFECTED_ROWS".into()],
        rows: vec![serde_json::json!({ "AFFECTED_ROWS": affected })],
        row_count: affected,
        total_count: Some(affected as i64),
        has_more: false,
        execution_time_ms,
        statement_type: Some("DELETE".into()),
        offset: None,
        limit: None,
    })
}

/// Splits comma-separated values in an SQL statement while ignoring commas inside single or double quotes
fn split_sql_csv(input: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_single_quote = false;
    let mut in_double_quote = false;

    for ch in input.chars() {
        match ch {
            '\'' if !in_double_quote => {
                in_single_quote = !in_single_quote;
                current.push(ch);
            }
            '"' if !in_single_quote => {
                in_double_quote = !in_double_quote;
                current.push(ch);
            }
            ',' if !in_single_quote && !in_double_quote => {
                result.push(current.trim().to_string());
                current.clear();
            }
            _ => {
                current.push(ch);
            }
        }
    }
    if !current.trim().is_empty() {
        result.push(current.trim().to_string());
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_statement_type() {
        assert_eq!(get_statement_type("SELECT * FROM tab"), "SELECT");
        assert_eq!(get_statement_type("INSERT INTO tab VALUES (1)"), "INSERT");
        assert_eq!(get_statement_type("UPDATE tab SET x = 1"), "UPDATE");
        assert_eq!(get_statement_type("DELETE FROM tab WHERE id = 1"), "DELETE");
    }

    #[test]
    fn test_extract_target_table() {
        assert_eq!(extract_target_table("SELECT * FROM \"Clientes\" WHERE id = 1").unwrap(), "Clientes");
        assert_eq!(extract_target_table("INSERT INTO [TabCli] (Codigo) VALUES ('01')").unwrap(), "TabCli");
        assert_eq!(extract_target_table("UPDATE `Produtos` SET preco = 10").unwrap(), "Produtos");
        assert_eq!(extract_target_table("DELETE FROM Clientes WHERE id = 5").unwrap(), "Clientes");
    }

    #[test]
    fn test_crud_flow_in_memory() {
        let cols = vec!["id".to_string(), "nome".to_string(), "cidade".to_string()];
        let mut rows: Vec<Map<String, Value>> = Vec::new();

        // 1. INSERT
        let insert_sql = "INSERT INTO Clientes (id, nome, cidade) VALUES (1, 'Empresa Alfa', 'São Paulo')";
        let res_ins = execute_insert(&cols, &mut rows, insert_sql, Instant::now()).unwrap();
        assert_eq!(res_ins.statement_type.as_deref(), Some("INSERT"));
        assert_eq!(rows.len(), 1);

        // 2. SELECT
        let select_sql = "SELECT id, nome FROM Clientes WHERE cidade = 'São Paulo'";
        let res_sel = execute_select(&cols, &rows, select_sql, Instant::now()).unwrap();
        assert_eq!(res_sel.row_count, 1);
        assert_eq!(res_sel.rows[0].get("nome"), Some(&Value::String("Empresa Alfa".into())));

        // 3. UPDATE
        let update_sql = "UPDATE Clientes SET nome = 'Alfa Atualizada' WHERE id = 1";
        let res_upd = execute_update(&mut rows, update_sql, Instant::now()).unwrap();
        assert_eq!(res_upd.row_count, 1);
        assert_eq!(rows[0].get("nome"), Some(&Value::String("Alfa Atualizada".into())));

        // 4. DELETE
        let delete_sql = "DELETE FROM Clientes WHERE id = 1";
        let res_del = execute_delete(&mut rows, delete_sql, Instant::now()).unwrap();
        assert_eq!(res_del.row_count, 1);
        assert_eq!(rows.len(), 0);
    }
}
