pub fn base_url() -> &'static str {
    match option_env!("PYMESHUB_REMOTE_URL") {
        Some(url) => url,
        None => "http://127.0.0.1:5000",
    }
}

pub fn is_offline() -> bool {
    matches!(option_env!("PYMESHUB_EDITION"), Some("enterprise"))
}

pub fn accept_invite_url(token: &str) -> String {
    if is_offline() {
        // Tauri serves frontend locally; use hash route only
        format!("/#/accept-invite?token={token}")
    } else {
        format!("{}/#/accept-invite?token={token}", base_url().trim_end_matches('/'))
    }
}
