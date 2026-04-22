pub fn edition() -> &'static str {
    match option_env!("PYMESHUB_EDITION") {
        Some("enterprise") => "enterprise",
        _ => "cloud",
    }
}

pub fn is_offline() -> bool {
    edition() == "enterprise"
}

pub fn updater_enabled() -> bool {
    match option_env!("PYMESHUB_UPDATER_ACTIVE") {
        Some("false") | Some("0") => false,
        Some("true") | Some("1") => true,
        _ => edition() == "cloud",
    }
}
