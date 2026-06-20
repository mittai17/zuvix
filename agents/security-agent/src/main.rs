// Zuvix Security Agent — cross-platform OS automation
// Minimal token usage, maximum OS control.
// Compile: cargo build --release  (produces ~3MB binary)

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Command, Output};
use tokio::sync::mpsc;
use tokio::time::{interval, sleep, Duration};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

// ─── Message Protocol ──────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct WsMessage {
    #[serde(rename = "type")]
    msg_type: String,
    command: Option<String>,
    args: Option<serde_json::Value>,
    device_id: Option<String>,
}

#[derive(Serialize, Clone)]
struct WsOutgoing {
    #[serde(rename = "type")]
    msg_type: String,
    device_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    platform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct SystemInfo {
    hostname: String,
    os: String,
    os_version: String,
    kernel: String,
    cpu: String,
    cpu_cores: usize,
    memory_total: u64,
    memory_used: u64,
    memory_percent: f32,
    disk_total: u64,
    disk_used: u64,
    uptime: u64,
    username: String,
}

#[derive(Serialize)]
struct NetworkInfo {
    hostname: String,
    interfaces: Vec<NetInterface>,
}

#[derive(Serialize)]
struct NetInterface {
    name: String,
    mac: String,
    ips: Vec<String>,
}

#[derive(Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    modified: String,
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

fn run_cmd(cmd: &str, args: &[&str]) -> Result<Output, String> {
    Command::new(cmd).args(args).output()
        .map_err(|e| format!("Failed to execute {}: {}", cmd, e))
}

fn run_shell(cmdline: &str) -> Result<Output, String> {
    let (shell, flag) = if cfg!(target_os = "windows") { ("cmd.exe", "/C") } else { ("sh", "-c") };
    Command::new(shell).args([flag, cmdline]).output()
        .map_err(|e| format!("Shell exec failed: {}", e))
}

fn output_to_json(out: &Output) -> serde_json::Value {
    serde_json::json!({
        "exit_code": out.status.code().unwrap_or(-1),
        "stdout": String::from_utf8_lossy(&out.stdout),
        "stderr": String::from_utf8_lossy(&out.stderr),
        "success": out.status.success()
    })
}

fn get_os_name() -> &'static str {
    if cfg!(target_os = "linux") { "Linux" }
    else if cfg!(target_os = "macos") { "macOS" }
    else if cfg!(target_os = "windows") { "Windows" }
    else if cfg!(target_os = "android") { "Android" }
    else { "Unknown" }
}

fn get_hostname() -> String {
    std::fs::read_to_string("/etc/hostname").ok()
        .or_else(|| String::from_utf8(Command::new("hostname").output().ok()?.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".into())
}

fn get_username() -> String {
    std::env::var("USER").or_else(|_| std::env::var("USERNAME")).unwrap_or_else(|_| "unknown".into())
}

// ─── Command Executor ──────────────────────────────────────────────────────────

async fn handle_execute(command: &str, args: Option<&serde_json::Value>) -> Result<serde_json::Value, String> {
    match command {
        "exec" => {
            let cmdline = args.and_then(|a| a.get("cmdline")).and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'cmdline'".to_string())?;
            run_shell(cmdline).map(|out| output_to_json(&out))
        }

        "file.read" => {
            let path = args.and_then(|a| a.get("path")).and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'path'".to_string())?;
            let content = std::fs::read_to_string(path).map_err(|e| format!("Read error: {}", e))?;
            Ok(serde_json::json!({ "content": content, "path": path }))
        }

        "file.write" => {
            let path = args.and_then(|a| a.get("path")).and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'path'".to_string())?;
            let content = args.and_then(|a| a.get("content")).and_then(|v| v.as_str()).unwrap_or("");
            let bytes = content.len();
            std::fs::write(path, content).map_err(|e| format!("Write error: {}", e))?;
            Ok(serde_json::json!({ "written": path, "bytes": bytes }))
        }

        "file.delete" => {
            let path = args.and_then(|a| a.get("path")).and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'path'".to_string())?;
            if std::fs::metadata(path).map(|m| m.is_dir()).unwrap_or(false) {
                std::fs::remove_dir_all(path).map_err(|e| format!("Delete dir error: {}", e))?;
            } else {
                std::fs::remove_file(path).map_err(|e| format!("Delete file error: {}", e))?;
            }
            Ok(serde_json::json!({ "deleted": path }))
        }

        "file.list" => {
            let path = args.and_then(|a| a.get("path")).and_then(|v| v.as_str()).unwrap_or(".");
            let entries = std::fs::read_dir(path).map_err(|e| format!("List error: {}", e))?;
            let files: Vec<FileEntry> = entries.flatten().map(|e| {
                let meta = e.metadata().ok();
                FileEntry {
                    name: e.file_name().to_string_lossy().to_string(),
                    path: e.path().to_string_lossy().to_string(),
                    is_dir: meta.as_ref().map(|m| m.is_dir()).unwrap_or(false),
                    size: meta.as_ref().map(|m| m.len()).unwrap_or(0),
                    modified: meta.and_then(|m| m.modified().ok())
                        .map(|t| t.duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs().to_string()).unwrap_or_default())
                        .unwrap_or_default(),
                }
            }).collect();
            Ok(serde_json::json!({ "path": path, "entries": files, "count": files.len() }))
        }

        "file.copy" => {
            let src = args.and_then(|a| a.get("source")).and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'source'".to_string())?;
            let dst = args.and_then(|a| a.get("dest")).and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'dest'".to_string())?;
            std::fs::copy(src, dst).map_err(|e| format!("Copy error: {}", e))?;
            Ok(serde_json::json!({ "from": src, "to": dst }))
        }

        "file.move" => {
            let src = args.and_then(|a| a.get("source")).and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'source'".to_string())?;
            let dst = args.and_then(|a| a.get("dest")).and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'dest'".to_string())?;
            std::fs::rename(src, dst).map_err(|e| format!("Move error: {}", e))?;
            Ok(serde_json::json!({ "from": src, "to": dst }))
        }

        "process.list" => {
            let mut s = sysinfo::System::new_all();
            s.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
            let procs: Vec<serde_json::Value> = s.processes().iter().map(|(pid, info)| {
                let cmd_str: Vec<String> = info.cmd().iter()
                    .map(|o| o.to_string_lossy().to_string())
                    .collect();
                serde_json::json!({
                    "pid": pid.as_u32(),
                    "name": info.name().to_string_lossy(),
                    "cpu": info.cpu_usage(),
                    "memory": info.memory(),
                    "status": format!("{:?}", info.status()),
                    "cmd": cmd_str.join(" "),
                })
            }).collect();
            Ok(serde_json::json!({ "processes": procs, "count": procs.len() }))
        }

        "process.kill" => {
            let pid = args.and_then(|a| a.get("pid")).and_then(|v| v.as_u64())
                .ok_or_else(|| "Missing 'pid'".to_string())?;
            let out = if cfg!(target_os = "windows") {
                run_cmd("taskkill", &["/F", "/PID", &pid.to_string()])?
            } else {
                run_cmd("kill", &["-9", &pid.to_string()])?
            };
            Ok(output_to_json(&out))
        }

        "system.info" => {
            let mut s = sysinfo::System::new_all();
            s.refresh_cpu_all();
            s.refresh_memory();
            let disk_out = run_shell("df -B1 / 2>/dev/null | tail -1")
                .ok();
            let (disk_total, disk_used) = disk_out
                .and_then(|o| {
                    let line = String::from_utf8_lossy(&o.stdout).trim().to_string();
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 {
                        Some((parts[1].parse::<u64>().unwrap_or(0), parts[2].parse::<u64>().unwrap_or(0)))
                    } else { None }
                })
                .unwrap_or((0, 0));
            Ok(serde_json::json!(SystemInfo {
                hostname: get_hostname(),
                os: get_os_name().to_string(),
                os_version: std::env::consts::ARCH.to_string(),
                kernel: run_cmd("uname", &["-r"]).map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string()).unwrap_or_default(),
                cpu: s.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default(),
                cpu_cores: s.cpus().len(),
                memory_total: s.total_memory(),
                memory_used: s.used_memory(),
                memory_percent: if s.total_memory() > 0 { (s.used_memory() as f32 / s.total_memory() as f32) * 100.0 } else { 0.0 },
                disk_total,
                disk_used,
                uptime: sysinfo::System::uptime(),
                username: get_username(),
            }))
        }

        "network.info" => {
            let mut interfaces = vec![];
            if let Ok(entries) = std::fs::read_dir("/sys/class/net/") {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name == "lo" { continue; }
                    let mac = std::fs::read_to_string(entry.path().join("address")).unwrap_or_default().trim().to_string();
                    let mut ips = vec![];
                    if let Ok(out) = run_cmd("ip", &["-4", "addr", "show", &name]) {
                        for line in String::from_utf8_lossy(&out.stdout).lines() {
                            if let Some(ip) = line.trim().split_whitespace().nth(1) {
                                ips.push(ip.to_string());
                            }
                        }
                    }
                    interfaces.push(NetInterface { name, mac, ips });
                }
            }
            Ok(serde_json::json!(NetworkInfo { hostname: get_hostname(), interfaces }))
        }

        "screenshot" => {
            let path = "/tmp/zuvix_screenshot.png";
            let result = if cfg!(target_os = "macos") { run_cmd("screencapture", &["-x", path]) }
            else if cfg!(target_os = "linux") {
                run_cmd("import", &["-window", "root", path])
                    .or_else(|_| run_cmd("scrot", &["-z", path]))
                    .or_else(|_| run_cmd("gnome-screenshot", &["-f", path]))
                    .or_else(|_| Err("No screenshot tool found".to_string()))
            } else { Err("Screenshot not supported".to_string()) };
            match result {
                Ok(_) => Ok(serde_json::json!({ "path": path })),
                Err(e) => Ok(serde_json::json!({ "error": e })),
            }
        }

        "clipboard.read" => {
            let result = if cfg!(target_os = "macos") { run_cmd("pbpaste", &[]) }
            else if cfg!(target_os = "linux") {
                run_cmd("xclip", &["-o", "-selection", "clipboard"])
                    .or_else(|_| run_cmd("wl-paste", &[]))
                    .or_else(|_| Err("No clipboard tool".to_string()))
            } else if cfg!(target_os = "windows") {
                run_cmd("powershell", &["-Command", "Get-Clipboard"])
            } else { Err("Not supported".to_string()) };
            match result {
                Ok(out) => Ok(serde_json::json!({ "content": String::from_utf8_lossy(&out.stdout).trim().to_string() })),
                Err(e) => Ok(serde_json::json!({ "error": e })),
            }
        }

        "clipboard.write" => {
            let content = args.and_then(|a| a.get("content")).and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'content'".to_string())?;
            if cfg!(target_os = "macos") {
                let mut child = Command::new("pbcopy").stdin(std::process::Stdio::piped()).spawn().map_err(|e| e.to_string())?;
                use std::io::Write;
                if let Some(mut stdin) = child.stdin.take() {
                    stdin.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
                }
                child.wait().map_err(|e| e.to_string())?;
                Ok(serde_json::json!({ "written": content.len() }))
            } else {
                Err("clipboard.write not supported on this platform".to_string())
            }
        }

        "keyboard.type" => {
            let text = args.and_then(|a| a.get("text")).and_then(|v| v.as_str())
                .ok_or_else(|| "Missing 'text'".to_string())?;
            let escaped = text.replace('"', "\\\"");
            if cfg!(target_os = "macos") {
                run_cmd("osascript", &["-e", &format!("tell app \"System Events\" to keystroke \"{}\"", escaped)])
                    .map(|o| output_to_json(&o))
            } else if cfg!(target_os = "linux") {
                run_cmd("xdotool", &["type", text])
                    .or_else(|_| run_cmd("wtype", &[text]))
                    .map(|o| output_to_json(&o))
                    .or_else(|_| Ok(serde_json::json!({ "error": "No keyboard tool (install xdotool or wtype)" })))
            } else {
                Ok(serde_json::json!({ "error": "Not supported on this platform" }))
            }
        }

        "mouse.click" => {
            let btn = args.and_then(|a| a.get("button")).and_then(|v| v.as_str()).unwrap_or("1");
            if cfg!(target_os = "linux") {
                run_cmd("xdotool", &["click", btn]).map(|o| output_to_json(&o))
            } else {
                Ok(serde_json::json!({ "error": "Not supported" }))
            }
        }

        "mouse.move" => {
            let x = args.and_then(|a| a.get("x")).and_then(|v| v.as_i64()).unwrap_or(0);
            let y = args.and_then(|a| a.get("y")).and_then(|v| v.as_i64()).unwrap_or(0);
            if cfg!(target_os = "linux") {
                run_cmd("xdotool", &["mousemove", &x.to_string(), &y.to_string()]).map(|o| output_to_json(&o))
            } else {
                Ok(serde_json::json!({ "error": "Not supported" }))
            }
        }

        "env.get" | "env.set" | "env.all" | "cwd" | "cwd.set" | "echo" | "sleep" => {
            match command {
                "env.get" => {
                    let key = args.and_then(|a| a.get("key")).and_then(|v| v.as_str())
                        .ok_or_else(|| "Missing 'key'".to_string())?;
                    Ok(serde_json::json!({ "key": key, "value": std::env::var(key).ok() }))
                }
                "env.set" => {
                    let key = args.and_then(|a| a.get("key")).and_then(|v| v.as_str())
                        .ok_or_else(|| "Missing 'key'".to_string())?;
                    let value = args.and_then(|a| a.get("value")).and_then(|v| v.as_str()).unwrap_or("");
                    std::env::set_var(key, value);
                    Ok(serde_json::json!({ "key": key, "value": value }))
                }
                "env.all" => {
                    let vars: HashMap<String, String> = std::env::vars().collect();
                    Ok(serde_json::json!({ "vars": vars }))
                }
                "cwd" => {
                    let cwd = std::env::current_dir().map(|p| p.to_string_lossy().to_string()).unwrap_or_default();
                    Ok(serde_json::json!({ "cwd": cwd }))
                }
                "cwd.set" => {
                    let path = args.and_then(|a| a.get("path")).and_then(|v| v.as_str())
                        .ok_or_else(|| "Missing 'path'".to_string())?;
                    std::env::set_current_dir(path).map_err(|e| format!("chdir: {}", e))?;
                    Ok(serde_json::json!({ "cwd": path }))
                }
                "echo" => {
                    let text = args.and_then(|a| a.get("text")).and_then(|v| v.as_str()).unwrap_or("");
                    Ok(serde_json::json!({ "echo": text }))
                }
                "sleep" => {
                    let ms = args.and_then(|a| a.get("ms")).and_then(|v| v.as_u64()).unwrap_or(1000);
                    sleep(Duration::from_millis(ms)).await;
                    Ok(serde_json::json!({ "slept_ms": ms }))
                }
                _ => unreachable!()
            }
        }

        _ => Err(format!("Unknown command: {}", command)),
    }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    println!("Zuvix Security Agent v{}", env!("CARGO_PKG_VERSION"));

    let server_base = std::env::var("ZUVIX_SERVER").unwrap_or_else(|_| "ws://localhost:3001".into());
    let server_url = format!("{}/ws/mesh", server_base.trim_end_matches('/'));
    let device_id = std::env::var("ZUVIX_DEVICE_ID")
        .unwrap_or_else(|_| format!("agent-{}", get_hostname()));
    let platform = format!("{}-{}", get_os_name().to_lowercase(), std::env::consts::ARCH);

    loop {
        println!("Connecting to {} ...", server_url);
        match connect_async(&server_url).await {
            Ok((ws_stream, _)) => {
                println!("Connected as {}", device_id);
                let (tx, mut rx) = mpsc::channel::<String>(256);
                let (mut write, read) = ws_stream.split();
                let did = device_id.clone();
                let plat = platform.clone();

                // Register immediately
                let reg = serde_json::json!({
                    "type": "register_device",
                    "deviceId": did,
                    "platform": plat,
                });
                if write.send(Message::Text(reg.to_string())).await.is_err() {
                    eprintln!("Failed to register");
                    sleep(Duration::from_secs(5)).await;
                    continue;
                }
                println!("Registered as {}", device_id);

                // Writer task: heartbeat + forward channel
                let did2 = did.clone();
                let _plat2 = plat.clone();
                let writer = tokio::spawn(async move {
                    let mut hb = interval(Duration::from_secs(30));
                    loop {
                        tokio::select! {
                            _ = hb.tick() => {
                                let hb_msg = serde_json::json!({
                                    "type": "heartbeat",
                                    "deviceId": did2,
                                });
                                if write.send(Message::Text(hb_msg.to_string())).await.is_err() {
                                    break;
                                }
                            }
                            Some(msg) = rx.recv() => {
                                if write.send(Message::Text(msg)).await.is_err() {
                                    break;
                                }
                            }
                        }
                    }
                });

                let did3 = did.clone();
                // Reader task: process commands
                let tx_clone = tx.clone();
                let reader = tokio::spawn(async move {
                    let mut read = read;
                    while let Some(msg) = read.next().await {
                        match msg {
                            Ok(Message::Text(text)) => {
                                let parsed: WsMessage = match serde_json::from_str(&text) {
                                    Ok(m) => m,
                                    Err(_) => continue,
                                };
                                if parsed.msg_type == "execute_command" {
                                    let cmd = parsed.command.unwrap_or_default();
                                    let args = parsed.args;
                                    let result = handle_execute(&cmd, args.as_ref()).await;
                                    let response = match result {
                                        Ok(val) => WsOutgoing {
                                            msg_type: "command_result".into(),
                                            device_id: did3.clone(),
                                            platform: None,
                                            command: Some(cmd),
                                            result: Some(val),
                                            error: None,
                                        },
                                        Err(e) => WsOutgoing {
                                            msg_type: "command_result".into(),
                                            device_id: did3.clone(),
                                            platform: None,
                                            command: Some(cmd),
                                            result: None,
                                            error: Some(e),
                                        },
                                    };
                                    let json = serde_json::to_string(&response).unwrap_or_default();
                                    if tx_clone.send(json).await.is_err() {
                                        break;
                                    }
                                }
                            }
                            Ok(Message::Close(_)) => break,
                            Err(e) => { eprintln!("WS error: {}", e); break; }
                            _ => {}
                        }
                    }
                });

                let _ = tokio::join!(writer, reader);
                println!("Disconnected. Reconnecting in 5s...");
                sleep(Duration::from_secs(5)).await;
            }
            Err(e) => {
                eprintln!("Connection failed: {}. Retrying in 10s...", e);
                sleep(Duration::from_secs(10)).await;
            }
        }
    }
}
