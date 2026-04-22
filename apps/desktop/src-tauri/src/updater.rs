use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_updater::UpdaterExt;

pub fn check_for_updates<R: Runtime>(app: AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        let Ok(updater) = app.updater() else {
            return;
        };

        let Ok(Some(update)) = updater.check().await else {
            return;
        };
        let _ = app.emit("desktop://update-available", update.version.clone());
        let _ = update.download_and_install(|_, _| {}, || {}).await;
        let _ = app.restart();
    });
}
