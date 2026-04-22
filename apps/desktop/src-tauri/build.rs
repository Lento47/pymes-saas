fn main() {
    println!("cargo:rerun-if-env-changed=PYMESHUB_REMOTE_URL");
    println!("cargo:rerun-if-changed=../../.enterprise-runtime-release");
    tauri_build::build()
}
