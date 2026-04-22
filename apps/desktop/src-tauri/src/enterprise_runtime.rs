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

const API_PORT: u16 = 4000;
const WEB_PORT: u16 = 5000;
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

    if !node_path.exists() {
        return Err(anyhow!("Falta node.exe dentro del runtime empaquetado"));
    }

    let paths = ensure_runtime_paths()?;
    emit_status(
        &app,
        "starting",
        "Preparando runtime local de Pymeshub Enterprise...",
        &paths,
    );

    write_env_files(&runtime_root, &paths)?;

    if !port_is_open(API_PORT) {
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

    wait_for_port(API_PORT, "API local")?;

    if !port_is_open(WEB_PORT) {
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

    wait_for_port(WEB_PORT, "frontend local")?;

    let target = Url::parse(crate::app_url::base_url())
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

fn runtime_root() -> PathBuf {
    if let Some(program_data) = env::var_os("PROGRAMDATA") {
        let program_data_root = PathBuf::from(program_data).join("Pymeshub");
        if fs::create_dir_all(&program_data_root).is_ok() {
            return program_data_root;
        }
    }

    if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
        return PathBuf::from(local_app_data).join("Pymeshub");
    }

    PathBuf::from(r"C:\ProgramData\Pymeshub")
}

fn write_env_files(runtime_root: &Path, paths: &RuntimePaths) -> Result<()> {
    let template_path = runtime_root.join(".env.enterprise.example");
    let mut api_env = if paths.config_file.exists() {
        read_env_file(&paths.config_file)?
    } else if template_path.exists() {
        read_env_file(&template_path)?
    } else {
        BTreeMap::new()
    };

    api_env.insert("NODE_ENV".into(), "production".into());
    api_env.insert("PORT".into(), API_PORT.to_string());
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
        normalized_runtime_path(&prisma_engines_dir.join(if cfg!(windows) {
            "schema-engine-windows.exe"
        } else {
            "schema-engine"
        })),
    );
    api_env.insert(
        "PRISMA_QUERY_ENGINE_LIBRARY".into(),
        normalized_runtime_path(&prisma_engines_dir.join(if cfg!(windows) {
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
        "http://127.0.0.1:5000,http://localhost:5000".into(),
    );
    write_env_file(&paths.config_file, &api_env)?;

    let mut web_env = if paths.web_env_file.exists() {
        read_env_file(&paths.web_env_file)?
    } else {
        BTreeMap::new()
    };
    web_env.insert("NODE_ENV".into(), "production".into());
    web_env.insert("PORT".into(), WEB_PORT.to_string());
    web_env.insert("API_PROXY_TARGET".into(), format!("http://127.0.0.1:{API_PORT}"));
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
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .with_context(|| format!("No se pudo abrir el log {}", path.display()))
}

fn wait_for_port(port: u16, label: &str) -> Result<()> {
    for _ in 0..50 {
        if port_is_open(port) {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(500));
    }

    Err(anyhow!(
        "El {label} no quedo disponible en localhost:{port}. Revisa los logs del runtime local."
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
    use std::time::{SystemTime, UNIX_EPOCH};

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);

    format!("pymeshub-enterprise-{ts:x}")
}

fn normalized_runtime_path(path: &Path) -> String {
    path.to_string_lossy().replace("\\\\?\\", "")
}

fn sqlite_database_url(path: &Path) -> String {
    format!("file:{}", normalized_runtime_path(path).replace('\\', "/"))
}
