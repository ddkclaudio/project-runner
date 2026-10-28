use crate::launcher::runners;
use crate::launcher::store::{self, find_app, install_dir, load_apps};
use chrono::Local;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResult {
    pub started: bool,
    pub needs_choice: bool,
    /// Porta ocupada por outro processo — UI deve pedir confirmação para forçar.
    pub needs_force: bool,
    pub executables: Vec<String>,
    pub close_after_launch: bool,
    pub message: String,
    /// URL local (ex. http://localhost:3000) quando a app é web/Node.
    pub open_url: Option<String>,
    pub force_port: Option<u16>,
    pub force_pid: Option<u32>,
    pub force_process_name: Option<String>,
}

fn no_window(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let _ = command;
}

pub fn executables_for(meta: &Path, workspace: &Path, repository: &str) -> Result<Vec<String>, String> {
    let apps = load_apps(meta);
    let app = find_app(&apps, repository)?;
    let info = store::ensure_launch_info(workspace, app)?;
    let project = install_dir(workspace, app);
    if !project.is_dir() {
        return Err("Esta app não está instalada.".into());
    }
    let (_, candidates) = runners::resolve_candidates(&info)?;
    Ok(candidates.into_iter().map(|item| item.label).collect())
}

pub fn set_executable(meta: &Path, workspace: &Path, repository: &str, executable: &str) -> Result<(), String> {
    let apps = load_apps(meta);
    let app = find_app(&apps, repository)?;
    let info = store::ensure_launch_info(workspace, app)?;
    let id = match runners::resolve_candidates(&info) {
        Ok((_, candidates)) => candidates
            .iter()
            .find(|item| item.label == executable.trim() || item.id == executable.trim())
            .map(|item| item.id.clone())
            .unwrap_or_else(|| executable.trim().to_string()),
        Err(_) => executable.trim().to_string(),
    };
    fs::write(info.join("selected_executable.txt"), id).map_err(|err| err.to_string())
}

pub async fn launch(
    meta: &Path,
    workspace: &Path,
    repository: &str,
    _executable: Option<String>,
    force: bool,
    on_progress: &impl Fn(u32, &str),
) -> Result<LaunchResult, String> {
    let apps = load_apps(meta);
    let app = find_app(&apps, repository)?.clone();
    let runtime_key = app.folder_name.clone();
    let _ = store::migrate_legacy_install(workspace, &app);
    let project = install_dir(workspace, &app);
    if !project.is_dir() {
        return Err("Esta app não está instalada.".into());
    }
    let info = store::ensure_launch_info(workspace, &app)?;
    on_progress(3, "A preparar Launchfile…");

    if !crate::launcher::launchfile::exists(&info) {
        let token = store::deepseek_token_of(meta);
        crate::launcher::deepseek::ensure_launchfile(&project, &info, &token, on_progress).await?;
    }

    let doc = crate::launcher::launchfile::read(&info)?;
    let port = crate::launcher::launchfile::effective_port(&doc);

    crate::launcher::activity_log::info(
        "launch",
        &format!(
            "start folder={} repo={} force={} port={:?}",
            runtime_key, app.repository, force, port
        ),
    );

    // Sempre: se a porta do Launchfile já está em uso → modal (Start e Lançar).
    if let Some(port) = port {
        if let Some((pid, process_name)) = crate::launcher::runtime::port_occupant(port) {
            if !force {
                crate::launcher::activity_log::warn(
                    "launch",
                    &format!("needs_force port={port} pid={pid} name={process_name}"),
                );
                return Ok(LaunchResult {
                    started: false,
                    needs_choice: false,
                    needs_force: true,
                    executables: vec![doc.start.clone()],
                    close_after_launch: false,
                    message: format!(
                        "A porta {port} está em uso por {process_name} (PID {pid}). Quer forçar a inicialização e libertar a porta?"
                    ),
                    open_url: None,
                    force_port: Some(port),
                    force_pid: Some(pid),
                    force_process_name: Some(process_name),
                });
            }
            on_progress(48, &format!("A libertar porta {port}…"));
            crate::launcher::activity_log::info(
                "launch",
                &format!("force: a libertar porta {port} (occupant {process_name}/{pid})"),
            );
            crate::launcher::runtime::free_port(port)?;
            let _ = crate::launcher::runtime::clear_running_for_port(meta, port);
            let _ = crate::launcher::runtime::clear(meta, &runtime_key);
            if crate::launcher::runtime::port_occupant(port).is_some() {
                let err = format!(
                    "A porta {port} continua ocupada após forçar. Feche o processo manualmente e tente de novo."
                );
                crate::launcher::activity_log::error("launch", &err, None);
                return Err(err);
            }
        }
    }

    if crate::launcher::runtime::is_running(meta, &runtime_key) {
        let _ = crate::launcher::runtime::stop(meta, &runtime_key);
    }

    if crate::launcher::launchfile::needs_install(&project, &doc) {
        if let Some(install) = doc.install.as_ref().map(|item| item.trim()).filter(|item| !item.is_empty()) {
            on_progress(55, "A instalar dependências…");
            crate::launcher::activity_log::info("launch", &format!("install: {install}"));
            runners::run_command_wait(&project, install)?;
            on_progress(70, "Dependências instaladas");
        }
    }

    let work = doc
        .cwd
        .as_ref()
        .map(|item| project.join(item))
        .filter(|path| path.is_dir())
        .unwrap_or_else(|| project.clone());
    let settings = store::load_settings(meta);
    let open_url = crate::launcher::launchfile::open_url_of(&doc);

    let out_mark = fs::metadata(info.join("launch.out.log"))
        .map(|m| m.len())
        .unwrap_or(0);

    on_progress(75, "A arrancar o processo…");
    let spawned =
        runners::spawn_command_line_with_env(&project, &doc.start, Some(&work), &doc.env, Some(&info))?;
    let Some((wrapper_pid, wrapper_name)) = spawned else {
        return Err("O comando de arranque não devolveu um processo.".into());
    };
    crate::launcher::activity_log::info(
        "launch",
        &format!("spawned wrapper pid={wrapper_pid} name={wrapper_name}"),
    );

    if let Some(port) = port {
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(45);
        let mut ready = false;
        let mut tick = 0u32;
        while std::time::Instant::now() < deadline {
            let wait_pct = 80 + (tick.min(14));
            on_progress(wait_pct, &format!("À espera da porta {port}…"));
            tick = tick.saturating_add(1);
            if runners::wait_for_port(port, 1_000) {
                ready = true;
                break;
            }
            if launch_out_grew_with_port_busy(&info, out_mark) {
                let _ = crate::launcher::runtime::kill_pid_tree(wrapper_pid);
                let tail = runners::tail_launch_logs(&info, 20);
                let err = format!(
                    "A porta {port} ainda estava ocupada ao arrancar (o servidor não fez bind). Veja o log:\n{tail}"
                );
                crate::launcher::activity_log::error("launch", "port still busy after spawn", Some(&tail));
                return Err(err);
            }
        }
        if !ready {
            let tail = runners::tail_launch_logs(&info, 25);
            let err = format!(
                "O processo arrancou (PID {wrapper_pid}) mas a porta {port} não ficou à escuta.\n{tail}"
            );
            crate::launcher::activity_log::error("launch", "wait_for_port timeout", Some(&tail));
            return Err(err);
        }
    }

    on_progress(96, "A gravar estado…");
    let cwd = work.to_string_lossy();
    crate::launcher::runtime::record_spawn(
        meta,
        &runtime_key,
        wrapper_pid,
        &wrapper_name,
        open_url.as_deref(),
        Some(doc.start.as_str()),
        Some(cwd.as_ref()),
        &format!("cmd:{}", doc.start),
        port,
    )?;
    crate::launcher::activity_log::info(
        "launch",
        &format!("{} a correr (folder={runtime_key})", app.name),
    );
    let stamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let _ = fs::write(info.join("LastPlayed.txt"), stamp);
    if let Some(url) = &open_url {
        let _ = fs::write(info.join("open_url.txt"), url);
    }

    let cf_cfg = crate::launcher::cloudflare::load_config(&info);
    if cf_cfg.start_with_app {
        on_progress(98, "A iniciar túnel Cloudflare…");
        crate::launcher::activity_log::info(
            "cloudflare",
            &format!("start_with_app folder={runtime_key}"),
        );
        match crate::launcher::cloudflare::start(meta, &info, &app).await {
            Ok(view) => {
                crate::launcher::activity_log::info(
                    "cloudflare",
                    &format!(
                        "start_with_app ok folder={runtime_key} url={}",
                        view.public_url.as_deref().unwrap_or("(pendente)")
                    ),
                );
            }
            Err(err) => {
                // Não falha o launch da app — só o túnel.
                crate::launcher::activity_log::warn(
                    "cloudflare",
                    &format!("start_with_app falhou folder={runtime_key}: {err}"),
                );
            }
        }
    }

    let close = settings
        .get("CloseAfterLaunch")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    on_progress(100, "A correr");
    Ok(LaunchResult {
        started: true,
        needs_choice: false,
        needs_force: false,
        executables: vec![doc.start.clone()],
        close_after_launch: close,
        message: format!("{} a correr.", app.name),
        open_url,
        force_port: None,
        force_pid: None,
        force_process_name: None,
    })
}

fn launch_out_grew_with_port_busy(info: &Path, mark: u64) -> bool {
    let path = info.join("launch.out.log");
    let Ok(raw) = fs::read_to_string(&path) else {
        return false;
    };
    let bytes = raw.as_bytes();
    let start = (mark as usize).min(bytes.len());
    let fresh = String::from_utf8_lossy(&bytes[start..]).to_lowercase();
    fresh.contains("something is already running on port")
        || fresh.contains("eaddrinuse")
        || fresh.contains("address already in use")
}

pub async fn generate_launchfile(
    meta: &Path,
    workspace: &Path,
    repository: &str,
    on_progress: &impl Fn(u32, &str),
) -> Result<(), String> {
    let apps = load_apps(meta);
    let app = find_app(&apps, repository)?;
    let _ = store::migrate_legacy_install(workspace, app);
    let project = install_dir(workspace, app);
    if !project.is_dir() {
        return Err("Esta app não está instalada.".into());
    }
    let info = store::ensure_launch_info(workspace, app)?;
    let token = store::deepseek_token_of(meta);
    crate::launcher::deepseek::generate_launchfile(&project, &info, &token, on_progress).await?;
    on_progress(100, "Launchfile gerado");
    Ok(())
}

fn process_image_name(exe: &Path) -> String {
    exe.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown.exe")
        .to_string()
}

pub(crate) fn spawn_process_public(exe: &Path, dir: &Path, settings: &Value) -> Result<Option<(u32, String)>, String> {
    spawn_process(exe, dir, settings)
}

fn spawn_process(exe: &Path, dir: &Path, settings: &Value) -> Result<Option<(u32, String)>, String> {
    let ext = exe.extension().and_then(|ext| ext.to_str()).unwrap_or("").to_lowercase();
    let image = process_image_name(exe);
    if cfg!(target_os = "macos") && ext == "app" {
        let mut command = Command::new("open");
        command.arg(exe);
        runners::apply_detached(&mut command);
        let child = command.spawn().map_err(|err| err.to_string())?;
        return Ok(Some((child.id(), image)));
    }
    if cfg!(target_os = "linux") && ext == "exe" {
        return spawn_linux_windows(exe, dir, settings).map(|pid| pid.map(|id| (id, image)));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = fs::metadata(exe) {
            let mut permissions = meta.permissions();
            permissions.set_mode(permissions.mode() | 0o111);
            let _ = fs::set_permissions(exe, permissions);
        }
    }
    let mut command = Command::new(exe);
    if let Some(parent) = exe.parent() {
        command.current_dir(parent);
    }
    runners::apply_detached(&mut command);
    let child = command.spawn().map_err(|err| err.to_string())?;
    Ok(Some((child.id(), image)))
}

fn spawn_linux_windows(exe: &Path, dir: &Path, settings: &serde_json::Value) -> Result<Option<u32>, String> {
    let template = settings
        .get("LinuxWindowsLaunchCommand")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if !template.is_empty() {
        let exe_text = exe.display().to_string();
        let dir_text = dir.display().to_string();
        let parent = exe.parent().unwrap_or(dir).display().to_string();
        let mut rendered = template
            .replace("{exe}", &exe_text)
            .replace("{gamePath}", &dir_text)
            .replace("{exeDir}", &parent);
        if !rendered.contains(&exe_text) {
            rendered.push(' ');
            rendered.push_str(&exe_text);
        }
        let mut command = Command::new("sh");
        command.arg("-c").arg(rendered);
        runners::apply_detached(&mut command);
        let child = command.spawn().map_err(|err| err.to_string())?;
        return Ok(Some(child.id()));
    }
    for binary in ["wine64", "wine"] {
        let mut command = Command::new(binary);
        command.arg(exe).current_dir(dir);
        runners::apply_detached(&mut command);
        if let Ok(child) = command.spawn() {
            return Ok(Some(child.id()));
        }
    }
    if let Some(proton) = find_proton() {
        let compat = dir.join(".steam-compat-data");
        let _ = fs::create_dir_all(&compat);
        let mut command = Command::new(proton);
        command.arg("run").arg(exe).current_dir(dir);
        command.env("STEAM_COMPAT_DATA_PATH", &compat);
        command.env("STEAM_COMPAT_CLIENT_INSTALL_PATH", dir);
        runners::apply_detached(&mut command);
        let child = command.spawn().map_err(|err| err.to_string())?;
        return Ok(Some(child.id()));
    }
    Err("No Linux, instale wine64, wine ou Proton, ou defina o comando de lançamento.".into())
}

fn find_proton() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let roots = [
        format!("{home}/.steam/root"),
        format!("{home}/.steam/steam"),
        format!("{home}/.local/share/Steam"),
        format!("{home}/.var/app/com.valvesoftware.Steam/data/Steam"),
    ];
    for root in roots {
        for folder in ["steamapps/common", "compatibilitytools.d"] {
            let base = PathBuf::from(&root).join(folder);
            let Ok(entries) = fs::read_dir(&base) else { continue };
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_lowercase();
                if name.starts_with("proton") {
                    let candidate = entry.path().join("proton");
                    if candidate.is_file() {
                        return Some(candidate);
                    }
                }
            }
        }
    }
    None
}

pub fn open_folder(meta: &Path, workspace: &Path, repository: &str) -> Result<(), String> {
    let apps = load_apps(meta);
    let app = find_app(&apps, repository)?;
    let dir = store::app_dir(workspace, app);
    if !dir.is_dir() {
        return Err("A pasta ainda não existe.".into());
    }
    let mut command = if cfg!(windows) {
        let mut command = Command::new("explorer");
        command.arg(&dir);
        command
    } else if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg(&dir);
        command
    } else {
        let mut command = Command::new("xdg-open");
        command.arg(&dir);
        command
    };
    no_window(&mut command);
    command.spawn().map_err(|err| err.to_string())?;
    Ok(())
}

pub fn desktop_shortcut(root: &Path, repository: &str) -> Result<String, String> {
    if cfg!(target_os = "macos") {
        return Err("Atalhos no ambiente de trabalho não estão disponíveis no macOS.".into());
    }
    let apps = load_apps(root);
    let app = find_app(&apps, repository)?;
    let exe = std::env::current_exe().map_err(|err| err.to_string())?;
    let desktop = desktop_dir().ok_or_else(|| "A pasta do ambiente de trabalho não foi encontrada.".to_string())?;
    fs::create_dir_all(&desktop).map_err(|err| err.to_string())?;
    #[cfg(windows)]
    {
        let link = desktop.join(format!("{}.lnk", app.name.replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], " ")));
        let args = format!("--run {}", app.name);
        let script = format!(
            "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{}'); $s.TargetPath='{}'; $s.Arguments='{}'; $s.WorkingDirectory='{}'; $s.Save()",
            link.display().to_string().replace('\'', "''"),
            exe.display().to_string().replace('\'', "''"),
            args.replace('\'', "''"),
            exe.parent().unwrap_or(Path::new(".")).display().to_string().replace('\'', "''"),
        );
        let mut command = Command::new("powershell");
        command.args(["-NoProfile", "-Command", &script]);
        no_window(&mut command);
        let status = command.status().map_err(|err| err.to_string())?;
        if !status.success() {
            return Err("Não foi possível criar o atalho.".into());
        }
        return Ok(link.display().to_string());
    }
    #[cfg(not(windows))]
    {
        let file = desktop.join(format!("{}.desktop", store::sanitize_folder(&app.name)));
        let contents = format!(
            "[Desktop Entry]\nType=Application\nName={}\nExec=\"{}\" --run {}\nPath={}\nTerminal=false\n",
            app.name,
            exe.display(),
            app.name,
            exe.parent().unwrap_or(Path::new(".")).display()
        );
        fs::write(&file, contents).map_err(|err| err.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&file, fs::Permissions::from_mode(0o755));
        }
        Ok(file.display().to_string())
    }
}

fn desktop_dir() -> Option<PathBuf> {
    if let Ok(user) = std::env::var("USERPROFILE") {
        let desktop = PathBuf::from(user).join("Desktop");
        if desktop.is_dir() {
            return Some(desktop);
        }
        let one_drive = PathBuf::from(std::env::var("USERPROFILE").unwrap_or_default()).join("OneDrive").join("Desktop");
        if one_drive.is_dir() {
            return Some(one_drive);
        }
        return Some(desktop);
    }
    let home = std::env::var("HOME").ok()?;
    let desktop = PathBuf::from(&home).join("Desktop");
    if desktop.is_dir() {
        Some(desktop)
    } else {
        Some(PathBuf::from(home).join(".local/share/applications"))
    }
}

pub fn steam_shortcut(root: &Path, repository: &str) -> Result<String, String> {
    if cfg!(target_os = "macos") {
        return Err("Atalhos da Steam não estão disponíveis no macOS.".into());
    }
    if steam_running() {
        return Err("Feche a Steam antes de adicionar o atalho.".into());
    }
    let apps = load_apps(root);
    let app = find_app(&apps, repository)?;
    let exe = std::env::current_exe().map_err(|err| err.to_string())?;
    let config = steam_config_dir().ok_or_else(|| "A pasta da Steam não foi encontrada.".to_string())?;
    fs::create_dir_all(&config).map_err(|err| err.to_string())?;
    let file = config.join("shortcuts.vdf");
    let mut shortcuts = if file.is_file() {
        parse_vdf(&fs::read(&file).map_err(|err| err.to_string())?)?
    } else {
        Vdf::Map(vec![("shortcuts".into(), Vdf::Map(Vec::new()))])
    };
    let Vdf::Map(top) = &mut shortcuts else {
        return Err("O ficheiro de atalhos da Steam não foi reconhecido.".into());
    };
    let entry = steam_entry(&exe, &app.name);
    if let Some((_, Vdf::Map(items))) = top.iter_mut().find(|(key, _)| key == "shortcuts") {
        let index = items.len().to_string();
        items.push((index, entry));
    } else {
        top.push(("shortcuts".into(), Vdf::Map(vec![("0".into(), entry)])));
    }
    fs::write(&file, write_vdf(&shortcuts)).map_err(|err| err.to_string())?;
    Ok(file.display().to_string())
}

fn steam_running() -> bool {
    if cfg!(windows) {
        Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq steam.exe", "/NH"])
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).to_lowercase().contains("steam.exe"))
            .unwrap_or(false)
    } else {
        Command::new("pgrep")
            .arg("-x")
            .arg("steam")
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }
}

fn steam_config_dir() -> Option<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(program) = std::env::var("ProgramFiles(x86)") {
        roots.push(PathBuf::from(program).join("Steam").join("userdata"));
    }
    if let Ok(program) = std::env::var("ProgramFiles") {
        roots.push(PathBuf::from(program).join("Steam").join("userdata"));
    }
    if let Ok(home) = std::env::var("HOME") {
        roots.push(PathBuf::from(&home).join(".steam/steam/userdata"));
        roots.push(PathBuf::from(&home).join(".local/share/Steam/userdata"));
    }
    let mut newest: Option<(std::time::SystemTime, PathBuf)> = None;
    for root in roots {
        let Ok(users) = fs::read_dir(&root) else { continue };
        for user in users.flatten() {
            let config = user.path().join("config");
            if !config.is_dir() {
                continue;
            }
            let stamp = config
                .join("shortcuts.vdf")
                .metadata()
                .and_then(|meta| meta.modified())
                .or_else(|_| config.metadata().and_then(|meta| meta.modified()))
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
            if newest.as_ref().map(|(time, _)| stamp > *time).unwrap_or(true) {
                newest = Some((stamp, config));
            }
        }
    }
    newest.map(|(_, path)| path)
}

fn steam_entry(exe: &Path, name: &str) -> Vdf {
    let quoted_exe = format!("\"{}\"", exe.display());
    let start = format!("\"{}\"", exe.parent().unwrap_or(Path::new(".")).display());
    let appid = (crc32(format!("{quoted_exe}{name}").as_bytes()) | 0x8000_0000) as i32;
    Vdf::Map(vec![
        ("AppName".into(), Vdf::Str(name.into())),
        ("Exe".into(), Vdf::Str(quoted_exe)),
        ("StartDir".into(), Vdf::Str(start)),
        ("LaunchOptions".into(), Vdf::Str(format!("--run {name}"))),
        ("appid".into(), Vdf::Int(appid)),
        ("IsHidden".into(), Vdf::Int(0)),
        ("AllowDesktopConfig".into(), Vdf::Int(1)),
        ("AllowOverlay".into(), Vdf::Int(1)),
        ("OpenVR".into(), Vdf::Int(0)),
    ])
}

fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for byte in data {
        crc ^= *byte as u32;
        for _ in 0..8 {
            let mask = (crc & 1).wrapping_neg();
            crc = (crc >> 1) ^ (0xEDB8_8320 & mask);
        }
    }
    !crc
}

#[derive(Clone)]
enum Vdf {
    Map(Vec<(String, Vdf)>),
    Str(String),
    Int(i32),
}

fn parse_vdf(data: &[u8]) -> Result<Vdf, String> {
    let mut cursor = 0;
    let value = read_map(data, &mut cursor)?;
    Ok(value)
}

fn read_map(data: &[u8], cursor: &mut usize) -> Result<Vdf, String> {
    let mut items = Vec::new();
    while *cursor < data.len() {
        let kind = data[*cursor];
        if kind == 0x08 {
            *cursor += 1;
            break;
        }
        *cursor += 1;
        let key = read_cstr(data, cursor)?;
        let value = match kind {
            0x00 => read_map(data, cursor)?,
            0x01 => Vdf::Str(read_cstr(data, cursor)?),
            0x02 => {
                if *cursor + 4 > data.len() {
                    return Err("O ficheiro de atalhos da Steam está incompleto.".into());
                }
                let bytes = [data[*cursor], data[*cursor + 1], data[*cursor + 2], data[*cursor + 3]];
                *cursor += 4;
                Vdf::Int(i32::from_le_bytes(bytes))
            }
            _ => return Err("O ficheiro de atalhos da Steam não foi reconhecido.".into()),
        };
        items.push((key, value));
    }
    Ok(Vdf::Map(items))
}

fn read_cstr(data: &[u8], cursor: &mut usize) -> Result<String, String> {
    let start = *cursor;
    while *cursor < data.len() && data[*cursor] != 0 {
        *cursor += 1;
    }
    if *cursor >= data.len() {
        return Err("O ficheiro de atalhos da Steam está incompleto.".into());
    }
    let text = String::from_utf8_lossy(&data[start..*cursor]).into_owned();
    *cursor += 1;
    Ok(text)
}

fn write_vdf(value: &Vdf) -> Vec<u8> {
    let mut out = Vec::new();
    write_value(&mut out, value);
    out
}

fn write_value(out: &mut Vec<u8>, value: &Vdf) {
    let Vdf::Map(items) = value else { return };
    for (key, child) in items {
        match child {
            Vdf::Map(_) => {
                out.push(0x00);
                push_cstr(out, key);
                write_value(out, child);
            }
            Vdf::Str(text) => {
                out.push(0x01);
                push_cstr(out, key);
                push_cstr(out, text);
            }
            Vdf::Int(number) => {
                out.push(0x02);
                push_cstr(out, key);
                out.extend(number.to_le_bytes());
            }
        }
    }
    out.push(0x08);
}

fn push_cstr(out: &mut Vec<u8>, text: &str) {
    out.extend(text.as_bytes());
    out.push(0);
}
