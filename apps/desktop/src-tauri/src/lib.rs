mod app_profile;
mod app_url;
mod deep_link;
<<<<<<< Updated upstream
mod sidecar;
=======
mod enterprise_runtime;
>>>>>>> Stashed changes
mod updater;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build());

    if app_profile::updater_enabled() {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
<<<<<<< Updated upstream
            if app_profile::is_offline() {
                setup_offline(app)?;
            } else {
                setup_cloud(app)?;
            }

            deep_link::configure(app)?;

=======
            deep_link::configure(app)?;
            if app_profile::edition() == "enterprise" && app_url::is_local_target() {
                enterprise_runtime::boot(app.handle().clone());
            } else if let Some(window) = app.get_webview_window("main") {
                let target = Url::parse(app_url::base_url())
                    .map_err(|error| tauri::Error::Anyhow(anyhow::anyhow!(error.to_string())))?;
                let _ = window.navigate(target);
            }
>>>>>>> Stashed changes
            if app_profile::updater_enabled() {
                updater::check_for_updates(app.handle().clone());
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_offline(app: &mut tauri::App) -> tauri::Result<()> {
    use tauri_plugin_shell::ShellExt;

    let data_dir = app
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| std::env::temp_dir().to_string_lossy().to_string());

    let storage_dir = format!("{}/storage", data_dir);
    std::fs::create_dir_all(&data_dir).ok();
    std::fs::create_dir_all(&storage_dir).ok();

    let resource_dir = app
        .path()
        .resource_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let engine_path = format!("{}/libquery_engine-windows.dll.node", resource_dir);
    let jwt_secret = get_or_create_jwt_secret(app);

    let sidecar_cmd = app
        .shell()
        .sidecar("api")
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!(e.to_string())))?
        .env("PORT", "4000")
        .env("DATABASE_URL", format!("file:{}/pymeshub.db", data_dir))
        .env("JWT_SECRET", jwt_secret)
        .env(
            "CORS_ORIGIN",
            "http://tauri.localhost,tauri://localhost,http://localhost:5000,http://127.0.0.1:5000",
        )
        .env("STORAGE_MODE", "local")
        .env("LOCAL_STORAGE_DIR", &storage_dir)
        .env("PRISMA_QUERY_ENGINE_LIBRARY_PATH", &engine_path)
        .env("PYMESHUB_OFFLINE", "true");

    let (_rx, child) = sidecar_cmd
        .spawn()
        .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!("Failed to start API: {}", e)))?;

    app.manage(child);

    if !sidecar::wait_for_api(4000, 30) {
        return Err(tauri::Error::Anyhow(anyhow::anyhow!(
            "API did not start within 30 seconds"
        )));
    }

    Ok(())
}

fn setup_cloud(app: &mut tauri::App) -> tauri::Result<()> {
    use url::Url;

    if let Some(window) = app.get_webview_window("main") {
        let target = Url::parse(app_url::base_url())
            .map_err(|e| tauri::Error::Anyhow(anyhow::anyhow!(e.to_string())))?;
        let _ = window.navigate(target);
    }
    Ok(())
}

fn get_or_create_jwt_secret(app: &tauri::App) -> String {
    use tauri_plugin_store::StoreExt;

    if let Ok(store) = app.store("enterprise.json") {
        if let Some(val) = store.get("jwt_secret") {
            if let Some(s) = val.as_str() {
                return s.to_string();
            }
        }
        let secret = generate_secret();
        let _ = store.set("jwt_secret", secret.clone());
        let _ = store.save();
        return secret;
    }
    generate_secret()
}

fn generate_secret() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("pymeshub-enterprise-{:x}", ts)
}
