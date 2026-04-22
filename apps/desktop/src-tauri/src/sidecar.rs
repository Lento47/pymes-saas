use std::net::TcpStream;
use std::time::{Duration, Instant};
use std::thread;

/// Blocks until the API TCP port accepts connections or timeout elapses.
/// Returns true if the API became ready in time.
pub fn wait_for_api(port: u16, timeout_secs: u64) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    let deadline = Instant::now() + Duration::from_secs(timeout_secs);

    while Instant::now() < deadline {
        if TcpStream::connect(&addr).is_ok() {
            // Brief grace period for the HTTP server to finish binding
            thread::sleep(Duration::from_millis(300));
            return true;
        }
        thread::sleep(Duration::from_millis(500));
    }
    false
}
