use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

static LOCK: Mutex<()> = Mutex::new(());

const MAX_BYTES: u64 = 5 * 1024 * 1024;

pub fn logs_dir() -> PathBuf {
    crate::launcher::store::user_data_dir().join("logs")
}

pub fn log_file_path() -> PathBuf {
    logs_dir().join("painel.log")
}

fn ensure_logs_dir() -> Result<PathBuf, String> {
    let dir = logs_dir();
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir)
}

fn rotate_if_needed(path: &Path) {
    let Ok(meta) = fs::metadata(path) else {
        return;
    };
    if meta.len() < MAX_BYTES {
        return;
    }
    let backup = path.with_extension("log.1");
    let _ = fs::remove_file(&backup);
    let _ = fs::rename(path, &backup);
}

/// Escreve uma linha no painel.log. Nunca falha de forma ruidosa para a UI.
pub fn append(level: &str, source: &str, message: &str, detail: Option<&str>) {
    let _guard = LOCK.lock().unwrap_or_else(|err| err.into_inner());
    let Ok(_) = ensure_logs_dir() else {
        return;
    };
    let path = log_file_path();
    rotate_if_needed(&path);
    let stamp = Local::now().format("%Y-%m-%dT%H:%M:%S%.3f%z");
    let mut line = format!("{stamp} [{level}] [{source}] {message}\n");
    if let Some(detail) = detail.map(str::trim).filter(|item| !item.is_empty()) {
        for part in detail.lines() {
            line.push_str("  ");
            line.push_str(part);
            line.push('\n');
        }
    }
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) else {
        return;
    };
    let _ = file.write_all(line.as_bytes());
    let _ = file.flush();
}

pub fn info(source: &str, message: &str) {
    append("INFO", source, message, None);
}

pub fn warn(source: &str, message: &str) {
    append("WARN", source, message, None);
}

pub fn error(source: &str, message: &str, detail: Option<&str>) {
    append("ERROR", source, message, detail);
}

pub fn write_from_ui(level: String, source: String, message: String, detail: Option<String>) -> Result<(), String> {
    let level = match level.to_uppercase().as_str() {
        "WARN" | "WARNING" => "WARN",
        "ERROR" | "ERR" => "ERROR",
        _ => "INFO",
    };
    append(level, &source, &message, detail.as_deref());
    Ok(())
}

pub fn path_string() -> Result<String, String> {
    ensure_logs_dir()?;
    Ok(log_file_path().display().to_string())
}

pub fn open_folder() -> Result<String, String> {
    let dir = ensure_logs_dir()?;
    let mut command = if cfg!(windows) {
        let mut command = std::process::Command::new("explorer");
        command.arg(&dir);
        command
    } else if cfg!(target_os = "macos") {
        let mut command = std::process::Command::new("open");
        command.arg(&dir);
        command
    } else {
        let mut command = std::process::Command::new("xdg-open");
        command.arg(&dir);
        command
    };
    command
        .spawn()
        .map_err(|err| format!("Não foi possível abrir a pasta de logs: {err}"))?;
    Ok(dir.display().to_string())
}
