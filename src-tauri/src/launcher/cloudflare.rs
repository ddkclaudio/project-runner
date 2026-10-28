//! Túnel Cloudflare (quick + named) por app.
use crate::launcher::activity_log;
use crate::launcher::launchfile;
use crate::launcher::runners;
use crate::launcher::runtime;
use crate::launcher::store::{self, AppEntry};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TunnelMode {
    Quick,
    Named,
}

impl Default for TunnelMode {
    fn default() -> Self {
        Self::Quick
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudflareConfig {
    #[serde(default)]
    pub mode: TunnelMode,
    #[serde(default)]
    pub start_with_app: bool,
    #[serde(default)]
    pub port_override: Option<u16>,
    #[serde(default)]
    pub hostname: Option<String>,
    #[serde(default)]
    pub tunnel_name: Option<String>,
}

impl Default for CloudflareConfig {
    fn default() -> Self {
        Self {
            mode: TunnelMode::Quick,
            start_with_app: false,
            port_override: None,
            hostname: None,
            tunnel_name: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TunnelRuntime {
    pid: u32,
    mode: TunnelMode,
    public_url: Option<String>,
    port: u16,
    started_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostnameClaim {
    pub hostname: String,
    pub folder_name: String,
    pub name: String,
    pub repository: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudflareView {
    pub config: CloudflareConfig,
    pub effective_port: Option<u16>,
    pub cloudflared_available: bool,
    /// Binário efectivo usado (custom ou detectado).
    pub cloudflared_path: String,
    /// Caminho absoluto encontrado via `where`/`which` (se houver).
    pub cloudflared_detected: Option<String>,
    pub has_api_token: bool,
    pub running: bool,
    pub public_url: Option<String>,
    pub pid: Option<u32>,
    pub mode: Option<TunnelMode>,
    /// Hostnames Cloudflare (modo domínio) já reservados por apps desta org.
    pub hostname_claims: Vec<HostnameClaim>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudflareSaveInput {
    pub mode: TunnelMode,
    pub start_with_app: bool,
    pub port_override: Option<u16>,
    pub hostname: Option<String>,
    pub tunnel_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudflareZone {
    pub id: String,
    pub name: String,
}

fn folder_key(app: &AppEntry) -> String {
    let folder = app.folder_name.trim();
    if folder.is_empty() {
        store::sanitize_folder(&app.name)
    } else {
        folder.to_string()
    }
}

fn config_path(info: &Path) -> PathBuf {
    info.join("cloudflare.json")
}

fn creds_path(info: &Path) -> PathBuf {
    info.join("cloudflare-credentials.json")
}

fn conf_path(info: &Path) -> PathBuf {
    info.join("cloudflare-config.yml")
}

fn tunnels_path(meta: &Path) -> PathBuf {
    meta.join("tunnels.json")
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn load_tunnels(meta: &Path) -> Value {
    fs::read_to_string(tunnels_path(meta))
        .ok()
        .map(|raw| raw.trim_start_matches('\u{feff}').to_string())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_else(|| json!({}))
}

fn save_tunnels(meta: &Path, map: &Value) -> Result<(), String> {
    store::ensure_root(meta)?;
    let raw = serde_json::to_string_pretty(map).map_err(|err| err.to_string())?;
    fs::write(tunnels_path(meta), raw).map_err(|err| err.to_string())
}

pub fn load_config(info: &Path) -> CloudflareConfig {
    fs::read_to_string(config_path(info))
        .ok()
        .map(|raw| raw.trim_start_matches('\u{feff}').to_string())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

/// Hostnames named já guardados em `cloudflare.json` das apps da org.
pub fn list_hostname_claims(meta: &Path, workspace: &Path) -> Vec<HostnameClaim> {
    let apps = store::load_apps(meta);
    let mut claims = Vec::new();
    for app in apps {
        let info = store::launch_info_dir(workspace, &app);
        let host = load_config(&info)
            .hostname
            .map(|h| h.trim().to_string())
            .filter(|h| !h.is_empty());
        let Some(hostname) = host else {
            continue;
        };
        claims.push(HostnameClaim {
            hostname,
            folder_name: folder_key(&app),
            name: app.name.clone(),
            repository: app.repository.clone(),
        });
    }
    claims.sort_by(|a, b| {
        a.hostname
            .to_lowercase()
            .cmp(&b.hostname.to_lowercase())
            .then_with(|| a.folder_name.to_lowercase().cmp(&b.folder_name.to_lowercase()))
    });
    claims
}

pub fn hostname_conflict(
    meta: &Path,
    workspace: &Path,
    hostname: &str,
    exclude_folder: &str,
) -> Option<HostnameClaim> {
    let want = hostname.trim().to_lowercase();
    if want.is_empty() {
        return None;
    }
    list_hostname_claims(meta, workspace)
        .into_iter()
        .find(|claim| {
            claim.hostname.eq_ignore_ascii_case(&want)
                && !claim.folder_name.eq_ignore_ascii_case(exclude_folder)
        })
}

fn conflict_error(hostname: &str, owner: &HostnameClaim) -> String {
    format!(
        "O hostname «{hostname}» já está em uso pela app «{}» (pasta {}). Abre Cloudflare dessa app para o libertar ou escolhe outro subdomínio.",
        owner.name, owner.folder_name
    )
}

pub fn save_config(
    meta: &Path,
    workspace: &Path,
    info: &Path,
    app: &AppEntry,
    input: CloudflareSaveInput,
) -> Result<CloudflareConfig, String> {
    let folder = folder_key(app);
    let hostname = input
        .hostname
        .as_ref()
        .map(|h| h.trim().to_string())
        .filter(|h| !h.is_empty());
    if let Some(ref host) = hostname {
        if let Some(owner) = hostname_conflict(meta, workspace, host, &folder) {
            let err = conflict_error(host, &owner);
            activity_log::warn("cloudflare", &format!("save blocked folder={folder}: {err}"));
            return Err(err);
        }
    }

    fs::create_dir_all(info).map_err(|err| err.to_string())?;
    let config = CloudflareConfig {
        mode: input.mode,
        start_with_app: input.start_with_app,
        port_override: input.port_override.filter(|p| *p > 0),
        hostname,
        tunnel_name: input
            .tunnel_name
            .map(|n| n.trim().to_string())
            .filter(|n| !n.is_empty()),
    };
    let raw = serde_json::to_string_pretty(&config).map_err(|err| err.to_string())?;
    fs::write(config_path(info), raw).map_err(|err| err.to_string())?;
    Ok(config)
}

fn port_from_url(raw: &str) -> Option<u16> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    // http://localhost:3000/... ou http://127.0.0.1:3000
    if let Some(after) = trimmed
        .strip_prefix("http://")
        .or_else(|| trimmed.strip_prefix("https://"))
    {
        let hostport = after.split('/').next().unwrap_or(after);
        if let Some((_, port_str)) = hostport.rsplit_once(':') {
            if let Ok(port) = port_str.parse::<u16>() {
                if port > 0 {
                    return Some(port);
                }
            }
        }
    }
    None
}

/// Porta da app: Launchfile da branch → open_url.txt (mesma porta em que a app corre).
fn resolve_port(launch_dir: &Path, info: &Path) -> Option<u16> {
    if let Ok(doc) = launchfile::read(launch_dir) {
        if let Some(port) = launchfile::effective_port(&doc) {
            return Some(port);
        }
        if let Some(url) = launchfile::open_url_of(&doc) {
            if let Some(port) = port_from_url(&url) {
                return Some(port);
            }
        }
    }
    let open_url = info.join("open_url.txt");
    if let Ok(raw) = fs::read_to_string(&open_url) {
        if let Some(port) = port_from_url(raw.trim_start_matches('\u{feff}').trim()) {
            return Some(port);
        }
    }
    None
}

fn looks_like_cloudflared(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    Command::new(path)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Descobre o executável com `where` (Windows) / `which` (Unix) e pastas comuns.
pub fn detect_cloudflared() -> Option<String> {
    let finder = if cfg!(windows) { "where" } else { "which" };
    if let Ok(output) = Command::new(finder).arg("cloudflared").output() {
        if output.status.success() {
            for line in String::from_utf8_lossy(&output.stdout).lines() {
                let candidate = line.trim();
                if candidate.is_empty() {
                    continue;
                }
                let path = PathBuf::from(candidate);
                if looks_like_cloudflared(&path) {
                    return Some(path.display().to_string());
                }
            }
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if cfg!(windows) {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            candidates.push(local.join("cloudflared").join("cloudflared.exe"));
            candidates.push(local.join("Programs").join("cloudflared").join("cloudflared.exe"));
        }
        if let Ok(pf) = std::env::var("ProgramFiles") {
            candidates.push(PathBuf::from(pf).join("cloudflared").join("cloudflared.exe"));
        }
        if let Ok(pf86) = std::env::var("ProgramFiles(x86)") {
            candidates.push(PathBuf::from(pf86).join("cloudflared").join("cloudflared.exe"));
        }
        candidates.push(PathBuf::from(r"C:\ProgramData\chocolatey\bin\cloudflared.exe"));
        candidates.push(PathBuf::from(r"C:\cloudflared\cloudflared.exe"));
    } else {
        candidates.push(PathBuf::from("/usr/local/bin/cloudflared"));
        candidates.push(PathBuf::from("/usr/bin/cloudflared"));
        candidates.push(PathBuf::from("/opt/homebrew/bin/cloudflared"));
        if let Ok(home) = std::env::var("HOME") {
            candidates.push(PathBuf::from(home).join(".local").join("bin").join("cloudflared"));
        }
    }

    for path in candidates {
        if looks_like_cloudflared(&path) {
            return Some(path.display().to_string());
        }
    }
    None
}

fn cloudflared_bin(meta: &Path) -> (String, Option<String>) {
    let custom = store::cloudflared_path_of(meta);
    let detected = detect_cloudflared();
    if !custom.trim().is_empty() {
        let custom = custom.trim().to_string();
        if looks_like_cloudflared(Path::new(&custom)) {
            return (custom, detected);
        }
        // Custom inválido — tentar detectado
        if let Some(ref det) = detected {
            return (det.clone(), detected);
        }
        return (custom, detected);
    }
    if let Some(ref det) = detected {
        return (det.clone(), detected);
    }
    ("cloudflared".into(), None)
}

fn cloudflared_available(bin: &str) -> bool {
    looks_like_cloudflared(Path::new(bin))
        || Command::new(bin)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
}

fn pid_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    if cfg!(windows) {
        Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}"), "/NH"])
            .output()
            .ok()
            .map(|out| String::from_utf8_lossy(&out.stdout).contains(&pid.to_string()))
            .unwrap_or(false)
    } else {
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
}

pub fn tunnel_is_running(meta: &Path, app: &AppEntry) -> bool {
    runtime_of(meta, &folder_key(app)).is_some()
}

fn runtime_of(meta: &Path, folder: &str) -> Option<TunnelRuntime> {
    let map = load_tunnels(meta);
    let entry = map.get(folder)?;
    let runtime: TunnelRuntime = serde_json::from_value(entry.clone()).ok()?;
    if pid_alive(runtime.pid) {
        Some(runtime)
    } else {
        let mut map = load_tunnels(meta);
        if let Some(obj) = map.as_object_mut() {
            obj.remove(folder);
            let _ = save_tunnels(meta, &map);
        }
        None
    }
}

fn record_runtime(meta: &Path, folder: &str, runtime: &TunnelRuntime) -> Result<(), String> {
    let mut map = load_tunnels(meta);
    map[folder] = serde_json::to_value(runtime).map_err(|err| err.to_string())?;
    save_tunnels(meta, &map)
}

fn clear_runtime(meta: &Path, folder: &str) -> Result<(), String> {
    let mut map = load_tunnels(meta);
    if let Some(obj) = map.as_object_mut() {
        obj.remove(folder);
    }
    save_tunnels(meta, &map)
}

fn pending_urls() -> &'static Mutex<HashMap<String, String>> {
    static MAP: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    MAP.get_or_init(|| Mutex::new(HashMap::new()))
}

fn extract_trycloudflare_url(line: &str) -> Option<String> {
    if let Some(idx) = line.find("https://") {
        let rest = &line[idx..];
        let end = rest
            .find(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == '|')
            .unwrap_or(rest.len());
        let url = rest[..end].trim_end_matches(|c: char| c == '.' || c == ')' || c == ',');
        if url.contains("trycloudflare.com") {
            return Some(url.to_string());
        }
    }
    None
}

fn cloudflare_process_log(info: &Path) -> PathBuf {
    info.join("cloudflare.out.log")
}

fn append_process_log(path: &Path, line: &str) {
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) else {
        return;
    };
    let _ = writeln!(file, "{line}");
}

/// Guarda a URL quick assim que o cloudflared a imprime (memória + tunnels.json).
fn note_public_url(meta: &Path, folder: &str, url: &str) {
    if let Ok(mut map) = pending_urls().lock() {
        map.insert(folder.to_string(), url.to_string());
    }
    let mut map = load_tunnels(meta);
    if let Some(entry) = map.get_mut(folder) {
        if let Some(obj) = entry.as_object_mut() {
            obj.insert("publicUrl".into(), json!(url));
            let _ = save_tunnels(meta, &map);
        }
    }
    activity_log::info("cloudflare", &format!("url folder={folder} {url}"));
}

fn watch_cloudflared_output(
    stream: impl std::io::Read + Send + 'static,
    meta: PathBuf,
    folder: String,
    log_path: PathBuf,
) {
    thread::spawn(move || {
        for line in BufReader::new(stream).lines().flatten() {
            append_process_log(&log_path, &line);
            if let Some(url) = extract_trycloudflare_url(&line) {
                note_public_url(&meta, &folder, &url);
            }
        }
    });
}

fn spawn_cloudflared(bin: &str, args: &[&str]) -> Result<std::process::Child, String> {
    let mut command = Command::new(bin);
    command.args(args).stdout(Stdio::piped()).stderr(Stdio::piped());
    runners::apply_detached(&mut command);
    command
        .spawn()
        .map_err(|err| format!("Falha ao iniciar cloudflared: {err}"))
}

pub fn view(meta: &Path, workspace: &Path, info: &Path, app: &AppEntry) -> CloudflareView {
    let config = load_config(info);
    let (bin, detected) = cloudflared_bin(meta);
    let available = cloudflared_available(&bin);
    let token = store::cloudflare_token_of(meta);
    let folder = folder_key(app);
    let mut runtime = runtime_of(meta, &folder);
    // Actualizar URL se a thread do quick tunnel já a tiver
    if let Some(ref mut rt) = runtime {
        if rt.public_url.is_none() {
            if let Ok(map) = pending_urls().lock() {
                if let Some(url) = map.get(&folder) {
                    rt.public_url = Some(url.clone());
                    let _ = record_runtime(meta, &folder, rt);
                }
            }
        }
    }
    let launch_dir = store::active_launch_dir(meta, workspace, app).unwrap_or_else(|_| info.to_path_buf());
    CloudflareView {
        config: config.clone(),
        effective_port: resolve_port(&launch_dir, info),
        cloudflared_available: available,
        cloudflared_path: bin,
        cloudflared_detected: detected,
        has_api_token: !token.trim().is_empty(),
        running: runtime.is_some(),
        public_url: runtime.as_ref().and_then(|r| r.public_url.clone()),
        pid: runtime.as_ref().map(|r| r.pid),
        mode: runtime.as_ref().map(|r| r.mode.clone()),
        hostname_claims: list_hostname_claims(meta, workspace),
    }
}

pub fn stop_tunnel(
    meta: &Path,
    workspace: &Path,
    info: &Path,
    app: &AppEntry,
) -> Result<CloudflareView, String> {
    let folder = folder_key(app);
    if let Some(runtime) = runtime_of(meta, &folder) {
        activity_log::info(
            "cloudflare",
            &format!("stop folder={folder} pid={} mode={:?}", runtime.pid, runtime.mode),
        );
        let _ = runtime::kill_pid_tree(runtime.pid);
        clear_runtime(meta, &folder)?;
    } else {
        activity_log::info("cloudflare", &format!("stop folder={folder} (já parado)"));
    }
    if let Ok(mut map) = pending_urls().lock() {
        map.remove(&folder);
    }
    Ok(view(meta, workspace, info, app))
}

pub async fn start(
    meta: &Path,
    workspace: &Path,
    info: &Path,
    app: &AppEntry,
) -> Result<CloudflareView, String> {
    let folder = folder_key(app);
    if !crate::launcher::runtime::is_running(meta, &app.folder_name) {
        let err = "A app tem de estar a correr para iniciar o túnel.".to_string();
        activity_log::warn("cloudflare", &format!("start blocked folder={folder}: {err}"));
        return Err(err);
    }
    if runtime_of(meta, &folder).is_some() {
        let err = "Já existe um túnel a correr para esta app. Pare-o primeiro.".to_string();
        activity_log::warn("cloudflare", &format!("start blocked folder={folder}: {err}"));
        return Err(err);
    }

    let config = load_config(info);
    if config.mode == TunnelMode::Named {
        if let Some(ref host) = config.hostname {
            if let Some(owner) = hostname_conflict(meta, workspace, host, &folder) {
                let err = conflict_error(host, &owner);
                activity_log::warn("cloudflare", &format!("start blocked folder={folder}: {err}"));
                return Err(err);
            }
        }
    }
    let launch_dir = store::active_launch_dir(meta, workspace, app).unwrap_or_else(|_| info.to_path_buf());
    let port = match resolve_port(&launch_dir, info) {
        Some(port) => port,
        None => {
            let err = "Defina a porta (Launchfile ou override) antes de iniciar o túnel.".to_string();
            activity_log::error("cloudflare", &format!("start folder={folder}"), Some(&err));
            return Err(err);
        }
    };
    let (bin, _) = cloudflared_bin(meta);
    if !cloudflared_available(&bin) {
        let err = "cloudflared não encontrado. Instale-o (https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/) ou indique o caminho completo nas credenciais.".to_string();
        activity_log::error("cloudflare", &format!("start folder={folder} bin={bin}"), Some(&err));
        return Err(err);
    }

    activity_log::info(
        "cloudflare",
        &format!(
            "start folder={folder} mode={:?} port={port} bin={bin}",
            config.mode
        ),
    );

    let result = match config.mode {
        TunnelMode::Quick => start_quick(meta, workspace, info, app, &bin, port).await,
        TunnelMode::Named => start_named(meta, workspace, info, app, &bin, port, &config).await,
    };
    match &result {
        Ok(view) => activity_log::info(
            "cloudflare",
            &format!(
                "start ok folder={folder} running={} url={}",
                view.running,
                view.public_url.as_deref().unwrap_or("(pendente)")
            ),
        ),
        Err(err) => activity_log::error("cloudflare", &format!("start failed folder={folder}"), Some(err)),
    }
    result
}

async fn start_quick(
    meta: &Path,
    workspace: &Path,
    info: &Path,
    app: &AppEntry,
    bin: &str,
    port: u16,
) -> Result<CloudflareView, String> {
    let folder = folder_key(app);
    let url_arg = format!("http://127.0.0.1:{port}");
    let log_path = cloudflare_process_log(info);
    let _ = fs::write(
        &log_path,
        format!(
            "--- quick tunnel start {} port={port} bin={bin} ---\n",
            now_secs()
        ),
    );

    let mut child = spawn_cloudflared(bin, &["tunnel", "--url", &url_arg, "--no-autoupdate"])?;
    let pid = child.id();
    activity_log::info(
        "cloudflare",
        &format!("quick spawned folder={folder} pid={pid} target={url_arg}"),
    );

    // Registar runtime cedo para a UI poder fazer poll enquanto a URL chega.
    let runtime = TunnelRuntime {
        pid,
        mode: TunnelMode::Quick,
        public_url: None,
        port,
        started_at: now_secs(),
    };
    record_runtime(meta, &folder, &runtime)?;

    if let Some(stdout) = child.stdout.take() {
        watch_cloudflared_output(stdout, meta.to_path_buf(), folder.clone(), log_path.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        watch_cloudflared_output(stderr, meta.to_path_buf(), folder.clone(), log_path.clone());
    }
    std::mem::forget(child);

    let deadline = Instant::now() + Duration::from_secs(45);
    let mut public_url = None;
    while Instant::now() < deadline {
        if let Ok(map) = pending_urls().lock() {
            if let Some(url) = map.get(&folder) {
                public_url = Some(url.clone());
                break;
            }
        }
        if !pid_alive(pid) {
            let tail = tail_file(&log_path, 30);
            let err = format!(
                "cloudflared terminou antes de publicar a URL. Verifique a porta e a instalação.\n{tail}"
            );
            clear_runtime(meta, &folder)?;
            return Err(err);
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }

    if let Some(ref url) = public_url {
        note_public_url(meta, &folder, url);
    } else {
        activity_log::warn(
            "cloudflare",
            &format!(
                "quick URL ainda pendente após 45s folder={folder} pid={pid} (continua a correr; ver cloudflare.out.log)"
            ),
        );
    }
    Ok(view(meta, workspace, info, app))
}

fn tail_file(path: &Path, max_lines: usize) -> String {
    let Ok(raw) = fs::read_to_string(path) else {
        return String::new();
    };
    let lines: Vec<&str> = raw.lines().collect();
    let start = lines.len().saturating_sub(max_lines);
    lines[start..].join("\n")
}

async fn start_named(
    meta: &Path,
    workspace: &Path,
    info: &Path,
    app: &AppEntry,
    bin: &str,
    port: u16,
    config: &CloudflareConfig,
) -> Result<CloudflareView, String> {
    let hostname = config
        .hostname
        .as_deref()
        .map(str::trim)
        .filter(|h| !h.is_empty())
        .ok_or_else(|| "Indique o hostname (ex. app.meudominio.com) para o modo Domínio.".to_string())?;

    let token = store::cloudflare_token_of(meta);
    if token.trim().is_empty() {
        return Err("Configure o token da API Cloudflare em Definições → Cloudflare.".into());
    }

    let folder = folder_key(app);
    if let Some(owner) = hostname_conflict(meta, workspace, hostname, &folder) {
        return Err(conflict_error(hostname, &owner));
    }
    let tunnel_name = config
        .tunnel_name
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty())
        .map(|n| n.to_string())
        .unwrap_or_else(|| format!("painel-{}", sanitize_name(&folder)));

    fs::create_dir_all(info).map_err(|e| e.to_string())?;

    let (tunnel_id, credentials) = if creds_path(info).is_file() {
        let raw = fs::read_to_string(creds_path(info)).map_err(|e| e.to_string())?;
        let creds: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
        let id = creds
            .get("TunnelID")
            .or_else(|| creds.get("TunnelId"))
            .or_else(|| creds.get("tunnelID"))
            .and_then(|v| v.as_str())
            .ok_or("Credenciais locais sem TunnelID. Apague cloudflare-credentials.json e tente de novo.")?
            .to_string();
        (id, creds)
    } else {
        let account_id = cf_account_id(&token).await?;
        let (id, creds) = create_tunnel(&token, &account_id, &tunnel_name).await?;
        fs::write(
            creds_path(info),
            serde_json::to_string_pretty(&creds).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        (id, creds)
    };
    let _ = credentials;

    ensure_dns_cname(&token, hostname, &tunnel_id).await?;

    let conf = format!(
        "tunnel: {tunnel_id}\ncredentials-file: {}\ningress:\n  - hostname: {hostname}\n    service: http://127.0.0.1:{port}\n  - service: http_status:404\n",
        creds_path(info).display().to_string().replace('\\', "/")
    );
    fs::write(conf_path(info), conf).map_err(|e| e.to_string())?;

    let conf_str = conf_path(info)
        .to_str()
        .ok_or("Caminho de config inválido.")?
        .to_string();
    let log_path = cloudflare_process_log(info);
    let _ = fs::write(
        &log_path,
        format!(
            "--- named tunnel start {} hostname={hostname} tunnel={tunnel_id} ---\n",
            now_secs()
        ),
    );

    let mut child = spawn_cloudflared(
        bin,
        &[
            "tunnel",
            "--config",
            &conf_str,
            "--no-autoupdate",
            "run",
            &tunnel_id,
        ],
    )?;

    let pid = child.id();
    activity_log::info(
        "cloudflare",
        &format!("named spawned folder={folder} pid={pid} hostname={hostname}"),
    );

    if let Some(stdout) = child.stdout.take() {
        watch_cloudflared_output(stdout, meta.to_path_buf(), folder.clone(), log_path.clone());
    }
    if let Some(stderr) = child.stderr.take() {
        watch_cloudflared_output(stderr, meta.to_path_buf(), folder.clone(), log_path.clone());
    }
    std::mem::forget(child);

    tokio::time::sleep(Duration::from_secs(2)).await;
    if !pid_alive(pid) {
        let tail = tail_file(&log_path, 30);
        return Err(format!(
            "cloudflared terminou imediatamente. Verifique o token, o hostname e as permissões DNS.\n{tail}"
        ));
    }

    let public = format!("https://{hostname}");
    let runtime = TunnelRuntime {
        pid,
        mode: TunnelMode::Named,
        public_url: Some(public.clone()),
        port,
        started_at: now_secs(),
    };
    record_runtime(meta, &folder, &runtime)?;
    activity_log::info("cloudflare", &format!("named url folder={folder} {public}"));
    Ok(view(meta, workspace, info, app))
}

fn sanitize_name(raw: &str) -> String {
    let s: String = raw
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    s.trim_matches('-').to_lowercase()
}

async fn cf_api(token: &str, method: reqwest::Method, url: &str, body: Option<Value>) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let mut req = client
        .request(method, url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Content-Type", "application/json");
    if let Some(body) = body {
        req = req.json(&body);
    }
    let res = req.send().await.map_err(|e| format!("Cloudflare API: {e}"))?;
    let status = res.status();
    let value: Value = res.json().await.map_err(|e| format!("Cloudflare API JSON: {e}"))?;
    if !status.is_success() || value.get("success").and_then(|v| v.as_bool()) == Some(false) {
        let errors = value
            .get("errors")
            .and_then(|e| e.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|e| e.get("message").and_then(|m| m.as_str()))
                    .collect::<Vec<_>>()
                    .join("; ")
            })
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| format!("HTTP {status}"));
        return Err(format!("Cloudflare API: {errors}"));
    }
    Ok(value)
}

async fn cf_account_id(token: &str) -> Result<String, String> {
    // Preferir /accounts; muitos tokens de Tunnel+DNS não têm Account Settings Read —
    // nesse caso tiramos o account id da lista de zonas (já funciona com Zone Read).
    if let Ok(value) = cf_api(
        token,
        reqwest::Method::GET,
        "https://api.cloudflare.com/client/v4/accounts?per_page=1",
        None,
    )
    .await
    {
        if let Some(id) = value
            .pointer("/result/0/id")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
        {
            return Ok(id.to_string());
        }
    }

    let zones = cf_api(
        token,
        reqwest::Method::GET,
        "https://api.cloudflare.com/client/v4/zones?per_page=1",
        None,
    )
    .await
    .map_err(|err| {
        format!(
            "{err} Não foi possível obter a conta Cloudflare. Verifique o token (Tunnel Edit + Zone DNS Edit + Zone Read)."
        )
    })?;

    zones
        .pointer("/result/0/account/id")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            "Não foi possível obter a conta Cloudflare a partir das zonas. Confirme o token e que existe pelo menos um domínio na conta.".to_string()
        })
}

/// Lista zonas DNS da conta (requer Zone → Zone → Read no token).
pub async fn list_zones(meta: &Path) -> Result<Vec<CloudflareZone>, String> {
    let token = store::cloudflare_token_of(meta);
    if token.trim().is_empty() {
        let err = "Configure o token da API Cloudflare em Credenciais antes de listar domínios.".to_string();
        activity_log::warn("cloudflare", &err);
        return Err(err);
    }

    let value = match cf_api(
        token.trim(),
        reqwest::Method::GET,
        "https://api.cloudflare.com/client/v4/zones?per_page=50",
        None,
    )
    .await
    {
        Ok(value) => value,
        Err(err) => {
            let msg = format!(
                "{err} Para listar domínios o token precisa de Zone → Zone → Read (além de Tunnel Edit e DNS Edit)."
            );
            activity_log::error("cloudflare", "zones list failed", Some(&msg));
            return Err(msg);
        }
    };

    let mut zones: Vec<CloudflareZone> = value
        .get("result")
        .and_then(|r| r.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|z| {
                    let id = z.get("id")?.as_str()?.to_string();
                    let name = z.get("name")?.as_str()?.to_string();
                    if id.is_empty() || name.is_empty() {
                        return None;
                    }
                    Some(CloudflareZone { id, name })
                })
                .collect()
        })
        .unwrap_or_default();

    zones.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    activity_log::info(
        "cloudflare",
        &format!("zones list ok count={}", zones.len()),
    );
    Ok(zones)
}

async fn create_tunnel(token: &str, account_id: &str, name: &str) -> Result<(String, Value), String> {
    let create_url = format!("https://api.cloudflare.com/client/v4/accounts/{account_id}/cfd_tunnel");
    let created = match cf_api(
        token,
        reqwest::Method::POST,
        &create_url,
        Some(json!({
            "name": name,
            "config_src": "local"
        })),
    )
    .await
    {
        Ok(value) => value,
        Err(err) => {
            return Err(format!(
                "{err} Se o túnel «{name}» já existe sem credentials locais, apague-o na Cloudflare Zero Trust ou escolha outro nome."
            ));
        }
    };

    let result = created.get("result").ok_or("Resposta create tunnel inválida.")?;
    let id = result
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or("Túnel criado sem id.")?
        .to_string();
    let credentials = result
        .get("credentials_file")
        .cloned()
        .or_else(|| {
            Some(json!({
                "AccountTag": result.get("account_tag")?.clone(),
                "TunnelSecret": result.get("tunnel_secret")?.clone(),
                "TunnelID": id.clone(),
            }))
        })
        .ok_or(
            "Túnel criado sem credentials. O token precisa de permissão Account → Cloudflare Tunnel → Edit.",
        )?;

    Ok((id, credentials))
}

async fn ensure_dns_cname(token: &str, hostname: &str, tunnel_id: &str) -> Result<(), String> {
    let parts: Vec<&str> = hostname.split('.').collect();
    if parts.len() < 2 {
        return Err("Hostname inválido. Use um FQDN (ex. app.meudominio.com).".into());
    }
    let mut zone_id = None;
    for i in 0..parts.len().saturating_sub(1) {
        let candidate = parts[i..].join(".");
        let url = format!("https://api.cloudflare.com/client/v4/zones?name={candidate}");
        if let Ok(value) = cf_api(token, reqwest::Method::GET, &url, None).await {
            if let Some(id) = value.pointer("/result/0/id").and_then(|v| v.as_str()) {
                zone_id = Some(id.to_string());
                break;
            }
        }
    }
    let zone_id = zone_id.ok_or_else(|| {
        format!("Não foi encontrada uma zona Cloudflare para «{hostname}». Confirme o domínio na conta.")
    })?;
    let target = format!("{tunnel_id}.cfargotunnel.com");

    let list_url = format!(
        "https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records?type=CNAME&name={hostname}"
    );
    let listed = cf_api(token, reqwest::Method::GET, &list_url, None).await?;
    if let Some(existing) = listed.pointer("/result/0") {
        let id = existing.get("id").and_then(|v| v.as_str()).unwrap_or("");
        if !id.is_empty() {
            let content = existing.get("content").and_then(|v| v.as_str()).unwrap_or("");
            if content.eq_ignore_ascii_case(&target) {
                return Ok(());
            }
            let put_url = format!("https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records/{id}");
            cf_api(
                token,
                reqwest::Method::PUT,
                &put_url,
                Some(json!({
                    "type": "CNAME",
                    "name": hostname,
                    "content": target,
                    "proxied": true,
                    "ttl": 1
                })),
            )
            .await?;
            return Ok(());
        }
    }

    let create_url = format!("https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records");
    cf_api(
        token,
        reqwest::Method::POST,
        &create_url,
        Some(json!({
            "type": "CNAME",
            "name": hostname,
            "content": target,
            "proxied": true,
            "ttl": 1
        })),
    )
    .await?;
    Ok(())
}
