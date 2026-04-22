use crate::app_url;
use tauri::{App, AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_deep_link::DeepLinkExt;
use url::Url;

pub fn configure<R: Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    #[cfg(desktop)]
    app.deep_link()
        .register("pymeshub")
        .map_err(|error| tauri::Error::Anyhow(anyhow::anyhow!(error.to_string())))?;

    let handle = app.handle().clone();
    app.deep_link().on_open_url(move |event| {
        for incoming in event.urls() {
            if let Err(error) = handle_deep_link(&handle, incoming.as_str()) {
                let _ = handle.emit("desktop://deep-link-error", error.to_string());
            }
        }
    });

    Ok(())
}

fn handle_deep_link<R: Runtime>(handle: &AppHandle<R>, raw_url: &str) -> tauri::Result<()> {
    let Ok(url) = Url::parse(raw_url) else {
        return Ok(());
    };

    if url.host_str() != Some("accept-invite") {
        return Ok(());
    }

    let token = url
        .query_pairs()
        .find(|(key, _)| key == "token")
        .map(|(_, value)| value.to_string());

    if let Some(token) = token {
        if let Some(window) = handle.get_webview_window("main") {
            let script = format!(
                "window.location.replace({});",
                serde_json::to_string(&app_url::accept_invite_url(&token)).unwrap()
            );
            let _ = window.eval(&script);
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }

    Ok(())
}
