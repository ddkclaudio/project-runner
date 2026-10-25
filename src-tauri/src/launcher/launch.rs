use crate::launcher::install::read_executables;
use crate::launcher::store::{self, find_app, install_dir, load_apps};
use chrono::Local;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResult {
    pub started: bool,
    pub needs_choice: bool,
    pub executables: Vec<String>,
    pub close_after_launch: bool,
    pub message: String,
}

fn no_window(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let _ = command;
}

pub fn executables_for(root: &Path, repository: &str) -> Result<Vec<String>, String> {
    let apps = load_apps(root);
    let app = find_app(&apps, repository)?;
    let dir = install_dir(root, app);
    if !dir.is_dir() {
        return Err("Esta app não está instalada.".into());
    }
    Ok(read_executables(&dir))
}

pub fn set_executable(root: &Path, repository: &str, executable: &str) -> Result<(), String> {
    let apps = load_apps(root);
    let app = find_app(&apps, repository)?;
    let dir = install_dir(root, app);
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    fs::write(dir.join("selected_executable.txt"), executable.trim()).map_err(|err| err.to_string())
}

pub fn launch(root: &Path, repository: &str, executable: Option<String>) -> Result<LaunchResult, String> {
    let apps = load_apps(root);
    let app = find_app(&apps, repository)?.clone();
    let dir = install_dir(root, &app);
    if !dir.is_dir() {
        return Err("Esta app não está instalada.".into());
    }
    let found = read_executables(&dir);
    let selected = executable
        .filter(|value| !value.trim().is_empty())
        .or_else(|| fs::read_to_string(dir.join("selected_executable.txt")).ok().map(|text| text.trim().to_string()))
        .filter(|value| !value.is_empty());
    let exe = if let Some(selected) = selected {
        let path = PathBuf::from(&selected);
        let path = if path.is_absolute() { path } else { dir.join(path) };
        if !path.exists() {
            return Err("O executável escolhido já não existe.".into());
        }
        path
    } else if found.len() == 1 {
        PathBuf::from(&found[0])
    } else if found.is_empty() {
        return Err("Não há um executável nesta pasta.".into());
    } else {
        return Ok(LaunchResult {
            started: false,
            needs_choice: true,
            executables: found,
            close_after_launch: false,
            message: "Há vários executáveis. Escolha qual arranca.".into(),
        });
    };
    spawn_process(&exe, &dir, &store::load_settings(root))?;
    let stamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let _ = fs::write(dir.join("LastPlayed.txt"), stamp);
    let close = store::load_settings(root)
        .get("CloseAfterLaunch")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    Ok(LaunchResult {
        started: true,
        needs_choice: false,
        executables: vec![exe.display().to_string()],
        close_after_launch: close,
        message: format!("{} a correr.", app.name),
    })
}

fn spawn_process(exe: &Path, dir: &Path, settings: &serde_json::Value) -> Result<(), String> {
    let ext = exe.extension().and_then(|ext| ext.to_str()).unwrap_or("").to_lowercase();
    if cfg!(target_os = "macos") && ext == "app" {
        Command::new("open").arg(exe).spawn().map_err(|err| err.to_string())?;
        return Ok(());
    }
    if cfg!(target_os = "linux") && ext == "exe" {
        return spawn_linux_windows(exe, dir, settings);
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
    command.spawn().map_err(|err| err.to_string())?;
    Ok(())
}

fn spawn_linux_windows(exe: &Path, dir: &Path, settings: &serde_json::Value) -> Result<(), String> {
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
        command.spawn().map_err(|err| err.to_string())?;
        return Ok(());
    }
    for binary in ["wine64", "wine"] {
        if Command::new(binary).arg(exe).current_dir(dir).spawn().is_ok() {
            return Ok(());
        }
    }
    if let Some(proton) = find_proton() {
        let compat = dir.join(".steam-compat-data");
        let _ = fs::create_dir_all(&compat);
        let mut command = Command::new(proton);
        command.arg("run").arg(exe).current_dir(dir);
        command.env("STEAM_COMPAT_DATA_PATH", &compat);
        command.env("STEAM_COMPAT_CLIENT_INSTALL_PATH", dir);
        command.spawn().map_err(|err| err.to_string())?;
        return Ok(());
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

pub fn open_folder(root: &Path, repository: &str) -> Result<(), String> {
    let apps = load_apps(root);
    let app = find_app(&apps, repository)?;
    let dir = install_dir(root, app);
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
