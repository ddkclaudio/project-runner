use crate::launcher::version::is_newer;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppEntry {
    pub name: String,
    pub repository: String,
    #[serde(default)]
    pub folder_name: String,
    #[serde(default)]
    pub install_path: Option<String>,
    #[serde(default)]
    pub app_icon_url: Option<String>,
    #[serde(default)]
    pub preferred_version: Option<String>,
    #[serde(default)]
    pub skipped_update_version: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppView {
    pub name: String,
    pub repository: String,
    pub folder_name: String,
    pub install_path: String,
    pub configured_install_path: Option<String>,
    pub app_icon_url: Option<String>,
    pub icon_path: Option<String>,
    pub preferred_version: Option<String>,
    pub skipped_update_version: Option<String>,
    pub installed_version: Option<String>,
    pub remote_version: Option<String>,
    pub changelog: Option<String>,
    pub status: String,
    pub last_played: Option<String>,
    pub manually_hidden: bool,
    pub filter_hidden: bool,
    pub selected_executable: Option<String>,
    pub running: bool,
    pub selected_branch: Option<String>,
    /// URL para abrir no browser enquanto a app corre (ex. localhost).
    pub open_url: Option<String>,
    /// PID do processo em execução (Task Manager), se `running`.
    pub running_pid: Option<u32>,
    /// Nome do processo (ex. node.exe), se `running`.
    pub running_process_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySnapshot {
    pub apps: Vec<AppView>,
    pub sort_by: String,
    pub use_grid: bool,
    pub continue_repository: Option<String>,
    pub installed_only: bool,
    pub data_dir: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInput {
    pub apps_path: String,
    pub github_api_token: String,
    pub deepseek_api_token: String,
    pub cloudflare_api_token: String,
    pub cloudflared_path: String,
    pub platform: String,
    pub sort_by: String,
    pub use_grid_view: bool,
    pub start_fullscreen: bool,
    pub close_after_launch: bool,
    pub background_image_path: String,
    pub launcher_music_path: String,
    pub music_volume: f64,
    pub background_opacity: f64,
    pub enable_gamepad_input: bool,
    pub linux_windows_launch_command: String,
    pub app_list_repository: String,
    pub painel_update_repository: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSettings {
    pub apps_path: String,
    pub github_api_token: String,
    pub deepseek_api_token: String,
    pub cloudflare_api_token: String,
    pub cloudflared_path: String,
    pub platform: String,
    pub sort_by: String,
    pub use_grid_view: bool,
    pub start_fullscreen: bool,
    pub close_after_launch: bool,
    pub background_image_path: String,
    pub launcher_music_path: String,
    pub music_volume: f64,
    pub background_opacity: f64,
    pub enable_gamepad_input: bool,
    pub linux_windows_launch_command: String,
    pub app_list_repository: String,
    pub painel_update_repository: String,
    pub data_dir: String,
    pub app_version: String,
}

fn read_string(path: &Path) -> Result<String, std::io::Error> {
    let raw = fs::read_to_string(path)?;
    Ok(raw.trim_start_matches('\u{feff}').to_string())
}

/// Ponteiro fixo em AppData: só a pasta das apps (clones), nunca auth/orgs.
pub fn bootstrap_path() -> PathBuf {
    user_data_dir().join("data-location.json")
}

pub fn read_bootstrap_apps_root() -> Option<PathBuf> {
    let raw = fs::read_to_string(bootstrap_path()).ok()?;
    let value: Value = serde_json::from_str(raw.trim_start_matches('\u{feff}')).ok()?;
    let path = value
        .get("appsRoot")
        .or_else(|| value.get("dataRoot"))
        .and_then(|item| item.as_str())?
        .trim();
    if path.is_empty() {
        None
    } else {
        Some(PathBuf::from(path))
    }
}

pub fn write_bootstrap_apps_root(path: Option<&str>) -> Result<(), String> {
    let bootstrap = bootstrap_path();
    if let Some(parent) = bootstrap.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    match path.map(str::trim).filter(|item| !item.is_empty()) {
        None => {
            if bootstrap.is_file() {
                fs::remove_file(&bootstrap).map_err(|err| err.to_string())?;
            }
            Ok(())
        }
        Some(custom) => {
            let payload = json!({ "appsRoot": custom });
            let raw = serde_json::to_string_pretty(&payload).map_err(|err| err.to_string())?;
            fs::write(&bootstrap, raw).map_err(|err| err.to_string())
        }
    }
}

/// Conta, orgs, biblioteca e settings — sempre AppData (não segue a pasta das apps).
pub fn resolve_meta_root() -> PathBuf {
    if let Ok(dir) = std::env::var("PAINEL_META_DIR") {
        let dir = dir.trim();
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    user_data_dir()
}

/// Pasta custom de apps tem de estar vazia (ou ainda não existir).
pub fn require_empty_apps_dir(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    if !path.is_dir() {
        return Err("O caminho indicado não é uma pasta.".into());
    }
    let mut entries = fs::read_dir(path).map_err(|err| err.to_string())?;
    if entries.next().is_some() {
        return Err(
            "A pasta escolhida precisa estar vazia. Escolha outra pasta ou esvazie-a antes de continuar."
                .into(),
        );
    }
    Ok(())
}

pub fn same_path(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(left), Ok(right)) => left == right,
        _ => a == b,
    }
}

/// Onde ficam as apps: `{appsRoot}/{orgSlug}/{appFolder}/` (clones em `repositories/`).
pub fn resolve_apps_root() -> PathBuf {
    if let Some(custom) = read_bootstrap_apps_root() {
        return custom;
    }
    if let Ok(dir) = std::env::var("PAINEL_APPS_DIR").or_else(|_| std::env::var("PAINEL_DATA_DIR")) {
        let dir = dir.trim();
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    user_data_dir()
}

/// `%APPDATA%\com.local.painel` no Windows. Conta, orgs e bootstrap.
pub fn user_data_dir() -> PathBuf {
    if let Some(appdata) = std::env::var_os("APPDATA") {
        return PathBuf::from(appdata).join("com.local.painel");
    }
    if let Some(home) = std::env::var_os("USERPROFILE") {
        return PathBuf::from(home)
            .join("AppData")
            .join("Roaming")
            .join("com.local.painel");
    }
    PathBuf::from(".").join("com.local.painel")
}

/// Metadados do sistema: `{metaRoot}/data` (auth, orgs, por-org).
pub fn system_data_dir(meta_root: &Path) -> PathBuf {
    meta_root.join("data")
}

pub fn ensure_system_data(global_root: &Path) -> Result<PathBuf, String> {
    let data = system_data_dir(global_root);
    fs::create_dir_all(&data).map_err(|err| err.to_string())?;
    Ok(data)
}

pub fn ensure_root(root: &Path) -> Result<(), String> {
    fs::create_dir_all(root).map_err(|err| err.to_string())?;
    fs::create_dir_all(root.join("Cache")).map_err(|err| err.to_string())?;
    fs::create_dir_all(root.join("Cache").join("Icons")).map_err(|err| err.to_string())?;
    fs::create_dir_all(root.join("Cache").join("CustomIcons")).map_err(|err| err.to_string())?;
    migrate_legacy_json(root);
    Ok(())
}

fn migrate_legacy_json(root: &Path) {
    if root.join("apps.json").exists() || root.join("settings.json").exists() {
        return;
    }
    let Some(legacy) = std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.to_path_buf()))
    else {
        return;
    };
    if legacy == root {
        return;
    }
    for name in [
        "apps.json",
        "settings.json",
        "games.json",
        "app_catalog_cache.json",
        "app_catalog_version.txt",
        "version.txt",
        "update_check.json",
    ] {
        let from = legacy.join(name);
        if from.is_file() {
            let _ = fs::copy(&from, root.join(name));
        }
    }
}

pub fn cleanup_backups(root: &Path) {
    let cutoff = std::time::SystemTime::now()
        .checked_sub(std::time::Duration::from_secs(600))
        .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
    for dir in [root.to_path_buf(), std::env::temp_dir()] {
        let Ok(entries) = fs::read_dir(dir) else { continue };
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with("backup_")
                && !name.starts_with("Painel_backup_")
                && !name.starts_with("GithubLauncher_backup_")
            {
                continue;
            }
            let Ok(meta) = entry.metadata() else { continue };
            let Ok(modified) = meta.modified() else { continue };
            if modified < cutoff {
                let _ = fs::remove_dir_all(entry.path());
            }
        }
    }
}

fn settings_path(root: &Path) -> PathBuf {
    root.join("settings.json")
}

fn apps_path(root: &Path) -> PathBuf {
    root.join("apps.json")
}

fn default_settings() -> Value {
    json!({
        "FirstStartup": false,
        "IconFill": true,
        "UseGridView": true,
        "IconOpacity": 1.0,
        "IconSize": 220,
        "IconMargin": 8,
        "SlotTextMargin": 112,
        "SlotSize": 220,
        "WindowBorderRounding": true,
        "ShowOSTopBar": false,
        "PrimaryColor": "#18181b",
        "SecondaryColor": "#404040",
        "Platform": "Auto",
        "HiddenApps": [],
        "ManuallyHiddenApps": [],
        "AppsPath": "",
        "GitHubApiToken": "",
        "DeepSeekApiToken": "",
        "SortBy": "LastPlayed",
        "StartFullscreen": false,
        "CloseAfterLaunch": false,
        "BackgroundImagePath": "",
        "LauncherMusicPath": "",
        "MusicVolume": 0.2,
        "BackgroundOpacity": 0.15,
        "EnableGamepadInput": true,
        "LinuxWindowsLaunchCommand": "",
        "AppListRepository": "SirDiabo/GHLAppList",
        "AppListCachedVersion": "",
        "PainelUpdateRepository": ""
    })
}

pub fn load_settings(root: &Path) -> Value {
    let mut settings = default_settings();
    let Ok(raw) = read_string(&settings_path(root)) else {
        return settings;
    };
    let Ok(parsed) = serde_json::from_str::<Value>(&raw) else {
        return settings;
    };
    let (Some(base), Some(extra)) = (settings.as_object_mut(), parsed.as_object()) else {
        return settings;
    };
    for (key, value) in extra {
        base.insert(key.clone(), value.clone());
    }
    settings
}

pub fn save_settings(root: &Path, settings: &Value) -> Result<(), String> {
    ensure_root(root)?;
    let raw = serde_json::to_string_pretty(settings).map_err(|err| err.to_string())?;
    fs::write(settings_path(root), raw).map_err(|err| err.to_string())
}

fn setting_str(settings: &Value, key: &str) -> String {
    settings
        .get(key)
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string()
}

fn setting_bool(settings: &Value, key: &str, default: bool) -> bool {
    settings.get(key).and_then(|value| value.as_bool()).unwrap_or(default)
}

fn setting_f64(settings: &Value, key: &str, default: f64) -> f64 {
    settings.get(key).and_then(|value| value.as_f64()).unwrap_or(default)
}

fn setting_list(settings: &Value, key: &str) -> Vec<String> {
    settings
        .get(key)
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(|value| value.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

pub fn platform_of(settings: &Value) -> String {
    match settings.get("Platform") {
        Some(Value::String(value)) => value.clone(),
        Some(Value::Number(value)) if value.as_i64() == Some(0) => "Auto".into(),
        Some(Value::Number(_)) => "Auto".into(),
        _ => "Auto".into(),
    }
}

pub fn public_settings(root: &Path) -> PublicSettings {
    let settings = load_settings(root);
    PublicSettings {
        apps_path: setting_str(&settings, "AppsPath"),
        github_api_token: setting_str(&settings, "GitHubApiToken"),
        deepseek_api_token: setting_str(&settings, "DeepSeekApiToken"),
        cloudflare_api_token: setting_str(&settings, "CloudflareApiToken"),
        cloudflared_path: setting_str(&settings, "CloudflaredPath"),
        platform: platform_of(&settings),
        sort_by: {
            let value = setting_str(&settings, "SortBy");
            if value.is_empty() { "LastPlayed".into() } else { value }
        },
        use_grid_view: setting_bool(&settings, "UseGridView", true),
        start_fullscreen: setting_bool(&settings, "StartFullscreen", false),
        close_after_launch: setting_bool(&settings, "CloseAfterLaunch", false),
        background_image_path: setting_str(&settings, "BackgroundImagePath"),
        launcher_music_path: setting_str(&settings, "LauncherMusicPath"),
        music_volume: setting_f64(&settings, "MusicVolume", 0.2),
        background_opacity: setting_f64(&settings, "BackgroundOpacity", 0.15),
        enable_gamepad_input: setting_bool(&settings, "EnableGamepadInput", true),
        linux_windows_launch_command: setting_str(&settings, "LinuxWindowsLaunchCommand"),
        app_list_repository: {
            let value = setting_str(&settings, "AppListRepository");
            if value.is_empty() { "SirDiabo/GHLAppList".into() } else { value }
        },
        painel_update_repository: setting_str(&settings, "PainelUpdateRepository"),
        data_dir: root.display().to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

pub fn apply_settings(root: &Path, input: SettingsInput) -> Result<PublicSettings, String> {
    let mut settings = load_settings(root);
    let Some(map) = settings.as_object_mut() else {
        return Err("Definições inválidas.".into());
    };
    let volume = input.music_volume.clamp(0.0, 1.0);
    let opacity = input.background_opacity.clamp(0.0, 1.0);
    map.insert("AppsPath".into(), json!(input.apps_path.trim()));
    map.insert("GitHubApiToken".into(), json!(input.github_api_token.trim()));
    map.insert("DeepSeekApiToken".into(), json!(input.deepseek_api_token.trim()));
    map.insert("CloudflareApiToken".into(), json!(input.cloudflare_api_token.trim()));
    map.insert("CloudflaredPath".into(), json!(input.cloudflared_path.trim()));
    map.insert("Platform".into(), json!(input.platform.trim()));
    map.insert("SortBy".into(), json!(input.sort_by.trim()));
    map.insert("UseGridView".into(), json!(input.use_grid_view));
    map.insert("StartFullscreen".into(), json!(input.start_fullscreen));
    map.insert("CloseAfterLaunch".into(), json!(input.close_after_launch));
    map.insert("BackgroundImagePath".into(), json!(input.background_image_path.trim()));
    map.insert("LauncherMusicPath".into(), json!(input.launcher_music_path.trim()));
    map.insert("MusicVolume".into(), json!(volume));
    map.insert("BackgroundOpacity".into(), json!(opacity));
    map.insert("EnableGamepadInput".into(), json!(input.enable_gamepad_input));
    map.insert(
        "LinuxWindowsLaunchCommand".into(),
        json!(input.linux_windows_launch_command),
    );
    map.insert("AppListRepository".into(), json!(input.app_list_repository.trim()));
    map.insert(
        "PainelUpdateRepository".into(),
        json!(input.painel_update_repository.trim()),
    );
    save_settings(root, &settings)?;
    Ok(public_settings(root))
}

pub fn token_of(root: &Path) -> String {
    setting_str(&load_settings(root), "GitHubApiToken")
}

pub fn deepseek_token_of(root: &Path) -> String {
    setting_str(&load_settings(root), "DeepSeekApiToken")
}

pub fn cloudflare_token_of(root: &Path) -> String {
    setting_str(&load_settings(root), "CloudflareApiToken")
}

pub fn cloudflared_path_of(root: &Path) -> String {
    setting_str(&load_settings(root), "CloudflaredPath")
}

/// Pasta workspace da org: `{appsRoot}/{orgSlug}` (clones ficam aqui).
pub fn org_workspace(apps_root: &Path, org_slug: &str) -> PathBuf {
    apps_root.join(org_slug)
}

#[allow(dead_code)]
pub fn apps_root(root: &Path) -> PathBuf {
    let settings = load_settings(root);
    let custom = setting_str(&settings, "AppsPath");
    if custom.trim().is_empty() {
        // Compat: se root for meta (`data/{orgId}`), Apps fica ao lado; preferir workspace via install_dir.
        root.join("Apps")
    } else {
        PathBuf::from(custom)
    }
}

fn blank(value: &Option<String>) -> Option<String> {
    value
        .as_ref()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn icon_from(value: &Value) -> Option<String> {
    for key in ["appIconUrl", "gameIconUrl", "customDefaultIconUrl"] {
        if let Some(icon) = value.get(key).and_then(|item| item.as_str()) {
            if !icon.trim().is_empty() {
                return Some(icon.trim().to_string());
            }
        }
    }
    None
}

fn entry_from(value: &Value) -> Option<AppEntry> {
    let name = value.get("name")?.as_str()?.trim().to_string();
    let repository = value.get("repository")?.as_str()?.trim().to_string();
    if name.is_empty() || repository.is_empty() {
        return None;
    }
    Some(AppEntry {
        folder_name: value
            .get("folderName")
            .and_then(|item| item.as_str())
            .unwrap_or("")
            .trim()
            .to_string(),
        install_path: value
            .get("installPath")
            .and_then(|item| item.as_str())
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty()),
        app_icon_url: icon_from(value),
        preferred_version: value
            .get("preferredVersion")
            .and_then(|item| item.as_str())
            .map(|item| item.to_string())
            .filter(|item| !item.is_empty()),
        skipped_update_version: value
            .get("skippedUpdateVersion")
            .and_then(|item| item.as_str())
            .map(|item| item.to_string())
            .filter(|item| !item.is_empty()),
        name,
        repository,
    })
}

fn parse_array(value: &Value, into: &mut Vec<AppEntry>) {
    let Some(items) = value.as_array() else { return };
    for item in items {
        if let Some(entry) = entry_from(item) {
            into.push(entry);
        }
    }
}

pub fn parse_apps_value(root_value: &Value) -> Vec<AppEntry> {
    let mut apps = Vec::new();
    if root_value.is_array() {
        parse_array(root_value, &mut apps);
    } else if let Some(map) = root_value.as_object() {
        if let Some(apps_value) = map.get("apps") {
            parse_array(apps_value, &mut apps);
        }
        for section in ["standard", "experimental", "custom"] {
            if let Some(legacy) = map.get(section) {
                parse_array(legacy, &mut apps);
            }
        }
    }
    // Unicidade pela pasta (nome). O mesmo repositório GitHub pode repetir-se.
    let mut seen = Vec::new();
    let mut out = Vec::new();
    for mut app in apps {
        if app.folder_name.trim().is_empty() {
            app.folder_name = sanitize_folder(&app.name);
        } else {
            app.folder_name = sanitize_folder(&app.folder_name);
        }
        let key = app.folder_name.to_lowercase();
        if seen.iter().any(|item: &String| item == &key) {
            continue;
        }
        seen.push(key);
        out.push(app);
    }
    out
}

pub fn load_apps(root: &Path) -> Vec<AppEntry> {
    let path = apps_path(root);
    if !path.exists() {
        let legacy = root.join("games.json");
        if legacy.exists() {
            if let Ok(raw) = read_string(&legacy) {
                if let Ok(value) = serde_json::from_str::<Value>(&raw) {
                    let apps = parse_apps_value(&value);
                    let _ = save_apps(root, &apps);
                    let _ = fs::rename(&legacy, root.join("games.json.bak"));
                    return apps;
                }
            }
        }
        return Vec::new();
    }
    let Ok(raw) = read_string(&path) else {
        return Vec::new();
    };
    serde_json::from_str::<Value>(&raw)
        .map(|value| parse_apps_value(&value))
        .unwrap_or_default()
}

fn serialize_app(app: &AppEntry) -> Value {
    json!({
        "name": app.name,
        "repository": app.repository,
        "folderName": app.folder_name,
        "installPath": app.install_path,
        "appIconUrl": app.app_icon_url,
        "preferredVersion": app.preferred_version,
        "skippedUpdateVersion": app.skipped_update_version
    })
}

pub fn save_apps(root: &Path, apps: &[AppEntry]) -> Result<(), String> {
    ensure_root(root)?;
    let value = json!({ "apps": apps.iter().map(serialize_app).collect::<Vec<_>>() });
    let raw = serde_json::to_string_pretty(&value).map_err(|err| err.to_string())?;
    fs::write(apps_path(root), raw).map_err(|err| err.to_string())
}

pub fn sanitize_folder(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => ch,
        })
        .collect();
    let cleaned = cleaned.trim().trim_matches('.').to_string();
    if cleaned.is_empty() { "app".into() } else { cleaned }
}

pub fn normalize_entry(mut entry: AppEntry) -> Result<AppEntry, String> {
    entry.name = entry.name.trim().to_string();
    entry.repository = entry.repository.trim().trim_matches('/').to_string();
    if entry.name.is_empty() {
        return Err("Informe o nome.".into());
    }
    let mut parts = entry.repository.split('/');
    let owner = parts.next().unwrap_or("");
    let repo = parts.next().unwrap_or("");
    if owner.is_empty() || repo.is_empty() || parts.next().is_some() || entry.repository.contains(' ') {
        return Err("O repositório deve estar no formato dono/nome.".into());
    }
    if entry.folder_name.trim().is_empty() {
        // Pasta da app = nome dado; o clone fica em repositories/{repo}/.
        entry.folder_name = sanitize_folder(&entry.name);
    } else {
        entry.folder_name = sanitize_folder(&entry.folder_name);
    }
    entry.install_path = blank(&entry.install_path);
    entry.app_icon_url = blank(&entry.app_icon_url);
    entry.preferred_version = blank(&entry.preferred_version);
    entry.skipped_update_version = blank(&entry.skipped_update_version);
    Ok(entry)
}

pub fn upsert_app(root: &Path, entry: AppEntry, previous: Option<String>) -> Result<AppEntry, String> {
    let entry = normalize_entry(entry)?;
    let mut apps = load_apps(root);
    let previous = previous.unwrap_or_default();

    // `previous` pode ser pasta ou repositório da entrada em edição.
    let edit_index = if previous.is_empty() {
        None
    } else {
        apps.iter().position(|app| {
            app.folder_name.eq_ignore_ascii_case(&previous)
                || app.repository.eq_ignore_ascii_case(&previous)
        })
    };

    // Unicidade pela pasta no disco (do nome). O mesmo repositório pode repetir-se
    // com nomes/pastas diferentes.
    let folder_taken = apps.iter().enumerate().any(|(index, app)| {
        Some(index) != edit_index && app.folder_name.eq_ignore_ascii_case(&entry.folder_name)
    });
    if folder_taken {
        return Err("Já existe uma app com este nome/pasta na biblioteca.".into());
    }

    if let Some(index) = edit_index {
        apps[index] = entry.clone();
    } else {
        apps.push(entry.clone());
    }
    save_apps(root, &apps)?;
    Ok(entry)
}

pub fn remove_app(root: &Path, key: &str) -> Result<(), String> {
    let mut apps = load_apps(root);
    let before = apps.len();
    let target = find_app(&apps, key)?.folder_name.clone();
    apps.retain(|app| !app.folder_name.eq_ignore_ascii_case(&target));
    if apps.len() == before {
        return Err("App não encontrada.".into());
    }
    save_apps(root, &apps)
}

pub fn import_apps(root: &Path, raw: &str) -> Result<usize, String> {
    let value = serde_json::from_str::<Value>(raw.trim_start_matches('\u{feff}')).map_err(|_| "O JSON não é válido.".to_string())?;
    let apps = parse_apps_value(&value);
    if apps.is_empty() {
        return Err("O ficheiro não tem apps.".into());
    }
    save_apps(root, &apps)?;
    Ok(apps.len())
}

pub fn export_apps(root: &Path) -> Result<String, String> {
    let apps = load_apps(root);
    let value = json!({ "apps": apps.iter().map(serialize_app).collect::<Vec<_>>() });
    serde_json::to_string_pretty(&value).map_err(|err| err.to_string())
}

pub fn validate_apps(root: &Path) -> Result<usize, String> {
    let apps = load_apps(root);
    save_apps(root, &apps)?;
    Ok(apps.len())
}

pub fn hidden_key(app: &AppEntry) -> String {
    if !app.folder_name.trim().is_empty() {
        format!("folder:{}", app.folder_name)
    } else if !app.repository.trim().is_empty() {
        format!("repo:{}", app.repository)
    } else {
        format!("name:{}", app.name)
    }
}

fn listed(list: &[String], app: &AppEntry) -> bool {
    let key = hidden_key(app);
    list.iter().any(|item| item == &key || item == &app.name)
}

/// Nome da pasta do repositório (`dono/nome` → `nome`).
pub fn repo_folder_name(repository: &str) -> String {
    let base = repository
        .rsplit('/')
        .next()
        .unwrap_or(repository)
        .trim();
    sanitize_folder(base)
}

/// Pasta da app: `{workspace}/{appFolder}/` (nome da app).
pub fn app_dir(workspace: &Path, app: &AppEntry) -> PathBuf {
    let folder = if app.folder_name.trim().is_empty() {
        sanitize_folder(&app.name)
    } else {
        app.folder_name.clone()
    };
    workspace.join(folder)
}

/// Ícones locais da app: `{workspace}/{appFolder}/images/`.
pub fn images_dir(workspace: &Path, app: &AppEntry) -> PathBuf {
    app_dir(workspace, app).join("images")
}

/// Nome da pasta que contém os clones dentro da app.
pub const REPOSITORIES_DIR: &str = "repositories";

/// Destino do clone/instalação: `{workspace}/{appFolder}/repositories/{repo}/`.
pub fn install_dir(workspace: &Path, app: &AppEntry) -> PathBuf {
    if let Some(path) = app.install_path.as_ref().filter(|path| !path.trim().is_empty()) {
        return PathBuf::from(path);
    }
    app_dir(workspace, app)
        .join(REPOSITORIES_DIR)
        .join(repo_folder_name(&app.repository))
}

/// Layout legado: `{workspace}/{appFolder}/{repo}/` (antes de `repositories/`).
fn legacy_install_dir(workspace: &Path, app: &AppEntry) -> PathBuf {
    app_dir(workspace, app).join(repo_folder_name(&app.repository))
}

/// Move o clone antigo para `repositories/{repo}` se ainda estiver no caminho legado.
pub fn migrate_legacy_install(workspace: &Path, app: &AppEntry) -> Result<PathBuf, String> {
    let target = install_dir(workspace, app);
    if target.is_dir() {
        return Ok(target);
    }
    if app.install_path.as_ref().is_some_and(|path| !path.trim().is_empty()) {
        return Ok(target);
    }
    let legacy = legacy_install_dir(workspace, app);
    if legacy.is_dir()
        && legacy != target
        && legacy
            .file_name()
            .is_some_and(|name| name != REPOSITORIES_DIR && name != "launch-info")
    {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        fs::rename(&legacy, &target).map_err(|err| {
            format!(
                "Não foi possível mover o clone para repositories/: {err}"
            )
        })?;
    }
    Ok(target)
}

/// Metadados do Painel (fora do git): `{workspace}/{appFolder}/launch-info/`.
/// Contém version.txt, LastPlayed.txt, open_url.txt, selected_executable.txt, Launchfile.
pub fn launch_info_dir(workspace: &Path, app: &AppEntry) -> PathBuf {
    if let Some(path) = app.install_path.as_ref().filter(|path| !path.trim().is_empty()) {
        let project = PathBuf::from(path);
        // Preferir irmão de `repositories/` (avô do repo) quando o path custom já inclui repositories/.
        if project
            .parent()
            .and_then(|parent| parent.file_name())
            .is_some_and(|name| name == REPOSITORIES_DIR)
        {
            return project
                .parent()
                .and_then(|repos| repos.parent())
                .map(|app| app.join("launch-info"))
                .unwrap_or_else(|| project.join("launch-info"));
        }
        return project
            .parent()
            .map(|parent| parent.join("launch-info"))
            .unwrap_or_else(|| project.join("launch-info"));
    }
    app_dir(workspace, app).join("launch-info")
}

const LAUNCH_INFO_FILES: &[&str] = &[
    "version.txt",
    "LastPlayed.txt",
    "open_url.txt",
    "selected_executable.txt",
    "Launchfile",
];

/// Garante `launch-info/` e migra ficheiros antigos que estavam dentro do clone.
pub fn ensure_launch_info(workspace: &Path, app: &AppEntry) -> Result<PathBuf, String> {
    let _ = migrate_legacy_install(workspace, app)?;
    let info = launch_info_dir(workspace, app);
    fs::create_dir_all(&info).map_err(|err| err.to_string())?;
    let project = install_dir(workspace, app);
    if project.is_dir() {
        for name in LAUNCH_INFO_FILES {
            let src = project.join(name);
            let dst = info.join(name);
            if src.is_file() && !dst.is_file() {
                if fs::rename(&src, &dst).is_err() {
                    if fs::copy(&src, &dst).is_ok() {
                        let _ = fs::remove_file(&src);
                    }
                }
            }
        }
    }
    Ok(info)
}

fn read_text(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok().map(|text| text.trim().to_string()).filter(|text| !text.is_empty())
}

/// Versão instalada: o clone tem de existir; `version.txt` vive em `launch-info/`.
pub fn installed_version(workspace: &Path, app: &AppEntry) -> Option<String> {
    let project = install_dir(workspace, app);
    if !project.is_dir() {
        return None;
    }
    let info = launch_info_dir(workspace, app);
    if let Some(version) = read_text(&info.join("version.txt")) {
        return Some(version);
    }
    if let Some(version) = read_text(&project.join("version.txt")) {
        return Some(version);
    }
    let _ = fs::create_dir_all(&info);
    let _ = fs::write(info.join("version.txt"), "v0.0.0");
    Some("v0.0.0".into())
}

pub fn write_version(workspace: &Path, app: &AppEntry, version: &str) -> Result<(), String> {
    let info = ensure_launch_info(workspace, app)?;
    fs::write(info.join("version.txt"), version).map_err(|err| err.to_string())
}

fn cache_path(root: &Path) -> PathBuf {
    root.join("Cache").join("version_cache.json")
}

pub fn load_version_cache(root: &Path) -> Value {
    fs::read_to_string(cache_path(root))
        .ok()
        .map(|raw| raw.trim_start_matches('\u{feff}').to_string())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_else(|| json!({}))
}

pub fn save_version_cache(root: &Path, cache: &Value) -> Result<(), String> {
    ensure_root(root)?;
    let raw = serde_json::to_string_pretty(cache).map_err(|err| err.to_string())?;
    fs::write(cache_path(root), raw).map_err(|err| err.to_string())
}

fn first_image_in(dir: &Path) -> Option<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return None;
    };
    let mut files: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .collect();
    files.sort();
    files.into_iter().next()
}

fn icon_file(meta: &Path, workspace: &Path, app: &AppEntry) -> Option<PathBuf> {
    if let Some(path) = first_image_in(&images_dir(workspace, app)) {
        return Some(path);
    }
    let custom = meta.join("Cache").join("CustomIcons");
    if let Ok(entries) = fs::read_dir(&custom) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(&icon_stem(app)) {
                return Some(entry.path());
            }
        }
    }
    let cached = meta.join("Cache").join("Icons").join(format!("{}.img", icon_stem(app)));
    if cached.is_file() {
        Some(cached)
    } else {
        None
    }
}

pub fn icon_stem(app: &AppEntry) -> String {
    sanitize_folder(&app.repository.replace('/', "__"))
}

fn last_played_of(info: &Path) -> Option<String> {
    read_text(&info.join("LastPlayed.txt"))
}

pub fn view_app(meta: &Path, workspace: &Path, app: &AppEntry, settings: &Value, cache: &Value) -> AppView {
    let home = app_dir(workspace, app);
    let dir = install_dir(workspace, app);
    let info = launch_info_dir(workspace, app);
    let installed = installed_version(workspace, app);
    let remote = cache
        .get(&app.repository)
        .and_then(|item| item.get("tag"))
        .and_then(|item| item.as_str())
        .map(|item| item.to_string());
    let changelog = cache
        .get(&app.repository)
        .and_then(|item| item.get("body"))
        .and_then(|item| item.as_str())
        .map(|item| item.to_string());
    let skipped = app.skipped_update_version.clone().unwrap_or_default();
    let status = if installed.is_none() {
        "not_installed".to_string()
    } else if remote.as_ref().is_some_and(|tag| {
        is_newer(tag, installed.as_deref().unwrap_or("0")) && (skipped.is_empty() || is_newer(tag, &skipped))
    }) {
        "update".to_string()
    } else {
        "installed".to_string()
    };
    let manual = setting_list(settings, "ManuallyHiddenApps");
    let filter = setting_list(settings, "HiddenApps");
    let runtime_key = &app.folder_name;
    let running = crate::launcher::runtime::is_running(meta, runtime_key);
    let running_entry = if running {
        crate::launcher::runtime::entry(meta, runtime_key)
    } else {
        None
    };
    AppView {
        name: app.name.clone(),
        repository: app.repository.clone(),
        folder_name: app.folder_name.clone(),
        // Pasta da app no disco (ex.: …/claudio-fernandes/hello), não o clone em repositories/.
        install_path: home.display().to_string(),
        configured_install_path: app.install_path.clone(),
        app_icon_url: app.app_icon_url.clone(),
        icon_path: icon_file(meta, workspace, app).map(|path| path.display().to_string()),
        preferred_version: app.preferred_version.clone(),
        skipped_update_version: app.skipped_update_version.clone(),
        installed_version: installed,
        remote_version: remote,
        changelog,
        status,
        last_played: last_played_of(&info),
        manually_hidden: listed(&manual, app),
        filter_hidden: listed(&filter, app),
        selected_executable: read_text(&info.join("selected_executable.txt"))
            .or_else(|| read_text(&dir.join("selected_executable.txt"))),
        running,
        selected_branch: crate::launcher::runtime::selected_branch(meta, runtime_key),
        open_url: if running {
            running_entry
                .as_ref()
                .and_then(|item| item.open_url.clone())
                .or_else(|| read_text(&info.join("open_url.txt")))
                .or_else(|| read_text(&dir.join("open_url.txt")))
        } else {
            None
        },
        running_pid: running_entry.as_ref().map(|item| item.pid),
        running_process_name: running_entry.map(|item| item.process_name),
    }
}

/// Resolve por pasta (preferido) ou por repositório (se for único).
pub fn find_app<'a>(apps: &'a [AppEntry], key: &str) -> Result<&'a AppEntry, String> {
    let key = key.trim();
    if key.is_empty() {
        return Err("App não encontrada.".into());
    }
    if let Some(app) = apps
        .iter()
        .find(|app| app.folder_name.eq_ignore_ascii_case(key))
    {
        return Ok(app);
    }
    let matches: Vec<_> = apps
        .iter()
        .filter(|app| app.repository.eq_ignore_ascii_case(key))
        .collect();
    match matches.as_slice() {
        [app] => Ok(*app),
        [] => Err("App não encontrada.".into()),
        _ => Err(
            "Existem várias apps com este repositório. Abra pela pasta/nome da app.".into(),
        ),
    }
}

pub fn find_app_by_name<'a>(apps: &'a [AppEntry], name: &str) -> Result<&'a AppEntry, String> {
    apps.iter()
        .find(|app| app.name.eq_ignore_ascii_case(name.trim()))
        .ok_or_else(|| format!("Não há uma app chamada {name}."))
}

fn sort_key_played(app: &AppView) -> String {
    app.last_played.clone().unwrap_or_default()
}

pub fn snapshot(meta: &Path, workspace: &Path) -> Result<LibrarySnapshot, String> {
    let settings = load_settings(meta);
    let cache = load_version_cache(meta);
    let mut apps: Vec<AppView> = load_apps(meta)
        .iter()
        .map(|app| view_app(meta, workspace, app, &settings, &cache))
        .collect();
    let sort_by = {
        let value = setting_str(&settings, "SortBy");
        if value.is_empty() { "LastPlayed".into() } else { value }
    };
    apps.sort_by(|left, right| {
        let name = left.name.to_lowercase().cmp(&right.name.to_lowercase());
        let left_installed = left.status != "not_installed";
        let right_installed = right.status != "not_installed";
        match sort_by.as_str() {
            "NameDesc" => right.name.to_lowercase().cmp(&left.name.to_lowercase()),
            "Installed" => right_installed.cmp(&left_installed).then(name),
            "NotInstalled" => left_installed.cmp(&right_installed).then(name),
            "Name" => name,
            _ => sort_key_played(right).cmp(&sort_key_played(left)).then(name),
        }
    });
    let continue_repository = apps
        .iter()
        .filter(|app| !app.manually_hidden && !app.filter_hidden && app.status != "not_installed" && app.last_played.is_some())
        .max_by(|left, right| sort_key_played(left).cmp(&sort_key_played(right)))
        .map(|app| app.repository.clone());
    Ok(LibrarySnapshot {
        installed_only: !setting_list(&settings, "HiddenApps").is_empty(),
        use_grid: setting_bool(&settings, "UseGridView", true),
        data_dir: meta.display().to_string(),
        sort_by,
        continue_repository,
        apps,
    })
}

pub fn set_sort(root: &Path, sort_by: &str) -> Result<(), String> {
    let mut settings = load_settings(root);
    if let Some(map) = settings.as_object_mut() {
        map.insert("SortBy".into(), json!(sort_by));
    }
    save_settings(root, &settings)
}

pub fn set_installed_filter(meta: &Path, workspace: &Path, installed_only: bool) -> Result<(), String> {
    let mut settings = load_settings(meta);
    let apps = load_apps(meta);
    let hidden = if installed_only {
        apps.iter()
            .filter(|app| installed_version(workspace, app).is_none())
            .map(hidden_key)
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    if let Some(map) = settings.as_object_mut() {
        map.insert("HiddenApps".into(), json!(hidden));
    }
    save_settings(meta, &settings)
}

pub fn set_manual_hide(root: &Path, repository: &str, hidden: bool) -> Result<(), String> {
    let apps = load_apps(root);
    let app = find_app(&apps, repository)?.clone();
    let mut settings = load_settings(root);
    let mut list = setting_list(&settings, "ManuallyHiddenApps");
    let key = hidden_key(&app);
    list.retain(|item| item != &key && item != &app.name);
    if hidden {
        list.push(key);
    }
    if let Some(map) = settings.as_object_mut() {
        map.insert("ManuallyHiddenApps".into(), json!(list));
    }
    save_settings(root, &settings)
}

pub fn set_skipped(root: &Path, repository: &str, version: Option<String>) -> Result<(), String> {
    let mut apps = load_apps(root);
    let app = apps
        .iter_mut()
        .find(|app| app.repository.eq_ignore_ascii_case(repository))
        .ok_or_else(|| "App não encontrada.".to_string())?;
    app.skipped_update_version = version.filter(|item| !item.trim().is_empty());
    save_apps(root, &apps)
}

pub fn locate_install(root: &Path, repository: &str, path: &str) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() || !Path::new(path).is_dir() {
        return Err("Escolha uma pasta que já exista.".into());
    }
    let mut apps = load_apps(root);
    let app = apps
        .iter_mut()
        .find(|app| app.repository.eq_ignore_ascii_case(repository))
        .ok_or_else(|| "App não encontrada.".to_string())?;
    app.install_path = Some(path.to_string());
    let info = PathBuf::from(path)
        .parent()
        .map(|parent| parent.join("launch-info"))
        .unwrap_or_else(|| PathBuf::from(path).join("launch-info"));
    fs::create_dir_all(&info).map_err(|err| err.to_string())?;
    if !info.join("version.txt").is_file() {
        fs::write(info.join("version.txt"), "v0.0.0").map_err(|err| err.to_string())?;
    }
    save_apps(root, &apps)
}

pub fn delete_install(meta: &Path, workspace: &Path, repository: &str) -> Result<(), String> {
    let apps = load_apps(meta);
    let app = find_app(&apps, repository)?;
    let dir = install_dir(workspace, app);
    if !dir.is_dir() {
        return Err("Esta app não está instalada.".into());
    }
    if dir == workspace || dir == meta {
        return Err("Essa pasta não pode ser apagada.".into());
    }
    fs::remove_dir_all(&dir).map_err(|err| err.to_string())?;
    let info = launch_info_dir(workspace, app);
    if info.is_dir() {
        let _ = fs::remove_dir_all(&info);
    }
    // Remove `{appFolder}/` se ficou vazia após apagar o clone.
    let home = app_dir(workspace, app);
    if home != workspace
        && home != meta
        && home.is_dir()
        && fs::read_dir(&home)
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false)
    {
        let _ = fs::remove_dir(&home);
    }
    Ok(())
}

pub fn cache_age_ok(checked_at: i64, installed: bool, now: i64, force: bool) -> bool {
    if force {
        return false;
    }
    let age = now.saturating_sub(checked_at);
    let interval = if installed { 6 * 3600 } else { 24 * 3600 };
    age < interval && age < 24 * 3600
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merges_legacy_sections_and_dedupes_by_folder() {
        let raw = r#"{
            "standard": [{"name": "Um", "repository": "acme/um", "folderName": "um"}],
            "custom": [
                {"name": "Um de novo", "repository": "acme/um"},
                {"name": "Dois", "repository": "acme/dois", "gameIconUrl": "https://example.com/a.png"}
            ]
        }"#;
        let apps = parse_apps_value(&serde_json::from_str(raw).unwrap());
        // Mesmo repo (acme/um) duas vezes — pastas distintas — ambas ficam.
        assert_eq!(apps.len(), 3);
        assert_eq!(apps[2].app_icon_url.as_deref(), Some("https://example.com/a.png"));
    }

    #[test]
    fn same_repository_two_folders_find_by_folder() {
        let root = std::env::temp_dir().join(format!("painel-same-repo-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        ensure_root(&root).unwrap();
        upsert_app(
            &root,
            AppEntry {
                name: "hello".into(),
                repository: "gitname/react-gh-pages".into(),
                folder_name: "hello".into(),
                install_path: None,
                app_icon_url: None,
                preferred_version: None,
                skipped_update_version: None,
            },
            None,
        )
        .unwrap();
        upsert_app(
            &root,
            AppEntry {
                name: "hello002".into(),
                repository: "gitname/react-gh-pages".into(),
                folder_name: "hello002".into(),
                install_path: None,
                app_icon_url: None,
                preferred_version: None,
                skipped_update_version: None,
            },
            None,
        )
        .unwrap();
        let apps = load_apps(&root);
        assert_eq!(apps.len(), 2);
        assert_eq!(find_app(&apps, "hello").unwrap().folder_name, "hello");
        assert_eq!(find_app(&apps, "hello002").unwrap().folder_name, "hello002");
        assert!(find_app(&apps, "gitname/react-gh-pages")
            .unwrap_err()
            .contains("várias apps"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn roundtrip_library( ) {
        let root = std::env::temp_dir().join(format!("painel-store-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        ensure_root(&root).unwrap();
        let entry = normalize_entry(AppEntry {
            name: "Demo".into(),
            repository: "acme/demo".into(),
            folder_name: String::new(),
            install_path: None,
            app_icon_url: None,
            preferred_version: None,
            skipped_update_version: None,
        }).unwrap();
        upsert_app(&root, entry, None).unwrap();
        let loaded = load_apps(&root);
        assert_eq!(loaded[0].folder_name, "Demo");
        assert_eq!(
            install_dir(&root, &loaded[0]),
            root.join("Demo").join(REPOSITORIES_DIR).join("demo")
        );
        set_installed_filter(&root, &root, true).unwrap();
        let snap = snapshot(&root, &root).unwrap();
        assert!(snap.apps[0].filter_hidden);
        let _ = fs::remove_dir_all(&root);
    }
}
