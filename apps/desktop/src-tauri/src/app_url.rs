pub fn base_url() -> &'static str {
    match option_env!("PYMESHUB_REMOTE_URL") {
        Some(url) => url,
        None => "http://127.0.0.1:5000",
    }
}

pub fn accept_invite_url(token: &str) -> String {
    format!("{}/#/accept-invite?token={token}", base_url().trim_end_matches('/'))
}
