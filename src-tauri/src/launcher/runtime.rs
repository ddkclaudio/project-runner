use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningEntry {
    pub pid: u32,
    pub process_name: String,
    pub started_at: i64,
    #[serde(default)]
    pub open_url: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub cwd: Option<String>,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn running_path(root: &Path) -> PathBuf {
    root.join("running.json")
}

fn load_map(root: &Path) -> Value {
    fs::read_to_string(running_path(root))
        .ok()
        .map(|raw| raw.trim_start_matches('\u{feff}').to_string())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_else(|| json!({}))
}

fn save_map(root: &Path, map: &Value) -> Result<(), String> {
    crate::launcher::store::ensure_root(root)?;
    let raw = serde_json::to_string_pretty(map).map_err(|err| err.to_string())?;
    fs::write(running_path(root), raw).map_err(|err| err.to_string())
}

pub struct RecordInput<'a> {
    pub pid: u32,
    pub process_name: &'a str,
    pub open_url: Option<&'a str>,
    pub command: Option<&'a str>,
    pub cwd: Option<&'a str>,
}

pub fn record(root: &Path, repository: &str, input: RecordInput<'_>) -> Result<(), String> {
    let mut map = load_map(root);
    let mut entry = json!({
        "pid": input.pid,
        "processName": input.process_name,
        "startedAt": now_secs(),
    });
    let obj = entry.as_object_mut().unwrap();
    if let Some(url) = input.open_url.map(str::trim).filter(|item| !item.is_empty()) {
        obj.insert("openUrl".into(), json!(url));
    }
    if let Some(cmd) = input.command.map(str::trim).filter(|item| !item.is_empty()) {
        obj.insert("command".into(), json!(cmd));
    }
    if let Some(cwd) = input.cwd.map(str::trim).filter(|item| !item.is_empty()) {
        obj.insert("cwd".into(), json!(cwd));
    }
    map[repository] = entry;
    save_map(root, &map)
}

pub fn clear(root: &Path, repository: &str) -> Result<(), String> {
    let mut map = load_map(root);
    if let Some(obj) = map.as_object_mut() {
        obj.remove(repository);
    }
    save_map(root, &map)
}

pub fn entry(root: &Path, repository: &str) -> Option<RunningEntry> {
    let map = load_map(root);
    let item = map.get(repository)?;
    Some(RunningEntry {
        pid: item.get("pid")?.as_u64()? as u32,
        process_name: item.get("processName")?.as_str()?.to_string(),
        started_at: item.get("startedAt")?.as_i64().unwrap_or(0),
        open_url: item
            .get("openUrl")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
            .filter(|value| !value.is_empty()),
        command: item
            .get("command")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
            .filter(|value| !value.is_empty()),
        cwd: item
            .get("cwd")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string())
            .filter(|value| !value.is_empty()),
    })
}

fn pid_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    if cfg!(windows) {
        Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}"), "/NH"])
            .output()
            .map(|output| {
                let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
                text.contains(&pid.to_string()) && !text.contains("no tasks") && !text.contains("nenhuma")
            })
            .unwrap_or(false)
    } else {
        Path::new(&format!("/proc/{pid}")).exists()
    }
}

fn port_from_url(url: &str) -> Option<u16> {
    let url = url.trim();
    let after = url.split("://").nth(1).unwrap_or(url);
    let hostport = after.split('/').next().unwrap_or(after);
    if let Some((_, port)) = hostport.rsplit_once(':') {
        return port.parse().ok();
    }
    if url.starts_with("https") {
        Some(443)
    } else if url.starts_with("http") {
        Some(80)
    } else {
        None
    }
}

fn port_listening(port: u16) -> bool {
    port_reachable_v4(port) || port_reachable_v6(port)
}

fn port_reachable_v4(port: u16) -> bool {
    TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], port)),
        Duration::from_millis(200),
    )
    .is_ok()
}

fn port_reachable_v6(port: u16) -> bool {
    TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([0, 0, 0, 0, 0, 0, 0, 1], port)),
        Duration::from_millis(200),
    )
    .is_ok()
}

/// PID e nome do processo à escuta em `127.0.0.1:port`, se a porta estiver ocupada.
pub fn port_occupant(port: u16) -> Option<(u32, String)> {
    if !port_listening(port) {
        return None;
    }
    #[cfg(windows)]
    {
        let script = format!(
            "$c = Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; \
             if (-not $c) {{ exit 1 }}; \
             $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue; \
             if (-not $p) {{ Write-Output \"$($c.OwningProcess)|processo\"; exit 0 }}; \
             $name = $p.ProcessName; if ($name -notmatch '\\.exe$') {{ $name = \"$name.exe\" }}; \
             Write-Output \"$($p.Id)|$name\""
        );
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        parse_pid_name(&String::from_utf8_lossy(&output.stdout))
    }
    #[cfg(not(windows))]
    {
        let output = Command::new("sh")
            .args([
                "-c",
                &format!("ss -lptn 'sport = :{port}' 2>/dev/null | sed -n 's/.*pid=\\([0-9]*\\).*/\\1/p' | head -1"),
            ])
            .output()
            .ok()?;
        if !output.status.success() {
            return None;
        }
        let pid: u32 = String::from_utf8_lossy(&output.stdout).trim().parse().ok()?;
        let name = Command::new("ps")
            .args(["-p", &pid.to_string(), "-o", "comm="])
            .output()
            .ok()
            .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string())
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| "process".into());
        Some((pid, name))
    }
}

pub fn kill_pid_tree(pid: u32) -> Result<(), String> {
    if pid == 0 {
        return Err("PID inválido.".into());
    }
    let ok = if cfg!(windows) {
        Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    } else {
        Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    };
    if !ok {
        return Err(format!("Não foi possível terminar o PID {pid}."));
    }
    Ok(())
}

/// Liberta a porta matando quem estiver à escuta (pode repetir se a árvore respawnar).
pub fn free_port(port: u16) -> Result<(), String> {
    let deadline = std::time::Instant::now() + Duration::from_secs(5);
    let mut last: Option<(u32, String)> = None;
    while std::time::Instant::now() < deadline {
        let Some((pid, name)) = port_occupant(port) else {
            // Porta livre: confirmar estabilidade (evita race com CRA).
            let mut free_hits = 0;
            for _ in 0..5 {
                if port_listening(port) {
                    free_hits = 0;
                    break;
                }
                free_hits += 1;
                std::thread::sleep(Duration::from_millis(100));
            }
            if free_hits >= 5 {
                return Ok(());
            }
            continue;
        };
        last = Some((pid, name.clone()));
        crate::launcher::activity_log::info(
            "runtime",
            &format!("free_port {port}: a matar {name} (PID {pid})"),
        );
        let _ = kill_pid_tree(pid);
        std::thread::sleep(Duration::from_millis(200));
    }
    if let Some((pid, name)) = last {
        return Err(format!(
            "A porta {port} continua ocupada após terminar {name} (PID {pid})."
        ));
    }
    Ok(())
}

/// Remove entradas running cujo openUrl use esta porta (ex. hello ao forçar hello002).
pub fn clear_running_for_port(root: &Path, port: u16) -> Result<(), String> {
    let mut map = load_map(root);
    let Some(obj) = map.as_object_mut() else {
        return Ok(());
    };
    let keys: Vec<String> = obj
        .iter()
        .filter_map(|(key, value)| {
            let url = value.get("openUrl")?.as_str()?;
            let p = port_from_url(url)?;
            if p == port {
                Some(key.clone())
            } else {
                None
            }
        })
        .collect();
    for key in &keys {
        obj.remove(key);
        crate::launcher::activity_log::info(
            "runtime",
            &format!("clear_running_for_port {port}: removido {key}"),
        );
    }
    if !keys.is_empty() {
        save_map(root, &map)?;
    }
    Ok(())
}

fn parse_pid_name(text: &str) -> Option<(u32, String)> {
    let line = text.lines().next()?.trim();
    let (pid, name) = line.split_once('|')?;
    let pid = pid.trim().parse().ok()?;
    let name = name.trim().to_string();
    if pid == 0 || name.is_empty() {
        None
    } else {
        Some((pid, name))
    }
}

/// Procura filho `node.exe` (ou descendente) do PID wrapper (cmd/npm).
pub fn resolve_node_descendant(parent_pid: u32) -> Option<(u32, String)> {
    if parent_pid == 0 {
        return None;
    }
    #[cfg(windows)]
    {
        let script = format!(
            "$p = Get-CimInstance Win32_Process -Filter \"ParentProcessId={parent_pid}\" -ErrorAction SilentlyContinue; \
             if (-not $p) {{ exit 1 }}; \
             $n = @($p) | Where-Object {{ $_.Name -match 'node|npm' }} | Select-Object -First 1; \
             if (-not $n) {{ $n = @($p) | Select-Object -First 1 }}; \
             if (-not $n) {{ exit 1 }}; \
             Write-Output \"$($n.ProcessId)|$($n.Name)\""
        );
        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .ok()?;
        if output.status.success() {
            return parse_pid_name(&String::from_utf8_lossy(&output.stdout));
        }
        // Uma geração mais: netos do cmd (npm → node)
        let script2 = format!(
            "$kids = Get-CimInstance Win32_Process -Filter \"ParentProcessId={parent_pid}\" -ErrorAction SilentlyContinue; \
             foreach ($k in @($kids)) {{ \
               $g = Get-CimInstance Win32_Process -Filter \"ParentProcessId=$($k.ProcessId)\" -ErrorAction SilentlyContinue; \
               $n = @($g) | Where-Object {{ $_.Name -match 'node' }} | Select-Object -First 1; \
               if ($n) {{ Write-Output \"$($n.ProcessId)|$($n.Name)\"; exit 0 }} \
             }}; exit 1"
        );
        let output2 = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script2])
            .output()
            .ok()?;
        if !output2.status.success() {
            return None;
        }
        parse_pid_name(&String::from_utf8_lossy(&output2.stdout))
    }
    #[cfg(not(windows))]
    {
        let output = Command::new("pgrep")
            .args(["-P", &parent_pid.to_string()])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            if let Ok(pid) = line.trim().parse::<u32>() {
                let name = fs::read_to_string(format!("/proc/{pid}/comm"))
                    .unwrap_or_else(|_| "node".into())
                    .trim()
                    .to_string();
                if name.contains("node") || name.contains("npm") {
                    return Some((pid, name));
                }
            }
        }
        None
    }
}

fn looks_like_node(process_name: &str, command: Option<&str>, candidate_id: &str) -> bool {
    let name = process_name.to_lowercase();
    if name.contains("node") || name.contains("npm") || name.contains("npx") {
        return true;
    }
    if candidate_id.starts_with("npm:") || candidate_id.contains("node") {
        return true;
    }
    let cmd = command.unwrap_or("").to_lowercase();
    cmd.contains("npm")
        || cmd.contains("node")
        || cmd.contains("npx")
        || cmd.contains("yarn")
        || cmd.contains("pnpm")
        || cmd.contains("bun")
}

/// Espera brevemente e actualiza PID/nome para o processo Node real, se existir.
pub fn refine_after_spawn(
    root: &Path,
    repository: &str,
    wrapper_pid: u32,
    fallback_name: &str,
    open_url: Option<&str>,
    command: Option<&str>,
    cwd: Option<&str>,
) -> Result<RunningEntry, String> {
    std::thread::sleep(Duration::from_millis(1500));
    let (pid, process_name) = resolve_node_descendant(wrapper_pid)
        .filter(|(pid, _)| pid_alive(*pid))
        .unwrap_or_else(|| {
            if pid_alive(wrapper_pid) {
                (wrapper_pid, fallback_name.to_string())
            } else {
                resolve_node_descendant(wrapper_pid)
                    .unwrap_or((wrapper_pid, fallback_name.to_string()))
            }
        });
    record(
        root,
        repository,
        RecordInput {
            pid,
            process_name: &process_name,
            open_url,
            command,
            cwd,
        },
    )?;
    entry(root, repository).ok_or_else(|| "Falha ao gravar estado de execução.".into())
}

pub fn record_spawn(
    root: &Path,
    repository: &str,
    wrapper_pid: u32,
    process_name: &str,
    open_url: Option<&str>,
    command: Option<&str>,
    cwd: Option<&str>,
    candidate_id: &str,
    listen_port: Option<u16>,
) -> Result<(), String> {
    // Depois do wait_for_port, o Occupant da porta é o PID real (node), não o cmd/npm wrapper.
    if let Some(port) = listen_port {
        if let Some((pid, name)) = port_occupant(port) {
            return record(
                root,
                repository,
                RecordInput {
                    pid,
                    process_name: &name,
                    open_url,
                    command,
                    cwd,
                },
            );
        }
    }
    if looks_like_node(process_name, command, candidate_id) {
        refine_after_spawn(
            root,
            repository,
            wrapper_pid,
            process_name,
            open_url,
            command,
            cwd,
        )?;
        return Ok(());
    }
    record(
        root,
        repository,
        RecordInput {
            pid: wrapper_pid,
            process_name,
            open_url,
            command,
            cwd,
        },
    )
}

pub fn is_running(root: &Path, repository: &str) -> bool {
    let Some(item) = entry(root, repository) else {
        return false;
    };
    if pid_alive(item.pid) {
        return true;
    }
    // Wrapper/PID antigo: porta da openUrl ainda a escutar — actualizar PID real.
    if let Some(url) = item.open_url.as_deref() {
        if let Some(port) = port_from_url(url) {
            if port_listening(port) {
                if let Some((pid, name)) = port_occupant(port) {
                    let _ = record(
                        root,
                        repository,
                        RecordInput {
                            pid,
                            process_name: &name,
                            open_url: item.open_url.as_deref(),
                            command: item.command.as_deref(),
                            cwd: item.cwd.as_deref(),
                        },
                    );
                }
                return true;
            }
        }
    }
    let _ = clear(root, repository);
    false
}

pub fn stop(root: &Path, repository: &str) -> Result<(), String> {
    let Some(item) = entry(root, repository) else {
        return Err("Esta app não está em execução.".into());
    };
    let killed = if cfg!(windows) {
        Command::new("taskkill")
            .args(["/PID", &item.pid.to_string(), "/T", "/F"])
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
            || Command::new("taskkill")
                .args(["/IM", &item.process_name, "/T", "/F"])
                .status()
                .map(|status| status.success())
                .unwrap_or(false)
    } else {
        Command::new("kill")
            .args(["-TERM", &item.pid.to_string()])
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    };
    let _ = clear(root, repository);
    if !killed {
        // Se a porta ainda responder, o kill falhou de facto.
        if let Some(url) = item.open_url.as_deref() {
            if let Some(port) = port_from_url(url) {
                if port_listening(port) {
                    return Err("Não foi possível parar o processo.".into());
                }
            }
        }
    }
    Ok(())
}

fn app_state_path(root: &Path) -> PathBuf {
    root.join("app-state.json")
}

fn load_app_state(root: &Path) -> Value {
    fs::read_to_string(app_state_path(root))
        .ok()
        .map(|raw| raw.trim_start_matches('\u{feff}').to_string())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_else(|| json!({}))
}

fn save_app_state(root: &Path, map: &Value) -> Result<(), String> {
    crate::launcher::store::ensure_root(root)?;
    let raw = serde_json::to_string_pretty(map).map_err(|err| err.to_string())?;
    fs::write(app_state_path(root), raw).map_err(|err| err.to_string())
}

pub fn selected_branch(root: &Path, repository: &str) -> Option<String> {
    load_app_state(root)
        .get(repository)
        .and_then(|item| item.get("selectedBranch"))
        .and_then(|item| item.as_str())
        .map(|item| item.to_string())
        .filter(|item| !item.is_empty())
}

pub fn set_selected_branch(root: &Path, repository: &str, branch: &str) -> Result<(), String> {
    let mut map = load_app_state(root);
    if !map.is_object() {
        map = json!({});
    }
    let entry = map
        .as_object_mut()
        .unwrap()
        .entry(repository.to_string())
        .or_insert_with(|| json!({}));
    if let Some(obj) = entry.as_object_mut() {
        obj.insert("selectedBranch".into(), json!(branch.trim()));
    }
    save_app_state(root, &map)
}
