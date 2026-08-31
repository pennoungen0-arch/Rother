use std::net::TcpStream;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::Manager;
use tauri_plugin_shell::ShellExt;

struct Sidecar(Mutex<Option<tauri_plugin_shell::process::Child>>);

fn port_ready(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn wait_for_sidecar(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if port_ready(port) {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    port_ready(port)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Sidecar(Mutex::new(None)))
        .setup(|app| {
            let port: u16 = 4632;

            if cfg!(debug_assertions) {
                return Ok(());
            }

            let resource_dir = app
                .path()
                .resource_dir()?;

            let app_data_dir = app
                .path()
                .app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir).ok();

            let data_dir = app_data_dir.join("rother-data");
            std::fs::create_dir_all(&data_dir).ok();

            let sidecar = app
                .shell()
                .sidecar("node")
                .expect("node sidecar binary not found in bundle")
                .args(["standalone/server.js"])
                .current_dir(&resource_dir)
                .env("PORT", port.to_string())
                .env("NODE_ENV", "production")
                .env("HOSTNAME", "127.0.0.1")
                .env("GBP_ROOT", resource_dir.join("rother-data").to_string_lossy().to_string())
                .env("ROTHER_DATA_DIR", data_dir.to_string_lossy().to_string());

            let (mut rx, child) = sidecar.spawn().expect("failed to spawn node sidecar");

            app.state::<Sidecar>()
                .0
                .lock()
                .unwrap()
                .replace(child);

            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                while let Some(event) = rx.blocking_recv() {
                    if let tauri_plugin_shell::process::Event::Terminated(_) = event {
                        break;
                    }
                }
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.hide();
                    std::process::exit(0);
                }
            });

            let navigate_handle = app.handle().clone();
            std::thread::spawn(move || {
                let ready = wait_for_sidecar(port, Duration::from_secs(30));
                if ready {
                    if let Some(window) = navigate_handle.get_webview_window("main") {
                        let _ = window.set_url(
                            &format!("http://127.0.0.1:{}/", port),
                        );
                    }
                }
            });

            let close_handle = app.handle().clone();
            app.listen_all("tauri://close-requested", move |_| {
                if let Some(window) = close_handle.get_webview_window("main") {
                    let state = close_handle.state::<Sidecar>();
                    let child = {
                        let mut guard = state.0.lock().unwrap();
                        guard.take()
                    };
                    if let Some(child) = child {
                        let _ = child.kill();
                    }
                    let _ = window.hide();
                }
                std::process::exit(0);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Rother desktop app");
}
