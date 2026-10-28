use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::process::Stdio;
use chrono::Local;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use crate::engine::service_detector::ServiceDetector;
use crate::engine::types::{BackupOptions, ConnectionConfig, LogEvent, RestoreOptions};

pub struct BackupManager;

impl BackupManager {
    fn emit_log(
        app_handle: &AppHandle,
        stream: &str,
        message: &str,
        percentage: Option<u8>,
        is_done: bool,
        success: bool,
    ) {
        let event = LogEvent {
            stream: stream.to_string(),
            message: message.to_string(),
            timestamp: Local::now().format("%H:%M:%S").to_string(),
            percentage,
            is_done,
            success,
        };
        let _ = app_handle.emit("backup:log", event);
    }

    fn emit_restore_log(
        app_handle: &AppHandle,
        stream: &str,
        message: &str,
        percentage: Option<u8>,
        is_done: bool,
        success: bool,
    ) {
        let event = LogEvent {
            stream: stream.to_string(),
            message: message.to_string(),
            timestamp: Local::now().format("%H:%M:%S").to_string(),
            percentage,
            is_done,
            success,
        };
        let _ = app_handle.emit("restore:log", event);
    }

    /// Executes database backup according to database type and options
    pub async fn backup(
        app_handle: &AppHandle,
        options: BackupOptions,
        config: ConnectionConfig,
    ) -> Result<String, String> {
        let db_type = config.db_type.to_lowercase();
        let db_name = options
            .database_name
            .clone()
            .or_else(|| config.database.clone())
            .unwrap_or_else(|| "daddata_db".to_string());

        Self::emit_log(
            app_handle,
            "info",
            &format!("Iniciando processo de backup para '{}' ({})", db_name, config.name),
            Some(5),
            false,
            true,
        );

        match db_type.as_str() {
            "postgres" | "postgresql" => {
                Self::backup_postgres(app_handle, &options, &config, &db_name).await
            }
            "mysql" | "mariadb" => {
                Self::backup_mysql(app_handle, &options, &config, &db_name).await
            }
            "mssql" | "sqlserver" => {
                Self::backup_mssql(app_handle, &options, &config, &db_name).await
            }
            "sqlite" => {
                Self::backup_sqlite(app_handle, &options, &config).await
            }
            "firebird" => {
                Self::backup_firebird(app_handle, &options, &config, &db_name).await
            }
            "dbf" | "paradox" | "access" | "nexusdb" => {
                Self::backup_legacy(app_handle, &options, &config).await
            }
            _ => Err(format!("Tipo de banco '{}' não suporta backup automatizado.", db_type)),
        }
    }

    /// Executes database restore from a backup file
    pub async fn restore(
        app_handle: &AppHandle,
        options: RestoreOptions,
        config: ConnectionConfig,
    ) -> Result<String, String> {
        let db_type = config.db_type.to_lowercase();
        let db_name = options
            .database_name
            .clone()
            .or_else(|| config.database.clone())
            .unwrap_or_else(|| "daddata_db".to_string());

        Self::emit_restore_log(
            app_handle,
            "info",
            &format!("Iniciando restauração em '{}' ({}) a partir de '{}'", db_name, config.name, options.input_path),
            Some(5),
            false,
            true,
        );

        match db_type.as_str() {
            "postgres" | "postgresql" => {
                Self::restore_postgres(app_handle, &options, &config, &db_name).await
            }
            "mysql" | "mariadb" => {
                Self::restore_mysql(app_handle, &options, &config, &db_name).await
            }
            "mssql" | "sqlserver" => {
                Self::restore_mssql(app_handle, &options, &config, &db_name).await
            }
            "sqlite" => {
                Self::restore_sqlite(app_handle, &options, &config).await
            }
            "firebird" => {
                Self::restore_firebird(app_handle, &options, &config, &db_name).await
            }
            "dbf" | "paradox" | "access" | "nexusdb" => {
                Self::restore_legacy(app_handle, &options, &config).await
            }
            _ => Err(format!("Tipo de banco '{}' não suporta restauração automatizada.", db_type)),
        }
    }

    // --- PostgreSQL Implementations ---

    async fn backup_postgres(
        app_handle: &AppHandle,
        options: &BackupOptions,
        config: &ConnectionConfig,
        db_name: &str,
    ) -> Result<String, String> {
        let host = config.host.as_deref().unwrap_or("127.0.0.1");
        let port = config.port.unwrap_or(5432).to_string();
        let user = config.user.as_deref().unwrap_or("postgres");

        let tool_path = if let Some(custom) = &options.custom_tool_path {
            custom.clone()
        } else {
            let detected = ServiceDetector::detect_postgres();
            detected.tools.get("pg_dump").cloned().unwrap_or_else(|| "pg_dump".to_string())
        };

        Self::emit_log(
            app_handle,
            "info",
            &format!("Utilizando ferramenta: {}", tool_path),
            Some(15),
            false,
            true,
        );

        let mut cmd = tokio::process::Command::new(&tool_path);
        cmd.arg("-h").arg(host);
        cmd.arg("-p").arg(&port);
        cmd.arg("-U").arg(user);
        cmd.arg("-d").arg(db_name);
        cmd.arg("-f").arg(&options.output_path);

        match options.format.as_str() {
            "custom" => { cmd.arg("-F").arg("c"); }
            "tar" => { cmd.arg("-F").arg("t"); }
            _ => { cmd.arg("-F").arg("p"); }
        }

        if options.dump_type == "schema_only" {
            cmd.arg("-s");
        } else if options.dump_type == "data_only" {
            cmd.arg("-a");
        }

        if options.drop_existing.unwrap_or(false) {
            cmd.arg("-c");
        }

        if let Some(password) = &config.password {
            cmd.env("PGPASSWORD", password);
        }

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            format!("Não foi possível iniciar 'pg_dump' ({}). Verifique se o PostgreSQL está instalado ou use o pacote portátil DadData.", e)
        })?;

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        let app1 = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                Self::emit_log(&app1, "stdout", &line, None, false, true);
            }
        });

        let app2 = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                Self::emit_log(&app2, "stderr", &line, None, false, true);
            }
        });

        let status = child.wait().await.map_err(|e| format!("Erro ao aguardar pg_dump: {}", e))?;

        if status.success() {
            Self::emit_log(
                app_handle,
                "info",
                &format!("Backup PostgreSQL concluído com sucesso em: {}", options.output_path),
                Some(100),
                true,
                true,
            );
            Ok(options.output_path.clone())
        } else {
            Self::emit_log(
                app_handle,
                "error",
                &format!("pg_dump finalizou com código de erro: {:?}", status.code()),
                Some(100),
                true,
                false,
            );
            Err(format!("pg_dump falhou com código {:?}", status.code()))
        }
    }

    async fn restore_postgres(
        app_handle: &AppHandle,
        options: &RestoreOptions,
        config: &ConnectionConfig,
        db_name: &str,
    ) -> Result<String, String> {
        let host = config.host.as_deref().unwrap_or("127.0.0.1");
        let port = config.port.unwrap_or(5432).to_string();
        let user = config.user.as_deref().unwrap_or("postgres");

        let is_custom = options.input_path.ends_with(".dump") || options.input_path.ends_with(".backup");
        let tool_name = if is_custom { "pg_restore" } else { "psql" };

        let detected = ServiceDetector::detect_postgres();
        let tool_path = options
            .custom_tool_path
            .clone()
            .or_else(|| detected.tools.get(tool_name).cloned())
            .unwrap_or_else(|| tool_name.to_string());

        Self::emit_restore_log(
            app_handle,
            "info",
            &format!("Utilizando ferramenta: {}", tool_path),
            Some(15),
            false,
            true,
        );

        let mut cmd = tokio::process::Command::new(&tool_path);
        cmd.arg("-h").arg(host);
        cmd.arg("-p").arg(&port);
        cmd.arg("-U").arg(user);
        cmd.arg("-d").arg(db_name);

        if is_custom {
            if options.drop_first.unwrap_or(false) {
                cmd.arg("--clean");
            }
            cmd.arg(&options.input_path);
        } else {
            cmd.arg("-f").arg(&options.input_path);
        }

        if let Some(password) = &config.password {
            cmd.env("PGPASSWORD", password);
        }

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            format!("Não foi possível iniciar '{}' ({}).", tool_name, e)
        })?;

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        let app1 = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                Self::emit_restore_log(&app1, "stdout", &line, None, false, true);
            }
        });

        let app2 = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                Self::emit_restore_log(&app2, "stderr", &line, None, false, true);
            }
        });

        let status = child.wait().await.map_err(|e| format!("Erro ao aguardar restauração: {}", e))?;

        if status.success() {
            Self::emit_restore_log(
                app_handle,
                "info",
                &format!("Restauração PostgreSQL finalizada com sucesso em '{}'", db_name),
                Some(100),
                true,
                true,
            );
            Ok("Restauração concluída".to_string())
        } else {
            Self::emit_restore_log(
                app_handle,
                "error",
                &format!("Processo finalizou com erro: {:?}", status.code()),
                Some(100),
                true,
                false,
            );
            Err(format!("Restauração falhou com código {:?}", status.code()))
        }
    }

    // --- MySQL Implementations ---

    async fn backup_mysql(
        app_handle: &AppHandle,
        options: &BackupOptions,
        config: &ConnectionConfig,
        db_name: &str,
    ) -> Result<String, String> {
        let host = config.host.as_deref().unwrap_or("127.0.0.1");
        let port = config.port.unwrap_or(3306).to_string();
        let user = config.user.as_deref().unwrap_or("root");

        let detected = ServiceDetector::detect_mysql();
        let tool_path = options
            .custom_tool_path
            .clone()
            .or_else(|| detected.tools.get("mysqldump").cloned())
            .unwrap_or_else(|| "mysqldump".to_string());

        Self::emit_log(
            app_handle,
            "info",
            &format!("Utilizando mysqldump: {}", tool_path),
            Some(15),
            false,
            true,
        );

        let mut cmd = tokio::process::Command::new(&tool_path);
        cmd.arg("-h").arg(host);
        cmd.arg("-P").arg(&port);
        cmd.arg("-u").arg(user);

        if let Some(pass) = &config.password {
            cmd.arg(format!("--password={}", pass));
        }

        if options.dump_type == "schema_only" {
            cmd.arg("--no-data");
        } else if options.dump_type == "data_only" {
            cmd.arg("--no-create-info");
        }

        if options.drop_existing.unwrap_or(false) {
            cmd.arg("--add-drop-table");
        }

        cmd.arg(format!("--result-file={}", options.output_path));
        cmd.arg(db_name);

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| {
            format!("Não foi possível iniciar mysqldump ({}). Verifique a instalação ou baixe o utilitário portátil.", e)
        })?;

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        let app1 = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                Self::emit_log(&app1, "stdout", &line, None, false, true);
            }
        });

        let app2 = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                Self::emit_log(&app2, "stderr", &line, None, false, true);
            }
        });

        let status = child.wait().await.map_err(|e| format!("Erro ao aguardar mysqldump: {}", e))?;

        if status.success() {
            Self::emit_log(
                app_handle,
                "info",
                &format!("Backup MySQL concluído com sucesso em: {}", options.output_path),
                Some(100),
                true,
                true,
            );
            Ok(options.output_path.clone())
        } else {
            Err(format!("mysqldump falhou com código {:?}", status.code()))
        }
    }

    async fn restore_mysql(
        app_handle: &AppHandle,
        options: &RestoreOptions,
        config: &ConnectionConfig,
        db_name: &str,
    ) -> Result<String, String> {
        let host = config.host.as_deref().unwrap_or("127.0.0.1");
        let port = config.port.unwrap_or(3306).to_string();
        let user = config.user.as_deref().unwrap_or("root");

        let detected = ServiceDetector::detect_mysql();
        let tool_path = options
            .custom_tool_path
            .clone()
            .or_else(|| detected.tools.get("mysql").cloned())
            .unwrap_or_else(|| "mysql".to_string());

        Self::emit_restore_log(
            app_handle,
            "info",
            &format!("Restaurando via cliente MySQL: {}", tool_path),
            Some(20),
            false,
            true,
        );

        let pass_arg = config.password.as_ref().map(|p| format!("--password={}", p)).unwrap_or_default();
        let shell_cmd = format!(
            "& '{}' -h {} -P {} -u {} {} {} -e 'source {}'",
            tool_path.replace('\'', "''"),
            host,
            port,
            user,
            pass_arg,
            db_name,
            options.input_path.replace('\\', "/").replace('\'', "''")
        );

        let output = tokio::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &shell_cmd])
            .output()
            .await
            .map_err(|e| format!("Falha ao invocar processo de restauração: {}", e))?;

        if output.status.success() {
            Self::emit_restore_log(
                app_handle,
                "info",
                &format!("Restauração MySQL concluída com sucesso em '{}'", db_name),
                Some(100),
                true,
                true,
            );
            Ok("Restauração concluída".to_string())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Self::emit_restore_log(app_handle, "error", &err, Some(100), true, false);
            Err(format!("Erro ao restaurar MySQL: {}", err))
        }
    }

    // --- SQL Server Implementation ---

    async fn backup_mssql(
        app_handle: &AppHandle,
        options: &BackupOptions,
        config: &ConnectionConfig,
        db_name: &str,
    ) -> Result<String, String> {
        Self::emit_log(
            app_handle,
            "info",
            &format!("Gerando comando nativo T-SQL BACKUP DATABASE [{}]", db_name),
            Some(30),
            false,
            true,
        );

        let detected = ServiceDetector::detect_mssql();
        let sqlcmd_path = options
            .custom_tool_path
            .clone()
            .or_else(|| detected.tools.get("sqlcmd").cloned());

        let host = config.host.as_deref().unwrap_or("localhost");
        let user = config.user.as_deref().unwrap_or("sa");
        let pass = config.password.as_deref().unwrap_or("");

        let tsql = format!(
            "BACKUP DATABASE [{}] TO DISK = N'{}' WITH FORMAT, INIT, STATS = 10",
            db_name,
            options.output_path.replace('\'', "''")
        );

        if let Some(sqlcmd) = sqlcmd_path {
            Self::emit_log(
                app_handle,
                "info",
                &format!("Executando via sqlcmd: {}", sqlcmd),
                Some(50),
                false,
                true,
            );

            let mut cmd = tokio::process::Command::new(&sqlcmd);
            cmd.arg("-S").arg(host);
            if config.auth_type.as_deref() == Some("windows") {
                cmd.arg("-E");
            } else {
                cmd.arg("-U").arg(user).arg("-P").arg(pass);
            }
            cmd.arg("-Q").arg(&tsql);

            let output = cmd.output().await.map_err(|e| format!("Falha ao invocar sqlcmd: {}", e))?;
            let stdout_str = String::from_utf8_lossy(&output.stdout);
            Self::emit_log(app_handle, "stdout", &stdout_str, Some(90), false, true);

            if output.status.success() {
                Self::emit_log(
                    app_handle,
                    "info",
                    &format!("Backup SQL Server gravado com sucesso em: {}", options.output_path),
                    Some(100),
                    true,
                    true,
                );
                return Ok(options.output_path.clone());
            }
        }

        // Fallback: salvar script T-SQL gerado
        let mut file = File::create(&options.output_path).map_err(|e| e.to_string())?;
        file.write_all(tsql.as_bytes()).map_err(|e| e.to_string())?;

        Self::emit_log(
            app_handle,
            "info",
            &format!("Script T-SQL de backup gerado em: {}", options.output_path),
            Some(100),
            true,
            true,
        );
        Ok(options.output_path.clone())
    }

    async fn restore_mssql(
        app_handle: &AppHandle,
        options: &RestoreOptions,
        config: &ConnectionConfig,
        db_name: &str,
    ) -> Result<String, String> {
        let tsql = format!(
            "RESTORE DATABASE [{}] FROM DISK = N'{}' WITH REPLACE, RECOVERY, STATS = 10",
            db_name,
            options.input_path.replace('\'', "''")
        );

        Self::emit_restore_log(
            app_handle,
            "info",
            &format!("Executando restauração T-SQL: {}", tsql),
            Some(40),
            false,
            true,
        );

        let detected = ServiceDetector::detect_mssql();
        if let Some(sqlcmd) = detected.tools.get("sqlcmd") {
            let host = config.host.as_deref().unwrap_or("localhost");
            let user = config.user.as_deref().unwrap_or("sa");
            let pass = config.password.as_deref().unwrap_or("");

            let mut cmd = tokio::process::Command::new(sqlcmd);
            cmd.arg("-S").arg(host);
            if config.auth_type.as_deref() == Some("windows") {
                cmd.arg("-E");
            } else {
                cmd.arg("-U").arg(user).arg("-P").arg(pass);
            }
            cmd.arg("-Q").arg(&tsql);

            let output = cmd.output().await.map_err(|e| format!("Erro no sqlcmd: {}", e))?;
            let stdout_str = String::from_utf8_lossy(&output.stdout);
            Self::emit_restore_log(app_handle, "stdout", &stdout_str, Some(90), false, true);

            if output.status.success() {
                Self::emit_restore_log(
                    app_handle,
                    "info",
                    &format!("Restauração SQL Server finalizada em [{}]", db_name),
                    Some(100),
                    true,
                    true,
                );
                return Ok("Restauração concluída".to_string());
            }
        }

        Err("sqlcmd não encontrado para executar a restauração do banco SQL Server.".to_string())
    }

    // --- SQLite Implementation (Atomic Online Backup) ---

    async fn backup_sqlite(
        app_handle: &AppHandle,
        options: &BackupOptions,
        config: &ConnectionConfig,
    ) -> Result<String, String> {
        let src_path = config
            .file_path
            .as_deref()
            .ok_or_else(|| "Caminho do arquivo SQLite não informado na conexão.".to_string())?;

        Self::emit_log(
            app_handle,
            "info",
            &format!("Iniciando Backup Atômico SQLite de '{}'", src_path),
            Some(30),
            false,
            true,
        );

        let src_p = src_path.to_string();
        let dst_p = options.output_path.clone();

        tokio::task::spawn_blocking(move || {
            let src_conn = rusqlite::Connection::open(&src_p).map_err(|e| e.to_string())?;
            let mut dst_conn = rusqlite::Connection::open(&dst_p).map_err(|e| e.to_string())?;

            let backup = rusqlite::backup::Backup::new(&src_conn, &mut dst_conn)
                .map_err(|e| format!("Falha ao inicializar Rusqlite Backup: {}", e))?;

            backup
                .run_to_completion(100, std::time::Duration::from_millis(50), None)
                .map_err(|e| format!("Falha durante snapshot SQLite: {}", e))?;

            Ok::<(), String>(())
        })
        .await
        .map_err(|e| e.to_string())??;

        Self::emit_log(
            app_handle,
            "info",
            &format!("Snapshot atômico SQLite gerado com sucesso em: {}", options.output_path),
            Some(100),
            true,
            true,
        );

        Ok(options.output_path.clone())
    }

    async fn restore_sqlite(
        app_handle: &AppHandle,
        options: &RestoreOptions,
        config: &ConnectionConfig,
    ) -> Result<String, String> {
        let dst_path = config
            .file_path
            .as_deref()
            .ok_or_else(|| "Caminho do arquivo SQLite de destino não informado.".to_string())?;

        Self::emit_restore_log(
            app_handle,
            "info",
            &format!("Restaurando banco SQLite de '{}' para '{}'", options.input_path, dst_path),
            Some(40),
            false,
            true,
        );

        std::fs::copy(&options.input_path, dst_path)
            .map_err(|e| format!("Falha ao copiar banco restaurado: {}", e))?;

        Self::emit_restore_log(
            app_handle,
            "info",
            "Banco SQLite restaurado com integridade total.",
            Some(100),
            true,
            true,
        );

        Ok("Restauração concluída".to_string())
    }

    // --- Firebird Implementation ---

    async fn backup_firebird(
        app_handle: &AppHandle,
        options: &BackupOptions,
        config: &ConnectionConfig,
        _db_name: &str,
    ) -> Result<String, String> {
        let db_path = config.file_path.as_deref().or(config.database.as_deref()).unwrap_or("");
        let user = config.user.as_deref().unwrap_or("SYSDBA");
        let pass = config.password.as_deref().unwrap_or("masterkey");

        let detected = ServiceDetector::detect_firebird();
        let gbak = options
            .custom_tool_path
            .clone()
            .or_else(|| detected.tools.get("gbak").cloned())
            .unwrap_or_else(|| "gbak".to_string());

        Self::emit_log(
            app_handle,
            "info",
            &format!("Executando gbak backup Firebird: {}", gbak),
            Some(20),
            false,
            true,
        );

        let mut cmd = tokio::process::Command::new(&gbak);
        cmd.arg("-b")
            .arg("-user").arg(user)
            .arg("-password").arg(pass)
            .arg("-v")
            .arg(db_path)
            .arg(&options.output_path);

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("Falha ao iniciar gbak: {}", e))?;
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        let app1 = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                Self::emit_log(&app1, "stdout", &line, None, false, true);
            }
        });

        let app2 = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                Self::emit_log(&app2, "stderr", &line, None, false, true);
            }
        });

        let status = child.wait().await.map_err(|e| e.to_string())?;
        if status.success() {
            Self::emit_log(app_handle, "info", &format!("Backup Firebird (.fbk) salvo em: {}", options.output_path), Some(100), true, true);
            Ok(options.output_path.clone())
        } else {
            Err(format!("gbak finalizou com código {:?}", status.code()))
        }
    }

    async fn restore_firebird(
        app_handle: &AppHandle,
        options: &RestoreOptions,
        config: &ConnectionConfig,
        _db_name: &str,
    ) -> Result<String, String> {
        let db_path = config.file_path.as_deref().or(config.database.as_deref()).unwrap_or("");
        let user = config.user.as_deref().unwrap_or("SYSDBA");
        let pass = config.password.as_deref().unwrap_or("masterkey");

        let detected = ServiceDetector::detect_firebird();
        let gbak = options
            .custom_tool_path
            .clone()
            .or_else(|| detected.tools.get("gbak").cloned())
            .unwrap_or_else(|| "gbak".to_string());

        Self::emit_restore_log(app_handle, "info", &format!("Iniciando gbak restore Firebird: {}", gbak), Some(20), false, true);

        let mut cmd = tokio::process::Command::new(&gbak);
        cmd.arg("-r")
            .arg("-user").arg(user)
            .arg("-password").arg(pass)
            .arg("-v")
            .arg(&options.input_path)
            .arg(db_path);

        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd.spawn().map_err(|e| format!("Falha ao iniciar gbak: {}", e))?;
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        let app1 = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                Self::emit_restore_log(&app1, "stdout", &line, None, false, true);
            }
        });

        let app2 = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                Self::emit_restore_log(&app2, "stderr", &line, None, false, true);
            }
        });

        let status = child.wait().await.map_err(|e| e.to_string())?;
        if status.success() {
            Self::emit_restore_log(app_handle, "info", "Restauração Firebird (.fdb) concluída com sucesso.", Some(100), true, true);
            Ok("Restauração concluída".to_string())
        } else {
            Err(format!("gbak finalizou com código {:?}", status.code()))
        }
    }

    // --- Legacy Databases (Paradox, DBF, Access, NexusDB) ---

    async fn backup_legacy(
        app_handle: &AppHandle,
        options: &BackupOptions,
        config: &ConnectionConfig,
    ) -> Result<String, String> {
        let target_dir_or_file = config
            .directory_path
            .as_deref()
            .or(config.file_path.as_deref())
            .ok_or_else(|| "Caminho de pasta ou arquivo da base legada não informado.".to_string())?;

        Self::emit_log(
            app_handle,
            "info",
            &format!("Criando pacote de backup para banco legado: {}", target_dir_or_file),
            Some(30),
            false,
            true,
        );

        let p = Path::new(target_dir_or_file);
        let out_zip = &options.output_path;

        let ps_cmd = if p.is_dir() {
            format!(
                "Compress-Archive -Path '{}/*' -DestinationPath '{}' -Force",
                target_dir_or_file.replace('\\', "/"),
                out_zip.replace('\\', "/")
            )
        } else {
            // Include sidecar files (e.g. .mb, .px for Paradox; .fpt, .cdx for DBF)
            let stem = p.file_stem().unwrap_or_default().to_string_lossy();
            let parent = p.parent().unwrap_or(Path::new(".")).to_string_lossy().replace('\\', "/");
            format!(
                "Compress-Archive -Path '{}/{}*.*' -DestinationPath '{}' -Force",
                parent, stem, out_zip.replace('\\', "/")
            )
        };

        let output = tokio::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_cmd])
            .output()
            .await
            .map_err(|e| format!("Falha ao compactar arquivos legados: {}", e))?;

        if output.status.success() {
            Self::emit_log(
                app_handle,
                "info",
                &format!("Pacote de backup legado gerado com sucesso em: {}", out_zip),
                Some(100),
                true,
                true,
            );
            Ok(out_zip.clone())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("Falha ao gerar arquivo compactado: {}", err))
        }
    }

    async fn restore_legacy(
        app_handle: &AppHandle,
        options: &RestoreOptions,
        config: &ConnectionConfig,
    ) -> Result<String, String> {
        let dest_dir = config
            .directory_path
            .as_deref()
            .or_else(|| {
                config.file_path.as_deref().and_then(|p| Path::new(p).parent()?.to_str())
            })
            .ok_or_else(|| "Diretório de destino para restauração legada não identificado.".to_string())?;

        Self::emit_restore_log(
            app_handle,
            "info",
            &format!("Restaurando pacote '{}' para '{}'", options.input_path, dest_dir),
            Some(40),
            false,
            true,
        );

        let ps_cmd = format!(
            "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
            options.input_path.replace('\\', "/"),
            dest_dir.replace('\\', "/")
        );

        let output = tokio::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_cmd])
            .output()
            .await
            .map_err(|e| format!("Falha ao descompactar restauração: {}", e))?;

        if output.status.success() {
            Self::emit_restore_log(app_handle, "info", "Banco legado restaurado com sucesso.", Some(100), true, true);
            Ok("Restauração concluída".to_string())
        } else {
            let err = String::from_utf8_lossy(&output.stderr);
            Err(format!("Falha ao extrair pacote: {}", err))
        }
    }
}
