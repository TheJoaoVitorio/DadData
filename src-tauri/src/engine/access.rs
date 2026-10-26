use std::io::{BufRead, BufReader, Write, BufWriter};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;
use std::time::Instant;
use serde_json::{json, Map, Value};
use crate::engine::types::*;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const ACCESS_WORKER_SCRIPT: &str = r#"
param([string]$dbPath, [string]$password)

$ErrorActionPreference = 'Stop'

# Ensure UTF-8 I/O
$inStream = [System.Console]::OpenStandardInput()
$reader = New-Object System.IO.StreamReader($inStream, [System.Text.Encoding]::UTF8)
$outStream = [System.Console]::OpenStandardOutput()
$writer = New-Object System.IO.StreamWriter($outStream, [System.Text.UTF8Encoding]::new($false))
$writer.AutoFlush = $true

function Send-JsonResult($obj) {
    $json = ($obj | ConvertTo-Json -Compress -Depth 10)
    $writer.WriteLine($json)
}

$conn = New-Object -ComObject ADODB.Connection

$pwdClause = if ($password -and $password.Trim() -ne "") { "Jet OLEDB:Database Password=$password;" } else { "" }
$odbcPwdClause = if ($password -and $password.Trim() -ne "") { "PWD=$password;" } else { "" }

$providers = @(
    "Microsoft.ACE.OLEDB.16.0",
    "Microsoft.ACE.OLEDB.12.0",
    "Microsoft.Jet.OLEDB.4.0"
)

$connected = $false
$lastError = ""

foreach ($prov in $providers) {
    try {
        $conn.Open("Provider=$prov;Data Source=$dbPath;$pwdClause")
        $connected = $true
        break
    } catch {
        $lastError = $_.Exception.Message
    }
}

if (-not $connected) {
    $drivers = @(
        "Microsoft Access Driver (*.mdb, *.accdb)",
        "Driver do Microsoft Access (*.mdb)",
        "Microsoft Access Driver (*.mdb)"
    )
    foreach ($drv in $drivers) {
        try {
            $conn.Open("Driver={$drv};DBQ=$dbPath;$odbcPwdClause")
            $connected = $true
            break
        } catch {
            $lastError = $_.Exception.Message
        }
    }
}

if (-not $connected) {
    Send-JsonResult @{
        success = $false
        error = "Falha ao conectar com o banco Access: $lastError. Certifique-se de que o Microsoft Access Database Engine (ACE) ou Jet 4.0 está instalado."
    }
    exit 1
}

Send-JsonResult @{ success = $true; message = "Connected" }

function Get-AdoTypeName([int]$typeCode) {
    switch ($typeCode) {
        2 { "SMALLINT" }
        3 { "INTEGER" }
        4 { "REAL" }
        5 { "DOUBLE" }
        6 { "CURRENCY" }
        7 { "DATETIME" }
        11 { "BOOLEAN" }
        17 { "BYTE" }
        72 { "GUID" }
        128 { "BLOB" }
        129 { "CHAR" }
        130 { "TEXT" }
        131 { "DECIMAL" }
        200 { "VARCHAR" }
        201 { "LONGTEXT" }
        202 { "VARCHAR" }
        203 { "MEMO" }
        204 { "VARBINARY" }
        205 { "LONGBINARY" }
        default { "TEXT" }
    }
}

while ($true) {
    $line = $reader.ReadLine()
    if ($null -eq $line -or $line -eq "QUIT") { break }
    if ($line.Trim() -eq "") { continue }

    try {
        $cmd = $line | ConvertFrom-Json
        $action = $cmd.action

        if ($action -eq "list_tables") {
            $schema = $conn.OpenSchema(20) # adSchemaTables
            $tables = @()
            while (-not $schema.EOF) {
                $type = "$($schema.Fields.Item('TABLE_TYPE').Value)"
                $name = "$($schema.Fields.Item('TABLE_NAME').Value)"
                if ($type -eq "TABLE" -or $type -eq "VIEW" -or $type -eq "LINK") {
                    if (-not ($name.StartsWith("MSys") -or $name.StartsWith("~TMP") -or $name.StartsWith("USys"))) {
                        $cleanName = $name.Trim('[', ']')
                        $count = 0
                        try {
                            $rsCount = $conn.Execute("SELECT COUNT(*) FROM [$cleanName]")
                            if (-not $rsCount.EOF) {
                                $count = [int64]$rsCount.Fields.Item(0).Value
                            }
                            $rsCount.Close()
                        } catch {}

                        $tables += @{
                            name = $name
                            schema = "access"
                            row_count = $count
                            type = if ($type -eq "VIEW") { "view" } else { "table" }
                        }
                    }
                }
                $schema.MoveNext()
            }
            $schema.Close()
            Send-JsonResult @{ success = $true; data = $tables }

        } elseif ($action -eq "describe_table") {
            $tableName = $cmd.table.Trim('[', ']')
            $colsRs = $conn.OpenSchema(4, [object[]]@($null, $null, $tableName, $null)) # adSchemaColumns
            $columns = @()
            $pkSet = @{}

            try {
                $pksRs = $conn.OpenSchema(28, [object[]]@($null, $null, $tableName)) # adSchemaPrimaryKeys
                while (-not $pksRs.EOF) {
                    $pkCol = "$($pksRs.Fields.Item('COLUMN_NAME').Value)"
                    $pkSet[$pkCol] = $true
                    $pksRs.MoveNext()
                }
                $pksRs.Close()
            } catch {}

            while (-not $colsRs.EOF) {
                $colName = "$($colsRs.Fields.Item('COLUMN_NAME').Value)"
                $typeCode = [int]$colsRs.Fields.Item('DATA_TYPE').Value
                $nullable = [bool]$colsRs.Fields.Item('IS_NULLABLE').Value
                $typeName = Get-AdoTypeName $typeCode
                $isPk = [bool]$pkSet.ContainsKey($colName)

                $columns += @{
                    name = $colName
                    type = $typeName
                    nullable = $nullable
                    isPrimaryKey = $isPk
                }
                $colsRs.MoveNext()
            }
            $colsRs.Close()
            Send-JsonResult @{ success = $true; data = $columns }

        } elseif ($action -eq "query") {
            $sql = $cmd.sql
            $limit = if ($null -ne $cmd.limit) { [int]$cmd.limit } else { 0 }
            $offset = if ($null -ne $cmd.offset) { [int]$cmd.offset } else { 0 }

            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            $trimmed = $sql.Trim()
            $isSelect = $trimmed.StartsWith("SELECT", [System.StringComparison]::OrdinalIgnoreCase)

            if ($isSelect) {
                $rs = $conn.Execute($sql)
                $colNames = @()
                for ($i = 0; $i -lt $rs.Fields.Count; $i++) {
                    $colNames += "$($rs.Fields.Item($i).Name)"
                }

                $allRows = @()
                $currentIndex = 0
                while (-not $rs.EOF) {
                    if ($currentIndex -ge $offset -and ($limit -eq 0 -or ($currentIndex - $offset) -lt $limit)) {
                        $row = [ordered]@{}
                        foreach ($col in $colNames) {
                            $val = $rs.Fields.Item($col).Value
                            if ($null -eq $val -or [System.DBNull]::Value.Equals($val)) {
                                $row[$col] = $null
                            } elseif ($val -is [DateTime]) {
                                $row[$col] = $val.ToString("yyyy-MM-dd HH:mm:ss")
                            } elseif ($val -is [byte[]]) {
                                $row[$col] = [Convert]::ToBase64String($val)
                            } else {
                                $row[$col] = $val
                            }
                        }
                        $allRows += $row
                    }
                    $currentIndex++
                    $rs.MoveNext()
                }
                $rs.Close()
                $sw.Stop()

                $totalCount = $currentIndex
                $hasMore = if ($limit -gt 0) { ($offset + $allRows.Count) -lt $totalCount } else { $false }

                Send-JsonResult @{
                    success = $true
                    columns = $colNames
                    rows = $allRows
                    row_count = $allRows.Count
                    total_count = $totalCount
                    has_more = $hasMore
                    execution_time_ms = [int]$sw.ElapsedMilliseconds
                    statement_type = "SELECT"
                    offset = $offset
                    limit = $limit
                }

            } else {
                $affected = 0
                $null = $conn.Execute($sql, [ref]$affected)
                $sw.Stop()

                Send-JsonResult @{
                    success = $true
                    columns = @()
                    rows = @()
                    row_count = $affected
                    total_count = $affected
                    has_more = $false
                    execution_time_ms = [int]$sw.ElapsedMilliseconds
                    statement_type = "DML"
                    affected_rows = $affected
                }
            }

        } else {
            Send-JsonResult @{ success = $false; error = "Ação desconhecida: $action" }
        }

    } catch {
        Send-JsonResult @{ success = $false; error = $_.Exception.Message }
    }
}

$conn.Close()
"#;

struct AccessProcess {
    child: Child,
    stdin: BufWriter<ChildStdin>,
    reader: BufReader<ChildStdout>,
}

impl AccessProcess {
    fn spawn(file_path: &Path, password: Option<&str>) -> Result<Self, String> {
        #[cfg(not(windows))]
        {
            return Err("O conector Microsoft Access requer o sistema operacional Windows.".to_string());
        }

        #[cfg(windows)]
        {
            let script_path = get_or_create_worker_script()?;

            let mut cmd = Command::new("powershell");
            cmd.args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                script_path.to_str().unwrap_or(""),
                file_path.to_str().unwrap_or(""),
            ]);
            if let Some(pwd) = password {
                cmd.arg(pwd);
            }

            cmd.creation_flags(CREATE_NO_WINDOW);
            cmd.stdin(Stdio::piped())
               .stdout(Stdio::piped())
               .stderr(Stdio::piped());

            let mut child = cmd.spawn().map_err(|e| format!("Falha ao iniciar processo do Access: {}", e))?;
            let stdin = BufWriter::new(child.stdin.take().ok_or_else(|| "Falha ao obter canal de entrada do worker".to_string())?);
            let mut reader = BufReader::new(child.stdout.take().ok_or_else(|| "Falha ao obter canal de saída do worker".to_string())?);

            let mut line = String::new();
            reader.read_line(&mut line).map_err(|e| format!("Falha ao ler handshake do driver Access: {}", e))?;

            if line.trim().is_empty() {
                return Err("O driver do Access não retornou dados de inicialização.".to_string());
            }

            let init_val: Value = serde_json::from_str(line.trim()).map_err(|e| {
                format!("Resposta inválida do driver Access: {} (saída: {})", e, line.trim())
            })?;

            if !init_val.get("success").and_then(|s| s.as_bool()).unwrap_or(false) {
                let err = init_val.get("error").and_then(|e| e.as_str()).unwrap_or("Falha ao abrir banco Access");
                return Err(err.to_string());
            }

            Ok(Self {
                child,
                stdin,
                reader,
            })
        }
    }

    fn send_command(&mut self, cmd: &Value) -> Result<Value, String> {
        let serialized = serde_json::to_string(cmd).map_err(|e| e.to_string())?;
        self.stdin.write_all(serialized.as_bytes()).map_err(|e| format!("Erro de escrita no driver Access: {}", e))?;
        self.stdin.write_all(b"\n").map_err(|e| format!("Erro ao enviar comando para driver Access: {}", e))?;
        self.stdin.flush().map_err(|e| format!("Erro ao descarregar buffer do driver Access: {}", e))?;

        let mut line = String::new();
        self.reader.read_line(&mut line).map_err(|e| format!("Erro ao ler resposta do driver Access: {}", e))?;
        if line.is_empty() {
            return Err("O driver do Access encerrou inesperadamente".to_string());
        }

        let resp: Value = serde_json::from_str(line.trim()).map_err(|e| {
            format!("Resposta JSON inválida do driver Access: {} (saída: {})", e, line.trim())
        })?;

        if !resp.get("success").and_then(|s| s.as_bool()).unwrap_or(false) {
            let err_msg = resp.get("error").and_then(|e| e.as_str()).unwrap_or("Erro desconhecido no driver Access");
            return Err(err_msg.to_string());
        }

        Ok(resp)
    }
}

impl Drop for AccessProcess {
    fn drop(&mut self) {
        let _ = self.stdin.write_all(b"QUIT\n");
        let _ = self.stdin.flush();
        let _ = self.child.kill();
    }
}

#[cfg(windows)]
fn get_or_create_worker_script() -> Result<PathBuf, String> {
    let temp_dir = std::env::temp_dir();
    let script_path = temp_dir.join("daddata_access_worker.ps1");
    // Always write to ensure latest version is present
    std::fs::write(&script_path, ACCESS_WORKER_SCRIPT)
        .map_err(|e| format!("Falha ao gravar script worker do Access: {}", e))?;
    Ok(script_path)
}

pub struct AccessEngine {
    pub file_path: PathBuf,
    pub db_name: String,
    process: Mutex<AccessProcess>,
}

impl AccessEngine {
    pub fn open(file_path: &str, password: Option<&str>) -> Result<Self, String> {
        let path = PathBuf::from(file_path);
        if !path.exists() {
            return Err(format!("Arquivo Access não encontrado: {}", file_path));
        }

        let db_name = path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "database.mdb".into());

        let process = AccessProcess::spawn(&path, password)?;

        Ok(Self {
            file_path: path,
            db_name,
            process: Mutex::new(process),
        })
    }

    pub fn list_tables(&self) -> Result<Vec<TableInfo>, String> {
        let mut proc = self.process.lock().map_err(|e| e.to_string())?;
        let cmd = json!({ "action": "list_tables" });
        let resp = proc.send_command(&cmd)?;
        let data = resp.get("data").ok_or_else(|| "Dados de tabelas ausentes".to_string())?;
        serde_json::from_value(data.clone()).map_err(|e| e.to_string())
    }

    pub fn describe_table(&self, table_name: &str) -> Result<Vec<ColumnInfo>, String> {
        let mut proc = self.process.lock().map_err(|e| e.to_string())?;
        let cmd = json!({ "action": "describe_table", "table": table_name });
        let resp = proc.send_command(&cmd)?;
        let data = resp.get("data").ok_or_else(|| "Dados de colunas ausentes".to_string())?;
        serde_json::from_value(data.clone()).map_err(|e| e.to_string())
    }

    pub fn execute_query(&self, sql: &str) -> Result<QueryResult, String> {
        let start = Instant::now();
        let mut proc = self.process.lock().map_err(|e| e.to_string())?;
        let cmd = json!({ "action": "query", "sql": sql });
        let resp = proc.send_command(&cmd)?;

        let columns = resp.get("columns")
            .and_then(|c| c.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        let rows = resp.get("rows")
            .and_then(|r| r.as_array())
            .cloned()
            .unwrap_or_default();

        let row_count = resp.get("row_count").and_then(|v| v.as_u64()).unwrap_or(rows.len() as u64) as usize;
        let total_count = resp.get("total_count").and_then(|v| v.as_i64());
        let has_more = resp.get("has_more").and_then(|v| v.as_bool()).unwrap_or(false);
        let execution_time_ms = resp.get("execution_time_ms").and_then(|v| v.as_u64()).map(|t| t as u128).unwrap_or(start.elapsed().as_millis());
        let statement_type = resp.get("statement_type").and_then(|v| v.as_str().map(String::from));

        Ok(QueryResult {
            columns,
            rows,
            row_count,
            total_count,
            has_more,
            execution_time_ms,
            statement_type,
            offset: None,
            limit: None,
        })
    }

    pub fn get_table_data(&self, table_name: &str, limit: usize, offset: usize) -> Result<QueryResult, String> {
        let clean_table = table_name.trim_matches(|c| c == '[' || c == ']');
        let sql = format!("SELECT * FROM [{}]", clean_table);
        let start = Instant::now();
        let mut proc = self.process.lock().map_err(|e| e.to_string())?;
        let cmd = json!({
            "action": "query",
            "sql": sql,
            "limit": limit,
            "offset": offset
        });
        let resp = proc.send_command(&cmd)?;

        let columns = resp.get("columns")
            .and_then(|c| c.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
            .unwrap_or_default();

        let rows = resp.get("rows")
            .and_then(|r| r.as_array())
            .cloned()
            .unwrap_or_default();

        let row_count = resp.get("row_count").and_then(|v| v.as_u64()).unwrap_or(rows.len() as u64) as usize;
        let total_count = resp.get("total_count").and_then(|v| v.as_i64());
        let has_more = resp.get("has_more").and_then(|v| v.as_bool()).unwrap_or(false);
        let execution_time_ms = resp.get("execution_time_ms").and_then(|v| v.as_u64()).map(|t| t as u128).unwrap_or(start.elapsed().as_millis());
        let statement_type = resp.get("statement_type").and_then(|v| v.as_str().map(String::from));

        Ok(QueryResult {
            columns,
            rows,
            row_count,
            total_count,
            has_more,
            execution_time_ms,
            statement_type,
            offset: Some(offset),
            limit: Some(limit),
        })
    }

    pub fn insert_row(&self, table_name: &str, data: &Map<String, Value>) -> Result<MutationResult, String> {
        if data.is_empty() {
            return Err("Nenhum dado informado para inserção".into());
        }
        let clean_table = table_name.trim_matches(|c| c == '[' || c == ']');
        let cols: Vec<String> = data.keys().map(|k| format!("[{}]", k.trim_matches(|c| c == '[' || c == ']'))).collect();
        let vals: Vec<String> = data.values().map(sql_format_val).collect();
        let sql = format!("INSERT INTO [{}] ({}) VALUES ({})", clean_table, cols.join(", "), vals.join(", "));

        let res = self.execute_query(&sql)?;
        Ok(MutationResult {
            success: true,
            affected_rows: res.row_count as u64,
            inserted_id: None,
            error: None,
        })
    }

    pub fn update_row(
        &self,
        table_name: &str,
        pk: &Map<String, Value>,
        changes: &Map<String, Value>,
    ) -> Result<MutationResult, String> {
        if changes.is_empty() {
            return Err("Nenhuma alteração informada".into());
        }
        let clean_table = table_name.trim_matches(|c| c == '[' || c == ']');
        let set_clauses: Vec<String> = changes.iter()
            .map(|(k, v)| format!("[{}] = {}", k.trim_matches(|c| c == '[' || c == ']'), sql_format_val(v)))
            .collect();
        let where_clauses: Vec<String> = pk.iter()
            .map(|(k, v)| format!("[{}] = {}", k.trim_matches(|c| c == '[' || c == ']'), sql_format_val(v)))
            .collect();

        let sql = format!(
            "UPDATE [{}] SET {} WHERE {}",
            clean_table,
            set_clauses.join(", "),
            if where_clauses.is_empty() { "1=1".into() } else { where_clauses.join(" AND ") }
        );

        let res = self.execute_query(&sql)?;
        Ok(MutationResult {
            success: true,
            affected_rows: res.row_count as u64,
            inserted_id: None,
            error: None,
        })
    }

    pub fn delete_row(&self, table_name: &str, pk: &Map<String, Value>) -> Result<MutationResult, String> {
        let clean_table = table_name.trim_matches(|c| c == '[' || c == ']');
        let where_clauses: Vec<String> = pk.iter()
            .map(|(k, v)| format!("[{}] = {}", k.trim_matches(|c| c == '[' || c == ']'), sql_format_val(v)))
            .collect();

        let sql = format!(
            "DELETE FROM [{}] WHERE {}",
            clean_table,
            if where_clauses.is_empty() { "1=1".into() } else { where_clauses.join(" AND ") }
        );

        let res = self.execute_query(&sql)?;
        Ok(MutationResult {
            success: true,
            affected_rows: res.row_count as u64,
            inserted_id: None,
            error: None,
        })
    }
}

fn is_access_date_str(s: &str) -> bool {
    let bytes = s.as_bytes();
    bytes.len() >= 10
        && bytes[0..4].iter().all(|b| b.is_ascii_digit())
        && bytes[4] == b'-'
        && bytes[5..7].iter().all(|b| b.is_ascii_digit())
        && bytes[7] == b'-'
        && bytes[8..10].iter().all(|b| b.is_ascii_digit())
}

fn sql_format_val(v: &Value) -> String {
    match v {
        Value::Null => "NULL".into(),
        Value::Bool(b) => if *b { "TRUE".into() } else { "FALSE".into() },
        Value::Number(n) => n.to_string(),
        Value::String(s) => {
            if is_access_date_str(s) && !s.contains('\'') {
                format!("#{}#", s.replace('T', " "))
            } else {
                format!("'{}'", s.replace('\'', "''"))
            }
        }
        _ => format!("'{}'", v.to_string().replace('\'', "''")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn get_access_test_dir() -> PathBuf {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let root = manifest_dir.parent().unwrap_or(&manifest_dir);
        root.join("db_test").join("Access")
    }

    #[test]
    fn test_access_accdb_real_data() {
        let test_dir = get_access_test_dir();
        let accdb_path = test_dir.join("northwind_test.accdb");
        if !accdb_path.exists() {
            println!("northwind_test.accdb não encontrado, ignorando teste.");
            return;
        }

        let engine = AccessEngine::open(accdb_path.to_str().unwrap(), None).expect("Should open ACCDB database");
        let tables = engine.list_tables().expect("Should list tables");
        let table_names: Vec<String> = tables.iter().map(|t| t.name.clone()).collect();
        println!("ACCDB Tables: {:?}", table_names);
        assert!(table_names.contains(&"Clientes".to_string()));

        let cols = engine.describe_table("Clientes").expect("Should describe Clientes");
        println!("Clientes Columns: {:?}", cols);
        assert!(cols.iter().any(|c| c.name == "Id" && c.is_primary_key));
        assert!(cols.iter().any(|c| c.name == "Nome"));

        let data = engine.get_table_data("Clientes", 10, 0).expect("Should fetch Clientes data");
        println!("Clientes Rows: {:?}", data.rows);
        assert!(!data.rows.is_empty());
        assert_eq!(data.statement_type.as_deref(), Some("SELECT"));

        // Test custom query
        let q_res = engine.execute_query("SELECT Nome, Saldo FROM Clientes WHERE Id = 1").expect("Should execute query");
        assert_eq!(q_res.row_count, 1);
        println!("Query result: {:?}", q_res.rows);

        // Test insert row
        let mut new_row = Map::new();
        new_row.insert("Nome".into(), Value::String("Ana Teste".into()));
        new_row.insert("Saldo".into(), json!(550.25));
        let ins_res = engine.insert_row("Clientes", &new_row).expect("Should insert row");
        assert_eq!(ins_res.affected_rows, 1);

        // Test update row
        let mut pk = Map::new();
        pk.insert("Nome".into(), Value::String("Ana Teste".into()));
        let mut changes = Map::new();
        changes.insert("Saldo".into(), json!(750.50));
        let upd_res = engine.update_row("Clientes", &pk, &changes).expect("Should update row");
        assert!(upd_res.affected_rows >= 1);

        // Test delete row
        let del_res = engine.delete_row("Clientes", &pk).expect("Should delete row");
        assert!(del_res.affected_rows >= 1);
    }

    #[test]
    fn test_access_mdb_real_data() {
        let test_dir = get_access_test_dir();
        let mdb_path = test_dir.join("northwind_test.mdb");
        if !mdb_path.exists() {
            println!("northwind_test.mdb não encontrado, ignorando teste.");
            return;
        }

        let engine = AccessEngine::open(mdb_path.to_str().unwrap(), None).expect("Should open MDB database");
        let tables = engine.list_tables().expect("Should list tables");
        let table_names: Vec<String> = tables.iter().map(|t| t.name.clone()).collect();
        println!("MDB Tables: {:?}", table_names);
        assert!(table_names.contains(&"Produtos".to_string()));

        let cols = engine.describe_table("Produtos").expect("Should describe Produtos");
        assert!(cols.iter().any(|c| c.name == "Cod" && c.is_primary_key));
        assert!(cols.iter().any(|c| c.name == "Preco"));

        let data = engine.get_table_data("Produtos", 10, 0).expect("Should fetch Produtos data");
        assert_eq!(data.row_count, 1);
        println!("Produtos Rows: {:?}", data.rows);
    }
}
