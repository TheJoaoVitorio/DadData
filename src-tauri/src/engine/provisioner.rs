use std::path::PathBuf;
use crate::engine::types::PortableToolStatus;

pub struct Provisioner;

impl Provisioner {
    pub fn get_tools_dir() -> PathBuf {
        let base = std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("./tools"));
        let tools_dir = base.join("DadData").join("tools");
        if !tools_dir.exists() {
            let _ = std::fs::create_dir_all(&tools_dir);
        }
        tools_dir
    }

    pub fn list_tools() -> Vec<PortableToolStatus> {
        let tools_dir = Self::get_tools_dir();

        let pg_dump_path = tools_dir.join("pg_dump.exe");
        let mysql_dump_path = tools_dir.join("mysqldump.exe");
        let gbak_path = tools_dir.join("gbak.exe");

        vec![
            PortableToolStatus {
                id: "postgres_tools".into(),
                name: "PostgreSQL Client Tools (pg_dump, pg_restore)".into(),
                is_installed: pg_dump_path.is_file(),
                version: Some("16.4 Portable".into()),
                path: if pg_dump_path.is_file() {
                    Some(pg_dump_path.to_string_lossy().to_string())
                } else {
                    None
                },
                download_url: Some(
                    "https://github.com/TheJoaoVitorio/daddata-runtimes/releases/download/v1.0/postgres-tools-win64.zip".into(),
                ),
                size_bytes: Some(18 * 1024 * 1024), // ~18 MB
            },
            PortableToolStatus {
                id: "mysql_tools".into(),
                name: "MySQL Client Tools (mysqldump, mysql)".into(),
                is_installed: mysql_dump_path.is_file(),
                version: Some("8.0 Portable".into()),
                path: if mysql_dump_path.is_file() {
                    Some(mysql_dump_path.to_string_lossy().to_string())
                } else {
                    None
                },
                download_url: Some(
                    "https://github.com/TheJoaoVitorio/daddata-runtimes/releases/download/v1.0/mysql-tools-win64.zip".into(),
                ),
                size_bytes: Some(14 * 1024 * 1024), // ~14 MB
            },
            PortableToolStatus {
                id: "firebird_tools".into(),
                name: "Firebird Tools (gbak)".into(),
                is_installed: gbak_path.is_file(),
                version: Some("3.0 / 4.0".into()),
                path: if gbak_path.is_file() {
                    Some(gbak_path.to_string_lossy().to_string())
                } else {
                    None
                },
                download_url: Some(
                    "https://github.com/TheJoaoVitorio/daddata-runtimes/releases/download/v1.0/firebird-tools-win64.zip".into(),
                ),
                size_bytes: Some(8 * 1024 * 1024),
            },
            PortableToolStatus {
                id: "sqlite_engine".into(),
                name: "SQLite 3 Engine (Embutido Rust)".into(),
                is_installed: true,
                version: Some("3.46 (Nativo Rust Rusqlite)".into()),
                path: Some("Embutido no binário DadData".into()),
                download_url: None,
                size_bytes: Some(0),
            },
        ]
    }

    /// Downloads and installs a tool into %APPDATA%/DadData/tools/
    pub async fn download_tool(tool_id: &str) -> Result<String, String> {
        let tools_dir = Self::get_tools_dir();
        let target_zip = tools_dir.join(format!("{}.zip", tool_id));

        let tools = Self::list_tools();
        let tool = tools
            .iter()
            .find(|t| t.id == tool_id)
            .ok_or_else(|| format!("Ferramenta '{}' não encontrada", tool_id))?;

        let url = tool
            .download_url
            .as_ref()
            .ok_or_else(|| "Esta ferramenta já é nativa e não requer download.".to_string())?;

        // Use curl.exe or powershell on Windows to download
        let powershell_cmd = format!(
            "$ProgressPreference = 'SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('{}', '{}')",
            url,
            target_zip.to_string_lossy().replace('\\', "/")
        );

        let output = tokio::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &powershell_cmd])
            .output()
            .await
            .map_err(|e| format!("Falha ao invocar downloader PowerShell: {}", e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Erro no download da ferramenta: {}", err));
        }

        // Unzip archive
        let unzip_cmd = format!(
            "Expand-Archive -Path '{}' -DestinationPath '{}' -Force; Remove-Item -Path '{}' -Force",
            target_zip.to_string_lossy().replace('\\', "/"),
            tools_dir.to_string_lossy().replace('\\', "/"),
            target_zip.to_string_lossy().replace('\\', "/")
        );

        let unzip_output = tokio::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &unzip_cmd])
            .output()
            .await
            .map_err(|e| format!("Falha ao descompactar pacote: {}", e))?;

        if !unzip_output.status.success() {
            let err = String::from_utf8_lossy(&unzip_output.stderr);
            return Err(format!("Erro na descompactação: {}", err));
        }

        Ok(format!(
            "Ferramenta '{}' instalada com sucesso em {:?}",
            tool.name, tools_dir
        ))
    }
}
