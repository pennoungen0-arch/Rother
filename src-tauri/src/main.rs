use std::io::Write;
use std::net::TcpStream;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::Listener;
use tauri::Manager;
use tauri::Url;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

struct Sidecar(Mutex<Option<CommandChild>>);

fn find_free_port() -> u16 {
    use std::net::TcpListener;
    let listener = TcpListener::bind("127.0.0.1:0").expect("failed to bind to port");
    listener.local_addr().unwrap().port()
}

fn port_ready(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn wait_for_sidecar(port: u16, timeout: Duration, log_path: &std::path::Path) -> bool {
    let deadline = Instant::now() + timeout;
    let mut log = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .ok();
    while Instant::now() < deadline {
        if port_ready(port) {
            if let Some(ref mut f) = log {
                let elapsed = Instant::now().duration_since(deadline - timeout);
                let _ = writeln!(f, "[{:?}] Port {} is ready!", elapsed, port);
            }
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    if let Some(ref mut f) = log {
        let _ = writeln!(f, "[timeout] Port {} never became ready after {:?}", port, timeout);
    }
    port_ready(port)
}

fn log_msg(log_path: &std::path::Path, msg: &str) {
    let _ = std::fs::create_dir_all(log_path.parent().unwrap());
    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .and_then(|mut f| writeln!(f, "{}", msg));
    eprintln!("{}", msg);
}

fn first_run_scaffold(resource_dir: &std::path::Path, app_root: &std::path::Path) -> std::io::Result<()> {
    let gbp_root = app_root.join("gbp-monitor");
    let config_dir = gbp_root.join("config");
    let data_dir = gbp_root.join("data");
    std::fs::create_dir_all(&config_dir)?;
    std::fs::create_dir_all(&data_dir)?;

    // P2-F5: Validate that the GBP_ROOT path is writable. If the path
    // contains spaces, Unicode characters, or is read-only, fail early
    // with a clear error instead of silently failing later.
    let test_file = data_dir.join(".writability_test");
    std::fs::write(&test_file, "ok")?;
    let content = std::fs::read_to_string(&test_file)?;
    if content != "ok" {
        return Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("GBP_ROOT path not writable: {} — write/read mismatch", gbp_root.display()),
        ));
    }
    let _ = std::fs::remove_file(&test_file);

    let bundled_config = resource_dir.join("gbp-monitor/config");
    if bundled_config.exists() {
        for entry in std::fs::read_dir(&bundled_config)? {
            let entry = entry?;
            let dest = config_dir.join(entry.file_name());
            if !dest.exists() {
                if entry.file_type()?.is_file() {
                    std::fs::copy(entry.path(), &dest)?;
                } else if entry.file_type()?.is_dir() {
                    copy_dir_recursive(&entry.path(), &dest)?;
                }
            }
        }
    }

    // Copy Python source directories
    let python_dirs = ["orchestration", "harness", "parser", "storage", "notifications", "discovery", "tests", "docs"];
    for dir_name in &python_dirs {
        let bundled = resource_dir.join("gbp-monitor").join(dir_name);
        if bundled.exists() {
            let dest = gbp_root.join(dir_name);
            if !dest.exists() {
                copy_dir_recursive(&bundled, &dest)?;
            }
        }
    }

    // Ensure empty listings.json exists if not present
    let listings = config_dir.join("listings.json");
    if !listings.exists() {
        let example = config_dir.join("listings.example.json");
        if example.exists() {
            std::fs::copy(&example, &listings)?;
        } else {
            std::fs::write(&listings, "{\n  \"branches\": []\n}\n")?;
        }
    }

    // Ensure empty notifications.json exists
    let notifications = config_dir.join("notifications.json");
    if !notifications.exists() {
        let example = config_dir.join("notifications.example.json");
        if example.exists() {
            std::fs::copy(&example, &notifications)?;
        } else {
            std::fs::write(&notifications, "{\n  \"enabled\": false\n}\n")?;
        }
    }

    // Copy requirements.txt
    let bundled_reqs = resource_dir.join("gbp-monitor/requirements.txt");
    let dest_reqs = gbp_root.join("requirements.txt");
    if bundled_reqs.exists() && !dest_reqs.exists() {
        std::fs::copy(&bundled_reqs, &dest_reqs)?;
    }

    Ok(())
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

/// Kill a process and all its children by PID.
/// On Windows: uses `taskkill /T /F /PID <pid>` (kills entire process tree).
/// On POSIX: sends SIGTERM, waits briefly, then SIGKILL.
fn killProcessTreeByPid(pid: u32) {
    if pid == 0 { return; }
    if _IS_WIN_GLOBAL {
        // taskkill /T kills the process tree, /F is force-kill
        let cmd = format!("taskkill /T /F /PID {}", pid);
        let _ = exec_command(&cmd);
    } else {
        // POSIX: SIGTERM first for graceful shutdown, then SIGKILL
        let _ = (|| {
            let cmd = format!("kill -TERM -p {}", pid);
            let _ = exec_command(&cmd);
        })();
        std::thread::sleep(Duration::from_secs(2));
        let _ = (|| {
            let cmd = format!("kill -KILL -p {}", pid);
            let _ = exec_command(&cmd);
        })();
    }
}

fn exec_command(cmd: &str) -> Option<i32> {
    use std::process::Command;
    let result = if _IS_WIN_GLOBAL {
        Command::new("cmd").args(["/C", cmd]).status().ok()
    } else {
        Command::new("sh").arg("-c").arg(cmd).status().ok()
    };
    result.map(|s| s.code().unwrap_or(-1))
}

/// P2-F4: Kill the process listening on the given port.
///
/// On Windows: uses `netstat` to find the PID, then `taskkill /T /F /PID`
/// to kill the entire process tree (Y7 fix).
///
/// On Linux: uses `lsof -i :PORT -t` to find the PID, then `kill -TERM`
/// (graceful), then `kill -KILL` (forced) to kill the entire process tree.
/// Falls back to `ss -tlnp` if `lsof` is not installed.
fn kill_process_on_port(port: u16) -> bool {
    use std::process::Command;
    if _IS_WIN_GLOBAL {
        // netstat -ano | findstr :<port> | findstr LISTENING
        let netstat = Command::new("cmd")
            .args(["/C", &format!("netstat -ano | findstr :{} | findstr LISTENING", port)])
            .output();
        let output = match netstat {
            Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
            Err(_) => return false,
        };

        // Parse the PID from the last column of the netstat output.
        for line in output.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if let Some(pid_str) = parts.last() {
                if let Ok(pid) = pid_str.trim().parse::<u32>() {
                    if pid > 0 {
                        // Y7 fix (TAURI_AUDIT_2026-09-06): use /T to kill the
                        // entire process tree, matching killProcessTreeByPid.
                        // Without /T, children (Python scraper spawned by
                        // the Node sidecar) survive and hold the lock.
                        let _ = Command::new("cmd")
                            .args(["/C", &format!("taskkill /T /F /PID {}", pid)])
                            .status();
                        return true;
                    }
                }
            }
        }
        false
    } else {
        // Linux: prefer `lsof -i :PORT -t` (gives PIDs directly, one per line).
        // Fall back to `ss -tlnp` (parse `pid=` from the users column).
        let lsof_result = Command::new("lsof")
            .args(["-i", &format!(":{}", port), "-t"])
            .output();
        let pids: Vec<u32> = match lsof_result {
            Ok(o) => {
                let s = String::from_utf8_lossy(&o.stdout);
                s.lines()
                    .filter_map(|l| l.trim().parse::<u32>().ok())
                    .collect()
            }
            Err(_) => {
                // lsof not installed — try ss.
                let ss_result = Command::new("ss")
                    .args(["-tlnp", &format!("sport = :{}", port)])
                    .output();
                match ss_result {
                    Ok(o) => {
                        let s = String::from_utf8_lossy(&o.stdout);
                        // ss output: "LISTEN 0 128 *:<port> *:* users:((\"node\",pid=1234,fd=22)))"
                        // Parse pid=N from the users column.
                        s.lines()
                            .filter_map(|l| {
                                let after = l.split("pid=").nth(1)?;
                                after
                                    .chars()
                                    .take_while(|c| c.is_ascii_digit())
                                    .collect::<String>()
                                    .parse::<u32>()
                                    .ok()
                            })
                            .collect()
                    }
                    Err(_) => return false,
                }
            }
        };

        if pids.is_empty() {
            return false;
        }
        let mut killed = false;
        for pid in pids {
            // SIGTERM first (graceful), then SIGKILL (forced) after 500ms.
            let _ = Command::new("sh")
                .args(["-c", &format!("kill -TERM {} 2>/dev/null", pid)])
                .status();
            std::thread::sleep(Duration::from_millis(500));
            let _ = Command::new("sh")
                .args(["-c", &format!("kill -KILL {} 2>/dev/null", pid)])
                .status();
            killed = true;
        }
        killed
    }
}

const _IS_WIN_GLOBAL: bool = cfg!(target_os = "windows");

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Sidecar(Mutex::new(None)))
        .setup(|app| {
            let port: u16 = find_free_port();

            if cfg!(debug_assertions) {
                // In dev mode, log to stderr and use devUrl
                eprintln!("[rother-tauri] Dev mode — not starting sidecar");
                return Ok(());
            }

            // P2-F4: Only kill orphaned Rother sidecar processes, not ALL
            // node.exe processes. Killing all node.exe would crash other
            // Node.js applications (VS Code extensions, dev servers, etc.).
            // Instead, check if the target port is in use and kill only the
            // process occupying it.
            if _IS_WIN_GLOBAL {
                if port_ready(port) {
                    eprintln!("[rother-tauri] Port {} already in use — killing occupant", port);
                    let _ = kill_process_on_port(port);
                    std::thread::sleep(Duration::from_millis(500));
                }
            }

            let resource_dir = app
                .path()
                .resource_dir()?;

            let app_data_dir = app
                .path()
                .app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir).ok();

            let app_root = app_data_dir.join("rother");
            std::fs::create_dir_all(&app_root).ok();

            // GBP_ROOT aligns with dev mode: <project>/gbp-monitor/. In Tauri
            // prod this becomes <app_data>/rother/gbp-monitor. Python cwd is
            // <GBP_ROOT>, so config/listings.json and config/selectors.json
            // resolve to <GBP_ROOT>/config/*. ROTHER_DATA_DIR is set per-tenant
            // by the dashboard, but we pass the default <GBP_ROOT>/data here so
            // un-tenanted/fallback runs still land in the right place.
            let gbp_root = app_root.join("gbp-monitor");
            let data_dir = gbp_root.join("data");
            std::fs::create_dir_all(&data_dir).ok();

            let log_path = app_root.join("rother-tauri-startup.log");

            log_msg(&log_path, "=== Rother Tauri Startup ===");
            log_msg(&log_path, &format!("resource_dir: {}", resource_dir.display()));
            log_msg(&log_path, &format!("app_root: {}", app_root.display()));
            log_msg(&log_path, &format!("gbp_root: {}", gbp_root.display()));
            log_msg(&log_path, &format!("data_dir: {}", data_dir.display()));
            log_msg(&log_path, &format!("port: {}", port));

            // First-run scaffold: copy config templates from bundled resources
            match first_run_scaffold(&resource_dir, &app_root) {
                Ok(_) => log_msg(&log_path, "first_run_scaffold: OK"),
                Err(e) => log_msg(&log_path, &format!("first_run_scaffold: ERROR - {}", e)),
            }

            let standalone_dir = resource_dir.join("standalone");
            log_msg(&log_path, &format!("standalone_dir: {}", standalone_dir.display()));
            log_msg(&log_path, &format!("standalone_dir exists: {}", standalone_dir.exists()));

            // List contents of standalone_dir for debugging
            if standalone_dir.exists() {
                if let Ok(entries) = std::fs::read_dir(&standalone_dir) {
                    for entry in entries.flatten() {
                        log_msg(&log_path, &format!("  standalone_dir/{}", entry.file_name().to_string_lossy()));
                    }
                }
            }

            // Check if server.js exists
            let server_js = standalone_dir.join("server.js");
            log_msg(&log_path, &format!("server.js path: {}", server_js.display()));
            log_msg(&log_path, &format!("server.js exists: {}", server_js.exists()));

            // Check if package.json exists
            let pkg_json = standalone_dir.join("package.json");
            log_msg(&log_path, &format!("package.json exists: {}", pkg_json.exists()));
            if pkg_json.exists() {
                if let Ok(pkg) = std::fs::read_to_string(&pkg_json) {
                    log_msg(&log_path, &format!("package.json content: {}", pkg));
                }
            }

            // Check if node_modules exists
            let node_modules = standalone_dir.join("node_modules");
            log_msg(&log_path, &format!("node_modules exists: {}", node_modules.exists()));

            let sidecar_result = app
                .shell()
                .sidecar("node")
                .expect("node sidecar binary not found in bundle")
                .args(vec!["server.js".to_string()])
                .current_dir(&standalone_dir)
                .env("PORT", port.to_string())
                .env("NODE_ENV", "production")
                .env("HOSTNAME", "127.0.0.1")
                .env("GBP_ROOT", gbp_root.to_string_lossy().to_string())
                .env("ROTHER_DATA_DIR", data_dir.to_string_lossy().to_string());

            log_msg(&log_path, "Spawning sidecar...");
            match sidecar_result.spawn() {
                Ok((_rx, child)) => {
                    log_msg(&log_path, &format!("Sidecar spawned with PID: {:?}", child.pid()));
                    app.state::<Sidecar>()
                        .0
                        .lock()
                        .unwrap()
                        .replace(child);
                }
                Err(e) => {
                    log_msg(&log_path, &format!("Sidecar spawn FAILED: {:?}", e));
                }
            }

            let app_handle = app.handle().clone();
            let log_path_clone = log_path.clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(1));
                log_msg(&log_path_clone, "Checking sidecar readiness...");
                if let Some(window) = app_handle.get_webview_window("main") {
                    let ready = wait_for_sidecar(port, Duration::from_secs(29), &log_path_clone);
                    log_msg(&log_path_clone, &format!("wait_for_sidecar returned: {}", ready));
                    if !ready {
                        log_msg(&log_path_clone, "Sidecar not ready - showing window with loading screen");
                        let _ = window.show();
                        return;
                    }
                    let url = format!("http://127.0.0.1:{}/", port);
                    log_msg(&log_path_clone, &format!("Navigating to: {}", url));
                    if let Ok(parsed_url) = Url::parse(&url) {
                        let _ = window.navigate(parsed_url);
                    }
                    let _ = window.show();
                    log_msg(&log_path_clone, "Window shown and navigated to sidecar");
                }
            });

            let close_handle = app.handle().clone();
            app.listen("tauri://close-requested", move |_| {
                if let Some(window) = close_handle.get_webview_window("main") {
                    let state = close_handle.state::<Sidecar>();
                    let child = {
                        let mut guard = state.0.lock().unwrap();
                        guard.take()
                    };
                    if let Some(child) = child {
                        // Use killProcessTree to ensure child processes (Node.js cluster workers) are also killed
                        killProcessTreeByPid(child.pid());
                    }
                    let _ = window.hide();
                }
                std::process::exit(0);
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.app_handle().state::<Sidecar>();
                let child = {
                    let mut guard = state.0.lock().unwrap();
                    guard.take()
                };
                if let Some(child) = child {
                    killProcessTreeByPid(child.pid());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Rother desktop app");
}
