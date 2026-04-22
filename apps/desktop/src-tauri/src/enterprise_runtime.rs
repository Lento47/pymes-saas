use std::{
    collections::BTreeMap,
    env,
    fs::{self, File, OpenOptions},
    io::{BufRead, BufReader, Write},
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::Duration,
};

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use url::Url;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const DEFAULT_API_PORT: u16 = 4000;
const DEFAULT_WEB_PORT: u16 = 5000;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Clone, Serialize)]
struct RuntimeStatusPayload {
    stage: String,
    message: String,
    config_path: String,
    log_path: String,
}

struct RuntimePaths {
    config_dir: PathBuf,
    data_dir: PathBuf,
    logs_dir: PathBuf,
    config_file: PathBuf,
    web_env_file: PathBuf,
}

pub fn boot(app: AppHandle) {
    thread::spawn(move || {
        if let Err(error) = boot_inner(app.clone()) {
            let message = format!("{error:#}");
            let root = runtime_root();
            let payload = RuntimeStatusPayload {
                stage: "error".into(),
                message,
                config_path: root.join("config").display().to_string(),
                log_path: root.join("logs").display().to_string(),
            };
            let _ = app.emit("desktop://enterprise-runtime-error", payload);
        }
    });
}

fn boot_inner(app: AppHandle) -> Result<()> {
    let runtime_root = app
        .path()
        .resource_dir()
        .context("No se pudo resolver la carpeta de recursos del instalador")?
        .join("enterprise-runtime");

    let node_path = runtime_root
        .join("n")
        .join(if cfg!(windows) { "node.exe" } else { "node" });
    let api_dir = runtime_root.join("a");
    let web_dir = runtime_root.join("w");

    // Pre-flight validation
    validate_runtime_bundle(&runtime_root, &node_path, &api_dir, &web_dir)?;

    if !node_path.exists() {
        return Err(anyhow!("Falta node.exe dentro del runtime empaquetado"));
    }

    let paths = ensure_runtime_paths()?;

    // Load custom port configuration if available
    let (api_port, web_port) = load_port_configuration(&paths);

    emit_status(
        &app,
        "starting",
        "Preparando runtime local de Pymeshub Enterprise...",
        &paths,
    );

    write_env_files(&runtime_root, &paths, api_port, web_port)?;

    if !port_is_open(api_port) {
        emit_status(
            &app,
            "starting",
            "Inicializando la base local y arrancando el API...",
            &paths,
        );
        initialize_local_database(&node_path, &api_dir, &paths)?;
        spawn_api(&node_path, &api_dir, &paths)?;
    } else {
        emit_status(
            &app,
            "starting",
            "El API local ya estaba corriendo. Reutilizando la instancia activa...",
            &paths,
        );
    }

    wait_for_port(api_port, "API local")?;

    if !port_is_open(web_port) {
        emit_status(
            &app,
            "starting",
            "Arrancando el frontend local de Enterprise...",
            &paths,
        );
        spawn_web(&node_path, &web_dir, &paths)?;
    } else {
        emit_status(
            &app,
            "starting",
            "El frontend local ya estaba corriendo. Reutilizando la instancia activa...",
            &paths,
        );
    }

    wait_for_port(web_port, "frontend local")?;

    // Check if setup is complete
    let setup_url = if is_first_setup(&paths)? {
        eprintln!("First setup detected, redirecting to setup wizard");
        "http://localhost:5000/#/setup".to_string()
    } else {
        crate::app_url::base_url().to_string()
    };

    let target = Url::parse(&setup_url)
        .map_err(|error| anyhow!("La URL base de Enterprise no es valida: {error}"))?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.navigate(target);
    }

    emit_status(
        &app,
        "ready",
        "Servidor local listo. Abriendo Pymeshub Enterprise...",
        &paths,
    );

    Ok(())
}

fn validate_runtime_bundle(
    runtime_root: &Path,
    node_path: &Path,
    api_dir: &Path,
    web_dir: &Path,
) -> Result<()> {
    let required_files = [
        (node_path, "Node.js executable"),
        (&api_dir.join("dist").join("src").join("main.js"), "API entrypoint"),
        (&api_dir.join("schema.sql"), "Database schema"),
        (&api_dir.join("prisma").join("schema.prisma"), "Prisma schema"),
        (&web_dir.join("dist").join("index.cjs"), "Web server entrypoint"),
    ];

    let mut missing = Vec::new();

    for (path, description) in required_files.iter() {
        if !path.exists() {
            missing.push(format!("{}: {}", description, path.display()));
            eprintln!("✗ Missing: {} ({})", description, path.display());
        } else {
            eprintln!("✓ Found: {} ({})", description, path.display());
        }
    }

    // Check Prisma engines
    let prisma_engines_dir = api_dir
        .join("node_modules")
        .join("prisma")
        .join("node_modules")
        .join("@prisma")
        .join("engines");

    if !prisma_engines_dir.exists() {
        missing.push(format!(
            "Prisma engines directory: {}",
            prisma_engines_dir.display()
        ));
        eprintln!("✗ Missing Prisma engines directory: {}", prisma_engines_dir.display());
    } else {
        eprintln!("✓ Found Prisma engines directory");
    }

    if !missing.is_empty() {
        return Err(anyhow!(
            "Runtime bundle validation failed. Missing files:\n{}\n\nEnsure you ran: ./scripts/build-enterprise-bundle.sh && cp -r .enterprise-runtime-bundle/* apps/desktop/src-tauri/resources/enterprise-runtime/",
            missing.join("\n")
        ));
    }

    eprintln!("✓ All required files validated");
    Ok(())
}

fn ensure_runtime_paths() -> Result<RuntimePaths> {
    let root = runtime_root();
    let config_dir = root.join("config");
    let data_dir = root.join("data");
    let logs_dir = root.join("logs");
    let backups_dir = root.join("backups");

    for path in [
        &config_dir,
        &logs_dir,
        &backups_dir,
        &data_dir,
        &data_dir.join("documents"),
        &data_dir.join("attachments"),
        &data_dir.join("invoices").join("pdf"),
        &data_dir.join("invoices").join("xml"),
        &data_dir.join("exports"),
        &data_dir.join("imports"),
        &data_dir.join("derived"),
        &data_dir.join("temp"),
    ] {
        fs::create_dir_all(path)
            .with_context(|| format!("No se pudo crear la carpeta {}", path.display()))?;
    }

    let probe_path = logs_dir.join("bootstrap.probe");
    File::create(&probe_path)
        .with_context(|| format!("No se pudo escribir en {}", logs_dir.display()))?;
    let _ = fs::remove_file(&probe_path);

    Ok(RuntimePaths {
        config_dir: config_dir.clone(),
        data_dir,
        logs_dir,
        config_file: config_dir.join("enterprise-api.env"),
        web_env_file: config_dir.join("enterprise-web.env"),
    })
}

fn validate_path_length(path: &std::path::Path) -> Result<()> {
    let path_str = path.to_string_lossy();
    if path_str.len() > 260 {
        return Err(format!(
            "Path exceeds 260 characters ({}): {}. Use long path support (\\\\?\\) or shorten path.",
            path_str.len(),
            path_str
        )
        .into());
    }
    Ok(())
}

fn runtime_root() -> PathBuf {
    // Try PROGRAMDATA first (requires admin on some systems)
    if let Some(program_data) = env::var_os("PROGRAMDATA") {
        let program_data_root = PathBuf::from(program_data).join("Pymeshub");
        if validate_path_length(&program_data_root).is_ok() {
            match fs::create_dir_all(&program_data_root) {
                Ok(_) => {
                    eprintln!("Using PROGRAMDATA: {}", program_data_root.display());
                    return program_data_root;
                }
                Err(e) => {
                    eprintln!("Warning: Cannot write to PROGRAMDATA: {}", e);
                }
            }
        } else {
            eprintln!("Warning: PROGRAMDATA path too long, skipping");
        }
    }

    // Try LOCALAPPDATA (user-writable, always available on Windows)
    if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
        let local_root = PathBuf::from(local_app_data).join("Pymeshub");
        if validate_path_length(&local_root).is_ok() {
            match fs::create_dir_all(&local_root) {
                Ok(_) => {
                    eprintln!("Using LOCALAPPDATA: {}", local_root.display());
                    return local_root;
                }
                Err(e) => {
                    eprintln!("Warning: Cannot write to LOCALAPPDATA: {}", e);
                }
            }
        } else {
            eprintln!("Warning: LOCALAPPDATA path too long, skipping");
        }
    }

    // Try USERPROFILE as fallback
    if let Ok(user_profile) = env::var("USERPROFILE") {
        let user_root = PathBuf::from(user_profile)
            .join("AppData")
            .join("Local")
            .join("Pymeshub");
        if validate_path_length(&user_root).is_ok() {
            match fs::create_dir_all(&user_root) {
                Ok(_) => {
                    eprintln!("Using USERPROFILE: {}", user_root.display());
                    return user_root;
                }
                Err(e) => {
                    eprintln!("Warning: Cannot write to USERPROFILE: {}", e);
                }
            }
        } else {
            eprintln!("Warning: USERPROFILE path too long, skipping");
        }
    }

    eprintln!("ERROR: No suitable runtime directory found. PROGRAMDATA, LOCALAPPDATA, and USERPROFILE all failed or path is too long.");
    eprintln!("Please set PYMESHUB_RUNTIME_DIR environment variable or ensure LOCALAPPDATA is accessible.");
    panic!("Cannot find suitable runtime directory. Installation may be corrupted.");
}

fn write_env_files(runtime_root: &Path, paths: &RuntimePaths, api_port: u16, web_port: u16) -> Result<()> {
    let template_path = runtime_root.join(".env.enterprise.example");
    let mut api_env = if paths.config_file.exists() {
        read_env_file(&paths.config_file)?
    } else if template_path.exists() {
        read_env_file(&template_path)?
    } else {
        BTreeMap::new()
    };

    api_env.insert("NODE_ENV".into(), "production".into());
    api_env.insert("PORT".into(), api_port.to_string());
    api_env.insert("PYMESHUB_EDITION".into(), "enterprise".into());
    api_env.insert("PYMESHUB_STORAGE_MODE".into(), "local".into());
    api_env.insert(
        "DATABASE_URL".into(),
        sqlite_database_url(&paths.data_dir.join("pymeshub.db")),
    );
    api_env.insert(
        "PYMESHUB_STORAGE_ROOT".into(),
        normalized_runtime_path(&paths.data_dir),
    );
    let prisma_engines_dir = runtime_root
        .join("a")
        .join("node_modules")
        .join("prisma")
        .join("node_modules")
        .join("@prisma")
        .join("engines");
    api_env.insert(
        "PRISMA_SCHEMA_ENGINE_BINARY".into(),
        normalized_prisma_engine_path(&prisma_engines_dir.join(if cfg!(windows) {
            "schema-engine-windows.exe"
        } else {
            "schema-engine"
        })),
    );
    api_env.insert(
        "PRISMA_QUERY_ENGINE_LIBRARY".into(),
        normalized_prisma_engine_path(&prisma_engines_dir.join(if cfg!(windows) {
            "query_engine-windows.dll.node"
        } else {
            "libquery_engine.so.node"
        })),
    );
    if api_env
        .get("JWT_SECRET")
        .map(|value| value.trim().is_empty() || value == "replace-with-a-long-random-secret")
        .unwrap_or(true)
    {
        api_env.insert("JWT_SECRET".into(), generate_secret());
    }
    api_env.insert(
        "CORS_ORIGIN".into(),
        "http://127.0.0.1:5000,http://localhost:5000,http://[::1]:5000".into(),
    );
    write_env_file(&paths.config_file, &api_env)?;

    let mut web_env = if paths.web_env_file.exists() {
        read_env_file(&paths.web_env_file)?
    } else {
        BTreeMap::new()
    };
    web_env.insert("NODE_ENV".into(), "production".into());
    web_env.insert("PORT".into(), web_port.to_string());
    web_env.insert("API_PROXY_TARGET".into(), format!("http://127.0.0.1:{}", api_port));
    write_env_file(&paths.web_env_file, &web_env)?;

    Ok(())
}

fn read_env_file(path: &Path) -> Result<BTreeMap<String, String>> {
    let file = File::open(path)
        .with_context(|| format!("No se pudo abrir el archivo de config {}", path.display()))?;
    let reader = BufReader::new(file);
    let mut values = BTreeMap::new();

    for line in reader.lines() {
        let line = line?;
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            values.insert(key.trim().into(), value.trim().into());
        }
    }

    Ok(values)
}

fn write_env_file(path: &Path, values: &BTreeMap<String, String>) -> Result<()> {
    let mut file = File::create(path)
        .with_context(|| format!("No se pudo escribir el archivo {}", path.display()))?;
    for (key, value) in values {
        writeln!(file, "{key}={value}")?;
    }
    Ok(())
}

fn initialize_local_database(node_path: &Path, api_dir: &Path, paths: &RuntimePaths) -> Result<()> {
    let database_path = paths.data_dir.join("pymeshub.db");
    if database_path.exists() && fs::metadata(&database_path)?.len() > 0 {
        return Ok(());
    }

    let prisma_cli = api_dir
        .join("node_modules")
        .join("prisma")
        .join("build")
        .join("index.js");
    if !prisma_cli.exists() {
        return Err(anyhow!(
            "No se encontro prisma CLI dentro del runtime enterprise empaquetado"
        ));
    }
    let schema_file = api_dir.join("schema.sql");
    if !schema_file.exists() {
        return Err(anyhow!(
            "No se encontro schema.sql dentro del runtime enterprise empaquetado"
        ));
    }
    let prisma_schema = api_dir.join("prisma").join("schema.prisma");
    if !prisma_schema.exists() {
        return Err(anyhow!(
            "No se encontro prisma/schema.prisma dentro del runtime enterprise empaquetado"
        ));
    }

    let log_file = open_log(paths.logs_dir.join("prisma.log"))?;
    let log_file_error = log_file.try_clone()?;

    let mut command = Command::new(node_path);
    command
        .arg(prisma_cli)
        .arg("db")
        .arg("execute")
        .arg("--file")
        .arg(schema_file)
        .arg("--schema")
        .arg(prisma_schema)
        .current_dir(api_dir)
        .envs(read_env_file(&paths.config_file)?)
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_file_error));
    hide_console(&mut command);

    let status = command
        .status()
        .context("No se pudo inicializar la base local de Prisma")?;

    if !status.success() {
        return Err(anyhow!(
            "La inicializacion de la base local fallo. Revisa prisma.log en {}",
            paths.logs_dir.display()
        ));
    }

    Ok(())
}

fn spawn_api(node_path: &Path, api_dir: &Path, paths: &RuntimePaths) -> Result<()> {
    let stdout_log = open_log(paths.logs_dir.join("api.out.log"))?;
    let stderr_log = open_log(paths.logs_dir.join("api.err.log"))?;

    let mut command = Command::new(node_path);
    command
        .arg("dist/src/main.js")
        .current_dir(api_dir)
        .envs(read_env_file(&paths.config_file)?)
        .stdout(Stdio::from(stdout_log))
        .stderr(Stdio::from(stderr_log));
    hide_console(&mut command);

    command
        .spawn()
        .context("No se pudo arrancar el API local de Enterprise")?;
    Ok(())
}

fn spawn_web(node_path: &Path, web_dir: &Path, paths: &RuntimePaths) -> Result<()> {
    let stdout_log = open_log(paths.logs_dir.join("web.out.log"))?;
    let stderr_log = open_log(paths.logs_dir.join("web.err.log"))?;

    let mut command = Command::new(node_path);
    command
        .arg("dist/index.cjs")
        .current_dir(web_dir)
        .envs(read_env_file(&paths.web_env_file)?)
        .stdout(Stdio::from(stdout_log))
        .stderr(Stdio::from(stderr_log));
    hide_console(&mut command);

    command
        .spawn()
        .context("No se pudo arrancar el frontend local de Enterprise")?;
    Ok(())
}

fn open_log(path: PathBuf) -> Result<File> {
    let mut opts = OpenOptions::new();
    opts.create(true).append(true);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::OpenOptionsExt;
        opts.share_mode(3); // FILE_SHARE_READ | FILE_SHARE_WRITE = 0x03
    }

    opts.open(&path)
        .with_context(|| format!("No se pudo abrir el log {}", path.display()))
}

fn wait_for_port(port: u16, label: &str) -> Result<()> {
    const MAX_ATTEMPTS: usize = 100; // ~50 seconds
    const INTERVAL_MS: u64 = 500;

    for attempt in 1..=MAX_ATTEMPTS {
        if port_is_open(port) {
            if attempt > 1 {
                eprintln!("✓ {label} available on port {port} (attempt {attempt})");
            }
            return Ok(());
        }

        if attempt == 10 {
            eprintln!("⏳ Waiting for {label} to start... (this may take a moment)");
        }

        if attempt == 50 {
            eprintln!("⚠ Still waiting for {label}... (attempt {attempt}/{MAX_ATTEMPTS})");
        }

        thread::sleep(Duration::from_millis(INTERVAL_MS));
    }

    Err(anyhow!(
        "El {label} no quedo disponible en localhost:{port} despues de {MAX_ATTEMPTS} intentos (~50s). \
         Revisa los logs del runtime local en C:\\ProgramData\\Pymeshub\\logs\\ o %APPDATA%\\Pymeshub\\logs\\"
    ))
}

fn port_is_open(port: u16) -> bool {
    let Ok(address) = format!("127.0.0.1:{port}").parse::<SocketAddr>() else {
        return false;
    };

    TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok()
}

fn emit_status(app: &AppHandle, stage: &str, message: &str, paths: &RuntimePaths) {
    let payload = RuntimeStatusPayload {
        stage: stage.into(),
        message: message.into(),
        config_path: paths.config_dir.display().to_string(),
        log_path: paths.logs_dir.display().to_string(),
    };
    let _ = app.emit("desktop://enterprise-runtime-status", payload);
}

fn hide_console(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
}

fn generate_secret() -> String {
    use rand::RngCore;

    let mut rng = rand::thread_rng();
    let mut bytes = [0u8; 32];
    rng.fill_bytes(&mut bytes);

    format!("{}",
        bytes
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<String>()
    )
}

fn is_first_setup(paths: &RuntimePaths) -> Result<bool> {
    // Check if a setup flag file exists
    let setup_flag = paths.config_dir.join(".setup-complete");
    Ok(!setup_flag.exists())
}

fn load_port_configuration(paths: &RuntimePaths) -> (u16, u16) {
    let ports_env_path = paths.config_dir.join("ports.env");

    if !ports_env_path.exists() {
        return (DEFAULT_API_PORT, DEFAULT_WEB_PORT);
    }

    let mut api_port = DEFAULT_API_PORT;
    let mut web_port = DEFAULT_WEB_PORT;

    if let Ok(content) = fs::read_to_string(&ports_env_path) {
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("CUSTOM_API_PORT=") {
                if let Ok(port) = line.replace("CUSTOM_API_PORT=", "").parse::<u16>() {
                    api_port = port;
                }
            } else if line.starts_with("CUSTOM_WEB_PORT=") {
                if let Ok(port) = line.replace("CUSTOM_WEB_PORT=", "").parse::<u16>() {
                    web_port = port;
                }
            }
        }
    }

    eprintln!("Loaded port configuration: API={}, WEB={}", api_port, web_port);
    (api_port, web_port)
}

fn normalized_runtime_path(path: &Path) -> String {
    let s = path.to_string_lossy().to_string();
    // Remove Windows long path prefix if present
    if s.starts_with("\\\\?\\") {
        s[4..].to_string()
    } else {
        s
    }
}

fn normalized_prisma_engine_path(path: &Path) -> String {
    // Prisma engines require forward slashes and absolute paths
    normalized_runtime_path(path).replace('\\', "/")
}

fn sqlite_database_url(path: &Path) -> String {
    format!("file:{}", normalized_prisma_engine_path(path))
}
