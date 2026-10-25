use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningEntry {
    pub pid: u32,
    pub process_name: String,
    pub started_at: i64,
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

pub fn record(root: &Path, repository: &str, pid: u32, process_name: &str) -> Result<(), String> {
    let mut map = load_map(root);
    map[repository] = json!({
        "pid": pid,
        "processName": process_name,
        "startedAt": now_secs(),
    });
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

fn process_name_running(name: &str) -> bool {
    let name = name.trim();
    if name.is_empty() {
        return false;
    }
    if cfg!(windows) {
        Command::new("tasklist")
            .args(["/FI", &format!("IMAGENAME eq {name}"), "/NH"])
            .output()
            .map(|output| {
                let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
                text.contains(&name.to_lowercase()) && !text.contains("no tasks") && !text.contains("nenhuma")
            })
            .unwrap_or(false)
    } else {
        Command::new("pgrep")
            .arg("-x")
            .arg(name)
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }
}

pub fn is_running(root: &Path, repository: &str) -> bool {
    let Some(item) = entry(root, repository) else {
        return false;
    };
    if pid_alive(item.pid) {
        return true;
    }
    if process_name_running(&item.process_name) {
        return true;
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
    if !killed && is_running(root, repository) {
        return Err("Não foi possível parar o processo.".into());
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
    let entry = map.as_object_mut().unwrap().entry(repository.to_string()).or_insert_with(|| json!({}));
    if let Some(obj) = entry.as_object_mut() {
        obj.insert("selectedBranch".into(), json!(branch.trim()));
    }
    save_app_state(root, &map)
}
