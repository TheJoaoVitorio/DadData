use rust_xlsxwriter::{Format, Workbook, XlsxColor};
use serde_json::Value;

pub fn export_to_csv(
    file_path: &str,
    columns: &[String],
    rows: &[Value],
) -> Result<usize, String> {
    let mut writer = csv::WriterBuilder::new()
        .delimiter(b';')
        .from_path(file_path)
        .map_err(|e| format!("Erro ao criar arquivo CSV: {}", e))?;

    writer.write_record(columns).map_err(|e| format!("Erro ao escrever cabeçalho CSV: {}", e))?;

    let mut count = 0;
    for row in rows {
        let mut record = Vec::with_capacity(columns.len());
        if let Some(map) = row.as_object() {
            for col in columns {
                let cell_val = match map.get(col) {
                    Some(Value::Null) | None => String::new(),
                    Some(Value::String(s)) => s.clone(),
                    Some(Value::Number(n)) => n.to_string(),
                    Some(Value::Bool(b)) => if *b { "TRUE".into() } else { "FALSE".into() },
                    Some(other) => other.to_string(),
                };
                record.push(cell_val);
            }
        }
        writer.write_record(&record).map_err(|e| format!("Erro ao escrever linha CSV: {}", e))?;
        count += 1;
    }

    writer.flush().map_err(|e| format!("Erro ao salvar CSV: {}", e))?;
    Ok(count)
}

pub fn export_to_excel(
    file_path: &str,
    sheet_name: Option<&str>,
    columns: &[String],
    rows: &[Value],
) -> Result<usize, String> {
    let mut workbook = Workbook::new(file_path);
    let clean_sheet_name = sheet_name.unwrap_or("Dados")
        .chars()
        .filter(|c| !['*', ':', '/', '\\', '?', '[', ']'].contains(c))
        .take(31)
        .collect::<String>();

    let worksheet = workbook.add_worksheet();
    let _ = worksheet.set_name(if clean_sheet_name.is_empty() { "Dados" } else { &clean_sheet_name });

    let default_format = Format::new();

    // Header formatting
    let header_format = Format::new()
        .set_bold()
        .set_background_color(XlsxColor::RGB(0xFACC15)) // AbacatePay yellow
        .set_font_color(XlsxColor::RGB(0x18181B));

    // Write headers
    for (col_idx, col_name) in columns.iter().enumerate() {
        worksheet
            .write_string(0, col_idx as u16, col_name, &header_format)
            .map_err(|e| format!("Erro ao escrever cabeçalho Excel: {}", e))?;
    }

    let mut row_count = 0;
    for (row_idx, row) in rows.iter().enumerate() {
        let r_num = (row_idx + 1) as u32;
        if let Some(map) = row.as_object() {
            for (col_idx, col_name) in columns.iter().enumerate() {
                let c_num = col_idx as u16;
                match map.get(col_name) {
                    Some(Value::Null) | None => {
                        let _ = worksheet.write_blank(r_num, c_num, &default_format);
                    }
                    Some(Value::Number(n)) => {
                        if let Some(f) = n.as_f64() {
                            let _ = worksheet.write_number(r_num, c_num, f, &default_format);
                        } else if let Some(i) = n.as_i64() {
                            let _ = worksheet.write_number(r_num, c_num, i as f64, &default_format);
                        }
                    }
                    Some(Value::Bool(b)) => {
                        let _ = worksheet.write_boolean(r_num, c_num, *b, &default_format);
                    }
                    Some(Value::String(s)) => {
                        let _ = worksheet.write_string(r_num, c_num, s, &default_format);
                    }
                    Some(other) => {
                        let _ = worksheet.write_string(r_num, c_num, &other.to_string(), &default_format);
                    }
                }
            }
        }
        row_count += 1;
    }

    workbook.close().map_err(|e| format!("Erro ao salvar arquivo XLSX: {}", e))?;
    Ok(row_count)
}
