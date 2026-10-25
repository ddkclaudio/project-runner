#[allow(dead_code)]
mod binary;
mod manifest;
pub mod node;
mod open_url;
#[allow(dead_code)]
mod procfile;
#[allow(dead_code)]
mod python;
#[allow(dead_code)]
mod rust_runner;

pub use open_url::detect as detect_open_url;
// Runners legados mantidos no crate (templates/docs) mas não entram em active_runner.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::process::Command;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchCandidate {
    pub id: String,
    pub label: String,
    pub kind: CandidateKind,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CandidateKind {
    Binary,
    Command,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchField {
    pub key: String,
    pub label: String,
    pub value: String,
    /// text | number | boolean | url | multiline
    #[serde(default = "default_launch_field_type")]
    pub field_type: String,
}

fn default_launch_field_type() -> String {
    "text".into()
}

impl LaunchField {
    pub fn typed(
        key: impl Into<String>,
        label: impl Into<String>,
        value: impl Into<String>,
        field_type: &str,
    ) -> Self {
        Self {
            key: key.into(),
            label: label.into(),
            value: value.into(),
            field_type: field_type.into(),
        }
    }

    pub fn text(key: impl Into<String>, label: impl Into<String>, value: impl Into<String>) -> Self {
        Self::typed(key, label, value, "text")
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchConfigView {
    pub runner_id: String,
    pub runner_label: String,
    pub config_path: Option<String>,
    pub relative_path: Option<String>,
    pub editable: bool,
    pub fields: Vec<LaunchField>,
    pub raw: String,
    pub raw_language: String,
    pub can_create_manifest: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchConfigSave {
    pub fields: Option<Vec<LaunchField>>,
    pub raw: Option<String>,
    pub create_manifest: Option<bool>,
}

pub trait ProjectRunner: Send + Sync {
    fn id(&self) -> &'static str;
    fn label(&self) -> &'static str;
    fn detect(&self, root: &Path) -> bool;
    fn candidates(&self, root: &Path) -> Result<Vec<LaunchCandidate>, String>;
    fn spawn(
        &self,
        root: &Path,
        candidate: &LaunchCandidate,
        settings: &Value,
    ) -> Result<Option<(u32, String)>, String>;
    fn config_view(&self, root: &Path) -> Result<LaunchConfigView, String>;
    fn save_config(&self, root: &Path, input: &LaunchConfigSave) -> Result<LaunchConfigView, String>;
}

fn runners() -> Vec<Box<dyn ProjectRunner>> {
    // Única fonte de arranque: Launchfile.
    vec![Box::new(manifest::ManifestRunner)]
}

pub(crate) fn create_default_manifest(root: &Path) -> Result<LaunchConfigView, String> {
    manifest::create_default_launchfile(root)
}

pub fn active_runner(root: &Path) -> Result<Box<dyn ProjectRunner>, String> {
    for runner in runners() {
        if runner.detect(root) {
            return Ok(runner);
        }
    }
    // Sem Launchfile ainda — devolve o runner para editar/gerar o ficheiro.
    Ok(Box::new(manifest::ManifestRunner))
}

pub fn resolve_candidates(root: &Path) -> Result<(String, Vec<LaunchCandidate>), String> {
    let runner = active_runner(root)?;
    let id = runner.id().to_string();
    let list = runner.candidates(root)?;
    Ok((id, list))
}

pub fn find_candidate(root: &Path, id: &str) -> Result<(Box<dyn ProjectRunner>, LaunchCandidate), String> {
    let runner = active_runner(root)?;
    if let Some(candidate) = runner.candidates(root)?.into_iter().find(|item| item.id == id || item.label == id) {
        return Ok((runner, candidate));
    }
    if id.starts_with("cmd:") {
        return Ok((
            runner,
            LaunchCandidate {
                id: id.to_string(),
                label: id.strip_prefix("cmd:").unwrap_or(id).to_string(),
                kind: CandidateKind::Command,
            },
        ));
    }
    Err("O comando do Launchfile já não é válido.".into())
}

pub fn spawn_candidate(
    root: &Path,
    candidate: &LaunchCandidate,
    settings: &Value,
) -> Result<Option<(u32, String)>, String> {
    let (runner, resolved) = find_candidate(root, &candidate.id).or_else(|_| {
        Ok::<_, String>((
            active_runner(root)?,
            candidate.clone(),
        ))
    })?;
    runner.spawn(root, &resolved, settings)
}

pub fn get_launch_config(root: &Path) -> Result<LaunchConfigView, String> {
    active_runner(root)?.config_view(root)
}

pub fn save_launch_config(root: &Path, input: LaunchConfigSave) -> Result<LaunchConfigView, String> {
    if input.create_manifest.unwrap_or(false) {
        return create_default_manifest(root);
    }
    let runner = active_runner(root)?;
    runner.save_config(root, &input)
}

/// Corre um comando e espera terminar (ex.: npm install).
pub(crate) fn run_command_wait(root: &Path, command_line: &str) -> Result<(), String> {
    let line = command_line.trim();
    if line.is_empty() {
        return Err("Comando vazio.".into());
    }
    #[cfg(windows)]
    {
        let mut command = Command::new("cmd");
        command.arg("/C").arg(line).current_dir(root);
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
        let status = command
            .status()
            .map_err(|err| format!("Falha ao executar `{line}`: {err}"))?;
        if !status.success() {
            return Err(format!("`{line}` terminou com erro."));
        }
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let mut command = Command::new("sh");
        command.arg("-c").arg(line).current_dir(root);
        let status = command
            .status()
            .map_err(|err| format!("Falha ao executar `{line}`: {err}"))?;
        if !status.success() {
            return Err(format!("`{line}` terminou com erro."));
        }
        Ok(())
    }
}

/// Só esconder a janela. Evitar CREATE_NEW_PROCESS_GROUP + BREAKAWAY:
/// no Job do Tauri costumam matar ou falhar o filho (erro 5 / exit imediato).
#[cfg(windows)]
pub(crate) fn detached_creation_flags() -> u32 {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    CREATE_NO_WINDOW
}

pub(crate) fn apply_detached(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(detached_creation_flags());
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        unsafe {
            command.pre_exec(|| {
                #[allow(non_camel_case_types)]
                type pid_t = i32;
                extern "C" {
                    fn setsid() -> pid_t;
                }
                if setsid() == -1 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
    }
}

/// Converte prefixos estilo Unix (`BROWSER=none npm start`) em env + comando.
fn peel_unix_env_prefix(line: &str) -> (std::collections::BTreeMap<String, String>, String) {
    let mut extra = std::collections::BTreeMap::new();
    let mut rest = line.trim().to_string();
    loop {
        let Some((key_part, after_eq)) = rest.split_once('=') else {
            break;
        };
        let key = key_part.trim().to_string();
        if key.is_empty()
            || key.contains(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))
            || key.contains('/')
            || key.contains('\\')
        {
            break;
        }
        let after_eq = after_eq.trim_start();
        let (value, next) = if let Some(stripped) = after_eq.strip_prefix('"') {
            match stripped.find('"') {
                Some(end) => (
                    stripped[..end].to_string(),
                    stripped[end + 1..].trim_start().to_string(),
                ),
                None => break,
            }
        } else if let Some(stripped) = after_eq.strip_prefix('\'') {
            match stripped.find('\'') {
                Some(end) => (
                    stripped[..end].to_string(),
                    stripped[end + 1..].trim_start().to_string(),
                ),
                None => break,
            }
        } else {
            let mut parts = after_eq.splitn(2, char::is_whitespace);
            let value = parts.next().unwrap_or("").to_string();
            let next = parts.next().unwrap_or("").trim_start().to_string();
            if value.is_empty() {
                break;
            }
            (value, next)
        };
        extra.insert(key, value);
        if next.is_empty() {
            rest = String::new();
            break;
        }
        rest = next;
    }
    (extra, rest)
}

/// `CI=false` em Node é truthy e o CRA trata como CI (pode sair). Omitir valores “falsos”.
fn sanitize_launch_env(
    env: &std::collections::BTreeMap<String, String>,
) -> std::collections::BTreeMap<String, String> {
    let mut out = std::collections::BTreeMap::new();
    for (key, value) in env {
        if key.eq_ignore_ascii_case("CI") {
            let trimmed = value.trim().to_ascii_lowercase();
            if trimmed.is_empty() || trimmed == "false" || trimmed == "0" || trimmed == "no" {
                continue;
            }
        }
        out.insert(key.clone(), value.clone());
    }
    out
}

fn open_log_files(log_dir: Option<&Path>) -> (std::process::Stdio, std::process::Stdio) {
    use std::fs::OpenOptions;
    use std::process::Stdio;
    let Some(dir) = log_dir else {
        return (Stdio::null(), Stdio::null());
    };
    let _ = fs::create_dir_all(dir);
    let stdout = OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("launch.out.log"))
        .ok()
        .map(Stdio::from)
        .unwrap_or_else(Stdio::null);
    let stderr = OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("launch.err.log"))
        .ok()
        .map(Stdio::from)
        .unwrap_or_else(Stdio::null);
    (stdout, stderr)
}

#[cfg(windows)]
fn spawn_windows_cmd(
    line: &str,
    work: &Path,
    env: &std::collections::BTreeMap<String, String>,
    log_dir: Option<&Path>,
) -> Result<std::process::Child, String> {
    use std::os::windows::process::CommandExt;
    use std::process::Stdio;

    let comspec = std::env::var_os("COMSPEC").unwrap_or_else(|| "cmd.exe".into());
    let (stdout, stderr) = open_log_files(log_dir);
    // `call` garante que npm.cmd (batch) corre bem sob /C sem consola.
    let script = format!("call {line}");
    let mut command = Command::new(&comspec);
    command
        .arg("/S")
        .arg("/C")
        .arg(&script)
        .current_dir(work)
        .stdin(Stdio::null())
        .stdout(stdout)
        .stderr(stderr);
    for (key, value) in env {
        command.env(key, value);
    }
    command.env("BROWSER", "none");
    // Remover CI herdado do ambiente do Painel se existir.
    command.env_remove("CI");
    command.creation_flags(detached_creation_flags());
    command
        .spawn()
        .map_err(|err| format!("Falha ao executar: {err}"))
}

pub(crate) fn spawn_command_line(
    root: &Path,
    command_line: &str,
    cwd: Option<&Path>,
) -> Result<Option<(u32, String)>, String> {
    spawn_command_line_with_env(
        root,
        command_line,
        cwd,
        &std::collections::BTreeMap::new(),
        None,
    )
}

pub(crate) fn spawn_command_line_with_env(
    root: &Path,
    command_line: &str,
    cwd: Option<&Path>,
    env: &std::collections::BTreeMap<String, String>,
    log_dir: Option<&Path>,
) -> Result<Option<(u32, String)>, String> {
    let (peeled, line) = peel_unix_env_prefix(command_line);
    let line = line.trim();
    if line.is_empty() {
        return Err("Comando de arranque vazio.".into());
    }
    let mut merged = env.clone();
    for (key, value) in peeled {
        merged.entry(key).or_insert(value);
    }
    let merged = sanitize_launch_env(&merged);
    let work = cwd.unwrap_or(root);
    let image = line
        .split_whitespace()
        .next()
        .unwrap_or("command")
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or("command")
        .to_string();
    #[cfg(windows)]
    {
        let mut child = spawn_windows_cmd(line, work, &merged, log_dir)?;
        std::thread::sleep(std::time::Duration::from_millis(800));
        match child.try_wait() {
            Ok(Some(status)) => {
                let hint = log_dir
                    .map(|dir| format!(" Veja {}\\launch.err.log", dir.display()))
                    .unwrap_or_default();
                return Err(format!(
                    "O comando terminou de imediato ({status}).{hint}"
                ));
            }
            Ok(None) => {}
            Err(err) => {
                return Err(format!("Falha ao verificar o processo: {err}"));
            }
        }
        let pid = child.id();
        std::mem::forget(child);
        let name = if line.to_lowercase().contains("npm")
            || line.to_lowercase().contains("node")
            || line.to_lowercase().contains("npx")
            || line.to_lowercase().contains("yarn")
            || line.to_lowercase().contains("pnpm")
            || line.to_lowercase().contains("bun")
        {
            "node.exe".into()
        } else if image.eq_ignore_ascii_case("cmd") || image.eq_ignore_ascii_case("cmd.exe") {
            "cmd.exe".into()
        } else if !image.contains('.') {
            format!("{image}.exe")
        } else {
            image
        };
        return Ok(Some((pid, name)));
    }
    #[cfg(not(windows))]
    {
        use std::process::Stdio;
        let (stdout, stderr) = open_log_files(log_dir);
        let mut command = Command::new("sh");
        command
            .arg("-c")
            .arg(line)
            .current_dir(work)
            .stdin(Stdio::null())
            .stdout(stdout)
            .stderr(stderr);
        for (key, value) in &merged {
            command.env(key, value);
        }
        command.env("BROWSER", "none");
        command.env_remove("CI");
        apply_detached(&mut command);
        let child = command.spawn().map_err(|err| format!("Falha ao executar: {err}"))?;
        let pid = child.id();
        std::mem::forget(child);
        Ok(Some((pid, image)))
    }
}

/// Espera a porta TCP local ficar disponível (dev server) em IPv4 e IPv6.
pub(crate) fn wait_for_port(port: u16, timeout_ms: u64) -> bool {
    use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr, TcpStream};
    use std::time::{Duration, Instant};
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let targets = [
        SocketAddr::from((Ipv4Addr::LOCALHOST, port)),
        SocketAddr::from((Ipv6Addr::LOCALHOST, port)),
    ];
    while Instant::now() < deadline {
        for addr in targets {
            if TcpStream::connect_timeout(&addr, Duration::from_millis(150)).is_ok() {
                return true;
            }
        }
        std::thread::sleep(Duration::from_millis(250));
    }
    false
}

/// Últimas linhas de ficheiros de log da app (para mensagens de erro).
pub(crate) fn tail_launch_logs(log_dir: &Path, max_lines: usize) -> String {
    let mut parts = Vec::new();
    for name in ["launch.out.log", "launch.err.log"] {
        let path = log_dir.join(name);
        let Ok(raw) = fs::read_to_string(&path) else {
            continue;
        };
        let lines: Vec<&str> = raw.lines().rev().take(max_lines).collect();
        if lines.is_empty() {
            continue;
        }
        let body: Vec<&str> = lines.into_iter().rev().collect();
        parts.push(format!("--- {name} ---\n{}", body.join("\n")));
    }
    parts.join("\n")
}

pub(crate) fn spawn_binary(
    root: &Path,
    exe: &Path,
    settings: &Value,
) -> Result<Option<(u32, String)>, String> {
    crate::launcher::launch::spawn_process_public(exe, root, settings)
}

pub(crate) fn write_text(path: &Path, raw: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::write(path, raw).map_err(|err| err.to_string())
}

pub(crate) fn relative_to(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .map(|item| item.display().to_string())
        .unwrap_or_else(|_| path.display().to_string())
        .replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn peels_unix_env_prefix() {
        let (env, cmd) = peel_unix_env_prefix("BROWSER=none npm start");
        assert_eq!(cmd, "npm start");
        assert_eq!(env.get("BROWSER").map(String::as_str), Some("none"));
        let (env2, cmd2) = peel_unix_env_prefix("PORT=3000 BROWSER=none yarn start");
        assert_eq!(cmd2, "yarn start");
        assert_eq!(env2.get("PORT").map(String::as_str), Some("3000"));
        assert_eq!(env2.get("BROWSER").map(String::as_str), Some("none"));
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("painel-runner-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn package_json_alone_does_not_detect() {
        let dir = temp_dir("node");
        fs::write(
            dir.join("package.json"),
            r#"{"name":"x","scripts":{"start":"node index.js"}}"#,
        )
        .unwrap();
        let runner = active_runner(&dir).unwrap();
        assert_eq!(runner.id(), "launchfile");
        assert!(!runner.detect(&dir));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn launchfile_roundtrip() {
        let dir = temp_dir("manifest");
        let view = create_default_manifest(&dir).unwrap();
        assert_eq!(view.runner_id, "launchfile");
        assert!(view.editable);
        let saved = save_launch_config(
            &dir,
            LaunchConfigSave {
                fields: Some(vec![
                    LaunchField::text("start", "Comando", "echo hi"),
                    LaunchField::text("name", "Nome", "demo"),
                    LaunchField::text("runtime", "Runtime", "node"),
                    LaunchField::text("kind", "Tipo", "cli"),
                ]),
                raw: None,
                create_manifest: None,
            },
        )
        .unwrap();
        assert!(saved.raw.contains("echo hi"));
        let (id, candidates) = resolve_candidates(&dir).unwrap();
        assert_eq!(id, "launchfile");
        assert_eq!(candidates[0].label, "echo hi");
        let _ = fs::remove_dir_all(&dir);
    }
}
