use std::collections::HashMap;
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::time::Duration;
use crate::engine::types::DetectedService;

pub struct ServiceDetector;

impl ServiceDetector {
    /// Detects all supported database engines and their tools on the system
    pub fn detect_all() -> Vec<DetectedService> {
        vec![
            Self::detect_postgres(),
            Self::detect_mysql(),
            Self::detect_mssql(),
            Self::detect_firebird(),
            Self::detect_sqlite(),
        ]
    }

    /// Checks if a local port is actively accepting connections
    pub fn is_port_open(port: u16) -> bool {
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        TcpStream::connect_timeout(&addr, Duration::from_millis(200)).is_ok()
    }

    /// Searches for a binary in PATH and common installation directories
    pub fn find_binary(binary_name: &str, common_paths: &[&str]) -> Option<String> {
        // 1. Check PATH
        if let Ok(path_var) = std::env::var("PATH") {
            for dir in std::env::split_paths(&path_var) {
                let candidate = dir.join(binary_name);
                if candidate.is_file() {
                    return Some(candidate.to_string_lossy().to_string());
                }
                // Try .exe if on windows and not included
                let candidate_exe = dir.join(format!("{}.exe", binary_name));
                if candidate_exe.is_file() {
                    return Some(candidate_exe.to_string_lossy().to_string());
                }
            }
        }

        // 2. Check common paths (with wildcard/directory expansion where applicable)
        for &dir_pattern in common_paths {
            if dir_pattern.contains('*') {
                if let Some(parent) = Path::new(dir_pattern).parent() {
                    if let Ok(entries) = std::fs::read_dir(parent) {
                        for entry in entries.flatten() {
                            let sub_bin = entry.path().join("bin").join(format!("{}.exe", binary_name));
                            if sub_bin.is_file() {
                                return Some(sub_bin.to_string_lossy().to_string());
                            }
                            let direct_bin = entry.path().join(format!("{}.exe", binary_name));
                            if direct_bin.is_file() {
                                return Some(direct_bin.to_string_lossy().to_string());
                            }
                        }
                    }
                }
            } else {
                let candidate = Path::new(dir_pattern).join(format!("{}.exe", binary_name));
                if candidate.is_file() {
                    return Some(candidate.to_string_lossy().to_string());
                }
                let candidate_raw = Path::new(dir_pattern).join(binary_name);
                if candidate_raw.is_file() {
                    return Some(candidate_raw.to_string_lossy().to_string());
                }
            }
        }

        // 3. Check DadData portable tools directory
        if let Some(appdata) = std::env::var_os("APPDATA") {
            let portable_path = PathBuf::from(appdata)
                .join("DadData")
                .join("tools")
                .join(format!("{}.exe", binary_name));
            if portable_path.is_file() {
                return Some(portable_path.to_string_lossy().to_string());
            }
        }

        None
    }

    /// Detects PostgreSQL installations and tools
    pub fn detect_postgres() -> DetectedService {
        let is_running = Self::is_port_open(5432);
        let mut tools = HashMap::new();

        let common_dirs = [
            r"C:\Program Files\PostgreSQL\17\bin",
            r"C:\Program Files\PostgreSQL\16\bin",
            r"C:\Program Files\PostgreSQL\15\bin",
            r"C:\Program Files\PostgreSQL\14\bin",
            r"C:\Program Files\PostgreSQL\13\bin",
            r"C:\Program Files\PostgreSQL\12\bin",
            r"C:\PostgreSQL\bin",
        ];

        let mut detected_version = None;

        if let Some(dump) = Self::find_binary("pg_dump", &common_dirs) {
            // Infer version from path if possible
            if dump.contains("17") { detected_version = Some("17.x".into()); }
            else if dump.contains("16") { detected_version = Some("16.x".into()); }
            else if dump.contains("15") { detected_version = Some("15.x".into()); }
            else if dump.contains("14") { detected_version = Some("14.x".into()); }
            tools.insert("pg_dump".to_string(), dump);
        }

        if let Some(restore) = Self::find_binary("pg_restore", &common_dirs) {
            tools.insert("pg_restore".to_string(), restore);
        }

        if let Some(psql) = Self::find_binary("psql", &common_dirs) {
            tools.insert("psql".to_string(), psql);
        }

        let status = if is_running {
            "running"
        } else if !tools.is_empty() {
            "stopped"
        } else {
            "not_installed"
        };

        DetectedService {
            id: "postgres".into(),
            name: "PostgreSQL".into(),
            label: "PostgreSQL Database Server".into(),
            status: status.into(),
            port: Some(5432),
            version: detected_version.or(if is_running { Some("Ativo (Porta 5432)".into()) } else { None }),
            tools,
            is_portable: false,
            service_name: Some("postgresql-x64-16".into()),
        }
    }

    /// Detects MySQL & MariaDB installations and tools
    pub fn detect_mysql() -> DetectedService {
        let is_running = Self::is_port_open(3306);
        let mut tools = HashMap::new();

        let common_dirs = [
            r"C:\Program Files\MySQL\MySQL Server 8.4\bin",
            r"C:\Program Files\MySQL\MySQL Server 8.0\bin",
            r"C:\Program Files\MySQL\MySQL Server 5.7\bin",
            r"C:\Program Files\MariaDB 11.4\bin",
            r"C:\Program Files\MariaDB 10.11\bin",
            r"C:\xampp\mysql\bin",
            r"C:\wamp64\bin\mysql\mysql*\bin",
        ];

        if let Some(dump) = Self::find_binary("mysqldump", &common_dirs) {
            tools.insert("mysqldump".to_string(), dump);
        }

        if let Some(mysql) = Self::find_binary("mysql", &common_dirs) {
            tools.insert("mysql".to_string(), mysql);
        }

        let status = if is_running {
            "running"
        } else if !tools.is_empty() {
            "stopped"
        } else {
            "not_installed"
        };

        DetectedService {
            id: "mysql".into(),
            name: "MySQL / MariaDB".into(),
            label: "MySQL & MariaDB Server".into(),
            status: status.into(),
            port: Some(3306),
            version: if is_running { Some("Ativo (Porta 3306)".into()) } else { None },
            tools,
            is_portable: false,
            service_name: Some("MySQL80".into()),
        }
    }

    /// Detects SQL Server installations and tools
    pub fn detect_mssql() -> DetectedService {
        let is_running = Self::is_port_open(1433);
        let mut tools = HashMap::new();

        let common_dirs = [
            r"C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn",
            r"C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\180\Tools\Binn",
            r"C:\Program Files\Microsoft SQL Server\160\Tools\Binn",
            r"C:\Program Files\Microsoft SQL Server\150\Tools\Binn",
        ];

        if let Some(sqlcmd) = Self::find_binary("sqlcmd", &common_dirs) {
            tools.insert("sqlcmd".to_string(), sqlcmd);
        }

        if let Some(bcp) = Self::find_binary("bcp", &common_dirs) {
            tools.insert("bcp".to_string(), bcp);
        }

        let status = if is_running {
            "running"
        } else if !tools.is_empty() {
            "stopped"
        } else {
            "not_installed"
        };

        DetectedService {
            id: "mssql".into(),
            name: "Microsoft SQL Server".into(),
            label: "SQL Server (T-SQL)".into(),
            status: status.into(),
            port: Some(1433),
            version: if is_running { Some("Ativo (Porta 1433)".into()) } else { None },
            tools,
            is_portable: false,
            service_name: Some("MSSQLSERVER".into()),
        }
    }

    /// Detects Firebird installations and tools
    pub fn detect_firebird() -> DetectedService {
        let is_running = Self::is_port_open(3050);
        let mut tools = HashMap::new();

        let common_dirs = [
            r"C:\Program Files\Firebird\Firebird_5_0",
            r"C:\Program Files\Firebird\Firebird_4_0",
            r"C:\Program Files\Firebird\Firebird_3_0",
            r"C:\Program Files\Firebird\Firebird_2_5\bin",
        ];

        if let Some(gbak) = Self::find_binary("gbak", &common_dirs) {
            tools.insert("gbak".to_string(), gbak);
        }

        if let Some(isql) = Self::find_binary("isql", &common_dirs) {
            tools.insert("isql".to_string(), isql);
        }

        let status = if is_running {
            "running"
        } else if !tools.is_empty() {
            "stopped"
        } else {
            "not_installed"
        };

        DetectedService {
            id: "firebird".into(),
            name: "Firebird".into(),
            label: "Firebird SQL Server".into(),
            status: status.into(),
            port: Some(3050),
            version: if is_running { Some("Ativo (Porta 3050)".into()) } else { None },
            tools,
            is_portable: false,
            service_name: Some("FirebirdServer".into()),
        }
    }

    /// SQLite is natively built-in into DadData
    pub fn detect_sqlite() -> DetectedService {
        let mut tools = HashMap::new();
        tools.insert("backup_engine".into(), "Native Rusqlite Engine (In-Memory & File)".into());

        DetectedService {
            id: "sqlite".into(),
            name: "SQLite 3".into(),
            label: "SQLite Motor Embutido".into(),
            status: "running".into(),
            port: None,
            version: Some("3.x (Nativo)".into()),
            tools,
            is_portable: true,
            service_name: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_all_returns_services() {
        let services = ServiceDetector::detect_all();
        assert!(!services.is_empty());
        let sqlite = services.iter().find(|s| s.id == "sqlite");
        assert!(sqlite.is_some());
        assert_eq!(sqlite.unwrap().status, "running");
        assert!(sqlite.unwrap().is_portable);
    }

    #[test]
    fn test_detect_postgres_and_mysql_structure() {
        let pg = ServiceDetector::detect_postgres();
        assert_eq!(pg.id, "postgres");
        assert_eq!(pg.name, "PostgreSQL");

        let my = ServiceDetector::detect_mysql();
        assert_eq!(my.id, "mysql");
    }
}
