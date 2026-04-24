fn main() {
    println!("cargo:rerun-if-env-changed=PYMESHUB_REMOTE_URL");
    tauri_build::build()
}
