mod app_profile;
mod app_url;
mod deep_link;
mod updater;

use tauri::Manager;
use url::Url;

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
            if let Some(window) = app.get_webview_window("main") {
                let target = Url::parse(app_url::base_url())
                    .map_err(|error| tauri::Error::Anyhow(anyhow::anyhow!(error.to_string())))?;
                let _ = window.navigate(target);
            }
            deep_link::configure(app)?;
            if app_profile::updater_enabled() {
                updater::check_for_updates(app.handle().clone());
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
