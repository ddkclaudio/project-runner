use crate::launcher::version::is_newer;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

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
    /// A pasta instalada é um clone git (selector de branch).
    pub git_clone: bool,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceAccount {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub token: String,
    /// Repositório de atualização desta conta. Vazio não mexe no do Catálogo.
    #[serde(default)]
    pub update_repository: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInput {
    pub apps_path: String,
    pub github_api_token: String,
    #[serde(default)]
    pub github_accounts: Vec<ServiceAccount>,
    pub deepseek_api_token: String,
    pub cloudflare_api_token: String,
    #[serde(default)]
    pub cloudflare_accounts: Vec<ServiceAccount>,
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
    #[serde(default)]
    pub app_list_account_name: String,
    #[serde(default)]
    pub app_list_api_token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSettings {
    pub apps_path: String,
    pub github_api_token: String,
    pub github_accounts: Vec<ServiceAccount>,
    pub deepseek_api_token: String,
    pub cloudflare_api_token: String,
    pub cloudflare_accounts: Vec<ServiceAccount>,
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
    pub app_list_account_name: String,
    pub app_list_api_token: String,
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
        "AppListAccountName": "",
        "AppListApiToken": "",
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
    let github_accounts = accounts_of(&settings, "GitHubAccounts", "GitHubApiToken");
    let cloudflare_accounts = accounts_of(&settings, "CloudflareAccounts", "CloudflareApiToken");
    PublicSettings {
        apps_path: setting_str(&settings, "AppsPath"),
        github_api_token: first_token(&github_accounts),
        github_accounts,
        deepseek_api_token: setting_str(&settings, "DeepSeekApiToken"),
        cloudflare_api_token: first_token(&cloudflare_accounts),
        cloudflare_accounts,
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
        app_list_account_name: clip_account_label(&setting_str(&settings, "AppListAccountName")),
        app_list_api_token: clip_token(&setting_str(&settings, "AppListApiToken")),
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
    let github_accounts = reconcile_accounts(input.github_accounts, &input.github_api_token);
    let cloudflare_accounts = reconcile_accounts(input.cloudflare_accounts, &input.cloudflare_api_token);
    map.insert("GitHubAccounts".into(), serde_json::to_value(&github_accounts).unwrap_or(json!([])));
    map.insert("GitHubApiToken".into(), json!(first_token(&github_accounts)));
    map.insert("DeepSeekApiToken".into(), json!(input.deepseek_api_token.trim()));
    map.insert(
        "CloudflareAccounts".into(),
        serde_json::to_value(&cloudflare_accounts).unwrap_or(json!([])),
    );
    map.insert("CloudflareApiToken".into(), json!(first_token(&cloudflare_accounts)));
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
    map.insert(
        "AppListAccountName".into(),
        json!(clip_account_label(&input.app_list_account_name)),
    );
    map.insert(
        "AppListApiToken".into(),
        json!(clip_token(&input.app_list_api_token)),
    );
    save_settings(root, &settings)?;
    Ok(public_settings(root))
}

pub fn token_of(root: &Path) -> String {
    first_token(&github_accounts(root))
}

pub fn deepseek_token_of(root: &Path) -> String {
    setting_str(&load_settings(root), "DeepSeekApiToken")
}

pub fn cloudflare_token_of(root: &Path) -> String {
    first_token(&cloudflare_accounts(root))
}

pub fn cloudflare_has_token(root: &Path) -> bool {
    !cloudflare_token_of(root).trim().is_empty()
}

pub fn cloudflare_token_for(root: &Path, account_id: Option<&str>) -> Result<String, String> {
    let accounts = cloudflare_accounts(root);
    if let Some(id) = account_id.map(str::trim).filter(|value| !value.is_empty()) {
        return accounts
            .into_iter()
            .find(|account| account.id == id && !account.token.trim().is_empty())
            .map(|account| account.token)
            .ok_or_else(|| "A conta Cloudflare desta zona já não está nas definições.".to_string());
    }
    let token = first_token(&accounts);
    if token.trim().is_empty() {
        return Err("Configure o token da API Cloudflare em Definições → Cloudflare.".into());
    }
    Ok(token)
}

pub fn github_accounts(root: &Path) -> Vec<ServiceAccount> {
    accounts_of(&load_settings(root), "GitHubAccounts", "GitHubApiToken")
}

pub fn cloudflare_accounts(root: &Path) -> Vec<ServiceAccount> {
    accounts_of(&load_settings(root), "CloudflareAccounts", "CloudflareApiToken")
}

fn first_token(accounts: &[ServiceAccount]) -> String {
    accounts
        .iter()
        .find(|account| !account.token.trim().is_empty())
        .map(|account| account.token.trim().to_string())
        .unwrap_or_default()
}

fn accounts_of(settings: &Value, list_key: &str, legacy_key: &str) -> Vec<ServiceAccount> {
    if settings.get(list_key).is_some() {
        return normalize_accounts(parse_accounts(settings.get(list_key)));
    }
    let legacy = setting_str(settings, legacy_key);
    if legacy.trim().is_empty() {
        return Vec::new();
    }
    vec![ServiceAccount {
        id: "legacy".into(),
        label: String::new(),
        token: legacy.trim().to_string(),
        update_repository: String::new(),
    }]
}

fn parse_accounts(value: Option<&Value>) -> Vec<ServiceAccount> {
    value
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| serde_json::from_value::<ServiceAccount>(item.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

fn normalize_accounts(accounts: Vec<ServiceAccount>) -> Vec<ServiceAccount> {
    let mut out = Vec::new();
    for (index, account) in accounts.into_iter().enumerate() {
        let token = account.token.trim();
        if token.is_empty() {
            continue;
        }
        let mut id = account.id.trim().to_string();
        if id.is_empty() || out.iter().any(|item: &ServiceAccount| item.id == id) {
            id = new_account_id(index);
        }
        out.push(ServiceAccount {
            id,
            label: clip_account_label(&account.label),
            token: clip_token(token),
            update_repository: clip_repo(&account.update_repository),
        });
    }
    out
}

fn reconcile_accounts(accounts: Vec<ServiceAccount>, flat_token: &str) -> Vec<ServiceAccount> {
    let accounts = normalize_accounts(accounts);
    if !accounts.is_empty() {
        return accounts;
    }
    let flat = flat_token.trim();
    if flat.is_empty() {
        return Vec::new();
    }
    vec![ServiceAccount {
        id: "legacy".into(),
        label: String::new(),
        token: clip_token(flat),
        update_repository: String::new(),
    }]
}

fn clip_account_label(value: &str) -> String {
    value.trim().chars().take(80).collect()
}

fn clip_token(value: &str) -> String {
    value.trim().chars().take(800).collect()
}

fn clip_repo(value: &str) -> String {
    value.trim().chars().take(300).collect()
}

fn new_account_id(index: usize) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_nanos())
        .unwrap_or(0);
    format!("acc-{nanos}-{index}")
}

/// Nome mostrado nas listas. Nome vazio ou repetido ganha o login da API.
pub fn account_labels(accounts: &[ServiceAccount], logins: &[String]) -> Vec<String> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for account in accounts {
        let key = account.label.trim().to_lowercase();
        *counts.entry(key).or_insert(0) += 1;
    }
    accounts
        .iter()
        .enumerate()
        .map(|(index, account)| {
            let label = account.label.trim();
            let login = logins.get(index).map(|value| value.trim()).unwrap_or("");
            let duplicated = counts.get(&label.to_lowercase()).copied().unwrap_or(0) > 1;
            if label.is_empty() {
                if login.is_empty() {
                    "Conta".to_string()
                } else {
                    login.to_string()
                }
            } else if duplicated && !login.is_empty() && !login.eq_ignore_ascii_case(label) {
                format!("{label} · {login}")
            } else {
                label.to_string()
            }
        })
        .collect()
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

/// Ícones locais antigos: `{workspace}/{appFolder}/images/`.
pub fn images_dir(workspace: &Path, app: &AppEntry) -> PathBuf {
    app_dir(workspace, app).join("images")
}

/// Avatar do projeto, na raiz de `launch-info/` (não na pasta da branch).
/// O Launchfile vive em `launch-info/branches/{branch}/`; a imagem é do projeto.
pub fn project_avatar_path(info: &Path) -> PathBuf {
    info.join("avatar").join("icon.webp")
}

/// Nome da pasta que contém os clones dentro da app.
pub const REPOSITORIES_DIR: &str = "repositories";

/// Destino do clone/instalação: `{workspace}/{appFolder}/repositories/{repo}/`.
pub fn install_dir(workspace: &Path, app: &AppEntry) -> PathBuf {
    if let Some(path) = app.install_path.as_ref().filter(|path| !path.trim().is_empty()) {
        let custom = PathBuf::from(path);
        // Um save antigo gravou a pasta da app (view) como installPath. Isso não é um destino custom.
        if custom != app_dir(workspace, app) {
            return custom;
        }
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
/// Contém version.txt, LastPlayed.txt, open_url.txt, selected_executable.txt.
/// O Launchfile de cada branch fica em `launch-info/branches/{branch}/`.
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

/// Segmento de pasta para uma branch. `/` e `\` viram `__`.
pub fn sanitize_branch_dir(branch: &str) -> String {
    let mut out = String::new();
    for ch in branch.trim().chars() {
        match ch {
            '/' | '\\' => out.push_str("__"),
            c if c.is_control() => {}
            ':' | '*' | '?' | '"' | '<' | '>' | '|' => out.push('_'),
            c => out.push(c),
        }
    }
    let trimmed = out.trim().trim_matches('.').to_string();
    if trimmed.is_empty() {
        "default".into()
    } else {
        trimmed
    }
}

pub fn branch_launch_dir(info: &Path, branch: &str) -> PathBuf {
    info.join("branches").join(sanitize_branch_dir(branch))
}

pub fn active_branch_name(meta: &Path, workspace: &Path, app: &AppEntry) -> String {
    let project = install_dir(workspace, app);
    crate::launcher::runtime::selected_branch(meta, &app.folder_name)
        .filter(|item| !item.trim().is_empty())
        .or_else(|| crate::launcher::install::current_branch(&project))
        .unwrap_or_else(|| "default".into())
}

/// Pasta do Launchfile da branch activa. Copia o ficheiro antigo da raiz uma vez.
pub fn active_launch_dir(meta: &Path, workspace: &Path, app: &AppEntry) -> Result<PathBuf, String> {
    let info = ensure_launch_info(workspace, app)?;
    let branch = active_branch_name(meta, workspace, app);
    let dir = branch_launch_dir(&info, &branch);
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let dest = dir.join("Launchfile");
    let legacy = info.join("Launchfile");
    if !dest.is_file() && legacy.is_file() {
        fs::copy(&legacy, &dest).map_err(|err| err.to_string())?;
    }
    Ok(dir)
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
    let avatar = project_avatar_path(&launch_info_dir(workspace, app));
    if avatar.is_file() {
        return Some(avatar);
    }
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
        git_clone: dir.join(".git").is_dir(),
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

pub fn halt_app(meta: &Path, workspace: &Path, app: &AppEntry) {
    if crate::launcher::runtime::is_running(meta, &app.folder_name) {
        let _ = crate::launcher::runtime::stop(meta, &app.folder_name);
    }
    let info = launch_info_dir(workspace, app);
    if info.is_dir() {
        let _ = crate::launcher::cloudflare::stop_tunnel(meta, workspace, &info, app);
    }
}

pub fn delete_install(meta: &Path, workspace: &Path, repository: &str) -> Result<(), String> {
    let apps = load_apps(meta);
    let app = find_app(&apps, repository)?;
    halt_app(meta, workspace, app);
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

const MAX_COMMUNICATION_NODES: usize = 200;
const MAX_COMMUNICATION_EDGES: usize = 400;
const MAX_COMMUNICATION_FIELD: usize = 200;
const MAX_COMMUNICATION_LITERAL: usize = 2000;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunicationNode {
    pub id: String,
    #[serde(default)]
    pub folder_name: String,
    #[serde(default)]
    pub repository: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    #[serde(default)]
    pub always_on: bool,
    /// `increment`, `decrement`, `value`, `get`, `primitive` ou `port`. Vazio ou desconhecido é node de app e não é gravado.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub kind: String,
    /// App ou outra operação de onde o valor sai. Só em node de operação.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source_node_id: String,
    /// Campo da app de origem (`port`, `env.PORT`). Vazio quando a origem é outra operação.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub source_field: String,
    /// Texto guardado por um node `value` ou `primitive`, ou a porta de um node `port`.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub literal: String,
    /// `number`, `text`, `multiline`, `boolean`, `url` ou `file`. Só em node `primitive`.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub value_type: String,
    /// Quanto somar ou subtrair. Ausente num grafo antigo vale 1. Só em incrementar e decrementar.
    #[serde(default = "default_step", skip_serializing_if = "String::is_empty")]
    pub step: String,
    /// Última verificação de `port_check`. Só em node `port`. Ausente até verificar.
    /// `in_use` falso é porta livre e não carrega processo.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub port_status: Option<PortStatus>,
}

/// Resultado gravado da verificação da porta. Ausente no node significa que ainda não foi verificada.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortStatus {
    pub in_use: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub process_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub folder_name: Option<String>,
}

fn default_step() -> String {
    "1".into()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunicationEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    /// Campo da app de destino. Vazio na aresta entre operações e na ligação só visual entre apps.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub target_field: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunicationsGraph {
    #[serde(default)]
    pub nodes: Vec<CommunicationNode>,
    #[serde(default)]
    pub edges: Vec<CommunicationEdge>,
}

fn communications_path(root: &Path) -> PathBuf {
    root.join("communications.json")
}

fn clip_line(value: &str, max: usize) -> String {
    let mut out = String::new();
    for ch in value.trim().chars() {
        if out.chars().count() >= max {
            break;
        }
        if ch == '\n' || ch == '\r' {
            continue;
        }
        out.push(ch);
    }
    out
}

fn clip_block(value: &str, max: usize) -> String {
    let mut out = String::new();
    for ch in value.trim().chars() {
        if out.chars().count() >= max {
            break;
        }
        if ch == '\r' {
            continue;
        }
        out.push(ch);
    }
    out
}

/// Kind desconhecido ou vazio continua node de app. `get` copia o valor. `port` guarda a porta.
fn op_kind(kind: &str) -> &'static str {
    match kind.trim() {
        "increment" => "increment",
        "decrement" => "decrement",
        "value" => "value",
        "get" => "get",
        "primitive" => "primitive",
        "port" => "port",
        _ => "",
    }
}

fn normalize_port_literal(literal: &str) -> Option<String> {
    let clipped = clip_line(literal, 8);
    let port = clipped.parse::<u16>().ok()?;
    if port == 0 {
        None
    } else {
        Some(port.to_string())
    }
}

fn status_text(value: &Option<String>, max: usize) -> Option<String> {
    let clipped = clip_line(value.as_deref().unwrap_or(""), max);
    if clipped.is_empty() {
        None
    } else {
        Some(clipped)
    }
}

/// Só nodes `port` guardam a verificação. Porta livre não fica com processo antigo.
fn sanitize_port_status(status: Option<PortStatus>, port: bool) -> Option<PortStatus> {
    if !port {
        return None;
    }
    let status = status?;
    if !status.in_use {
        return Some(PortStatus {
            in_use: false,
            pid: None,
            process_name: None,
            app_name: None,
            folder_name: None,
        });
    }
    Some(PortStatus {
        in_use: true,
        pid: status.pid.filter(|pid| *pid > 0),
        process_name: status_text(&status.process_name, 200),
        app_name: status_text(&status.app_name, 200),
        folder_name: status_text(&status.folder_name, 300),
    })
}

fn primitive_value_type(kind: &str, value_type: &str) -> String {
    if kind != "primitive" {
        return String::new();
    }
    match value_type.trim() {
        "number" | "text" | "multiline" | "boolean" | "url" | "file" => value_type.trim().to_string(),
        _ => "text".into(),
    }
}

fn primitive_literal(value_type: &str, literal: &str) -> String {
    // Arquivo pode guardar vários caminhos, um por linha. O resto do literal é uma linha só.
    if value_type == "multiline" || value_type == "file" {
        return clip_block(literal, MAX_COMMUNICATION_LITERAL);
    }
    let clipped = clip_line(literal, MAX_COMMUNICATION_LITERAL);
    if value_type == "boolean" {
        return match clipped.to_ascii_lowercase().as_str() {
            "true" | "yes" | "on" | "1" => "true".into(),
            _ => "false".into(),
        };
    }
    clipped
}

pub fn empty_communications() -> CommunicationsGraph {
    CommunicationsGraph {
        nodes: Vec::new(),
        edges: Vec::new(),
    }
}

pub fn sanitize_communications(graph: CommunicationsGraph) -> CommunicationsGraph {
    let mut nodes = Vec::new();
    let mut seen_nodes = std::collections::HashSet::new();
    for node in graph.nodes {
        if nodes.len() >= MAX_COMMUNICATION_NODES {
            break;
        }
        let kind = op_kind(&node.kind).to_string();
        let primitive = kind == "primitive";
        let port = kind == "port";
        let port_literal = if port {
            match normalize_port_literal(&node.literal) {
                Some(value) => value,
                None => continue,
            }
        } else {
            String::new()
        };
        let id = clip_line(&node.id, 80);
        if id.is_empty() || !seen_nodes.insert(id.clone()) || !node.x.is_finite() || !node.y.is_finite() {
            continue;
        }
        let op = !kind.is_empty() && !primitive && !port;
        let value_type = primitive_value_type(&kind, &node.value_type);
        let literal = if kind == "value" {
            clip_line(&node.literal, MAX_COMMUNICATION_LITERAL)
        } else if primitive {
            primitive_literal(&value_type, &node.literal)
        } else if port {
            port_literal
        } else {
            String::new()
        };
        let step = if kind == "increment" || kind == "decrement" {
            let clipped = clip_line(&node.step, 80);
            if clipped.is_empty() { "1".into() } else { clipped }
        } else {
            String::new()
        };
        let mut name = clip_line(&node.name, 200);
        if port && name.is_empty() {
            name = "Porta".into();
        }
        nodes.push(CommunicationNode {
            id,
            folder_name: clip_line(&node.folder_name, 300),
            repository: clip_line(&node.repository, 300),
            name,
            x: node.x,
            y: node.y,
            always_on: node.always_on && !primitive && !port,
            kind,
            source_node_id: if op {
                clip_line(&node.source_node_id, 80)
            } else {
                String::new()
            },
            source_field: if op {
                clip_line(&node.source_field, MAX_COMMUNICATION_FIELD)
            } else {
                String::new()
            },
            literal,
            value_type,
            step,
            port_status: sanitize_port_status(node.port_status, port),
        });
    }
    let app_ids: std::collections::HashSet<String> = nodes
        .iter()
        .filter(|node| node.kind.is_empty())
        .map(|node| node.id.clone())
        .collect();
    let op_ids: std::collections::HashSet<String> = nodes
        .iter()
        .filter(|node| !node.kind.is_empty())
        .map(|node| node.id.clone())
        .collect();
    for node in &mut nodes {
        // sourceField só quando a origem é uma app. Operação encadeada não tem campo.
        if !app_ids.contains(&node.source_node_id) {
            node.source_field.clear();
        }
    }
    let ids: std::collections::HashSet<String> = nodes.iter().map(|node| node.id.clone()).collect();
    let mut edges = Vec::new();
    let mut seen_edges = std::collections::HashSet::new();
    let mut pairs = std::collections::HashSet::new();
    for edge in graph.edges {
        if edges.len() >= MAX_COMMUNICATION_EDGES {
            break;
        }
        let id = clip_line(&edge.id, 80);
        let source = clip_line(&edge.source, 80);
        let target = clip_line(&edge.target, 80);
        if id.is_empty() || source.is_empty() || target.is_empty() || source == target {
            continue;
        }
        if !ids.contains(&source) || !ids.contains(&target) {
            continue;
        }
        if !seen_edges.insert(id.clone()) || !pairs.insert((source.clone(), target.clone())) {
            continue;
        }
        // targetField só na aresta de uma operação para uma app.
        let target_field = if op_ids.contains(&source) && app_ids.contains(&target) {
            clip_line(&edge.target_field, MAX_COMMUNICATION_FIELD)
        } else {
            String::new()
        };
        edges.push(CommunicationEdge {
            id,
            source,
            target,
            target_field,
        });
    }
    CommunicationsGraph { nodes, edges }
}

pub fn load_communications(root: &Path) -> Result<CommunicationsGraph, String> {
    let path = communications_path(root);
    if !path.is_file() {
        return Ok(empty_communications());
    }
    let raw = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    if raw.trim().is_empty() {
        return Ok(empty_communications());
    }
    let parsed: CommunicationsGraph = serde_json::from_str(&raw).map_err(|err| err.to_string())?;
    Ok(sanitize_communications(parsed))
}

pub fn save_communications(root: &Path, graph: CommunicationsGraph) -> Result<CommunicationsGraph, String> {
    ensure_root(root)?;
    let clean = sanitize_communications(graph);
    let raw = serde_json::to_string_pretty(&clean).map_err(|err| err.to_string())?;
    fs::write(communications_path(root), raw).map_err(|err| err.to_string())?;
    Ok(clean)
}

/// O nome é só um rótulo. Atualiza nós de app com a mesma pasta, ou, sem pasta, o mesmo repositório.
/// Operações e primitivos ficam como estão. Pasta e repositório do nó não mudam.
pub fn apply_app_alias(
    mut graph: CommunicationsGraph,
    folder: &str,
    repository: &str,
    name: &str,
) -> CommunicationsGraph {
    let name = clip_line(name, 200);
    if name.is_empty() {
        return graph;
    }
    let folder = folder.trim();
    let repository = repository.trim();
    for node in &mut graph.nodes {
        if !node.kind.is_empty() {
            continue;
        }
        let matches = if !node.folder_name.trim().is_empty() {
            !folder.is_empty() && node.folder_name.eq_ignore_ascii_case(folder)
        } else {
            !repository.is_empty() && node.repository.eq_ignore_ascii_case(repository)
        };
        if matches {
            node.name = name.clone();
        }
    }
    graph
}

pub fn persist_app_alias(meta: &Path, app: &AppEntry) -> Result<(), String> {
    let graph = load_communications(meta)?;
    let next = apply_app_alias(graph, &app.folder_name, &app.repository, &app.name);
    save_communications(meta, next)?;
    Ok(())
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
    fn communications_drop_invalid_edges() {
        let raw = r#"{
            "nodes": [
                {"id": "a", "folderName": "hello", "repository": "acme/hello", "name": "Hello", "x": 10, "y": 20},
                {"id": "op", "kind": "increment", "sourceNodeId": "a", "sourceField": " port ", "literal": "3001", "x": 40, "y": 20},
                {"id": "down", "kind": "decrement", "sourceNodeId": "a", "sourceField": "port", "literal": "nope", "x": 70, "y": 20},
                {"id": "val", "kind": "value", "sourceNodeId": "op", "sourceField": "port", "literal": "4000", "x": 100, "y": 20},
                {"id": "bad", "kind": "nope", "sourceNodeId": "a", "sourceField": "port", "literal": "1", "x": 0, "y": 40},
                {"id": "empty", "kind": "", "x": 20, "y": 40}
            ],
            "edges": [
                {"id": "e1", "source": "a", "target": "a"},
                {"id": "e2", "source": "a", "target": "missing"},
                {"id": "e3", "source": "op", "target": "a", "targetField": " env.PORT "},
                {"id": "e4", "source": "val", "target": "op", "targetField": "port"},
                {"id": "e5", "source": "a", "target": "bad", "targetField": "port"}
            ]
        }"#;
        let parsed: CommunicationsGraph = serde_json::from_str(raw).unwrap();
        let graph = sanitize_communications(parsed);
        assert_eq!(graph.nodes.len(), 6);
        assert!(graph.edges.iter().all(|edge| edge.id != "e1" && edge.id != "e2"));

        let app = graph.nodes.iter().find(|node| node.id == "a").unwrap();
        assert_eq!(app.folder_name, "hello");
        assert!(app.kind.is_empty(), "kind ausente continua node de app");
        assert!(app.source_node_id.is_empty());
        assert!(app.source_field.is_empty());
        assert!(app.literal.is_empty());
        assert!(app.step.is_empty());

        let empty = graph.nodes.iter().find(|node| node.id == "empty").unwrap();
        assert!(empty.kind.is_empty(), "kind vazio continua node de app");

        let bad = graph.nodes.iter().find(|node| node.id == "bad").unwrap();
        assert!(bad.kind.is_empty(), "kind desconhecido continua node de app");
        assert!(bad.source_node_id.is_empty());
        assert!(bad.source_field.is_empty());
        assert!(bad.literal.is_empty());

        let op = graph.nodes.iter().find(|node| node.id == "op").unwrap();
        assert_eq!(op.kind, "increment");
        assert_eq!(op.source_node_id, "a");
        assert_eq!(op.source_field, "port");
        assert!(op.literal.is_empty());
        assert_eq!(op.step, "1", "grafo antigo sem passo soma 1");

        let down = graph.nodes.iter().find(|node| node.id == "down").unwrap();
        assert_eq!(down.kind, "decrement");
        assert_eq!(down.source_field, "port");
        assert!(down.literal.is_empty());

        let val = graph.nodes.iter().find(|node| node.id == "val").unwrap();
        assert_eq!(val.kind, "value");
        assert_eq!(val.source_node_id, "op");
        assert!(val.source_field.is_empty(), "origem operação não guarda sourceField");
        assert_eq!(val.literal, "4000");

        let dest = graph.edges.iter().find(|edge| edge.id == "e3").unwrap();
        assert_eq!(dest.target_field, "env.PORT");
        let chain = graph.edges.iter().find(|edge| edge.id == "e4").unwrap();
        assert!(chain.target_field.is_empty(), "aresta entre operações não tem targetField");
        let visual = graph.edges.iter().find(|edge| edge.id == "e5").unwrap();
        assert!(visual.target_field.is_empty(), "ligação entre apps não grava campo");

        let saved = serde_json::to_value(&graph).unwrap();
        let nodes = saved["nodes"].as_array().unwrap();
        let saved_app = nodes.iter().find(|node| node["id"] == "a").unwrap();
        assert!(saved_app.get("kind").is_none());
        assert!(saved_app.get("sourceNodeId").is_none());
        assert!(saved_app.get("sourceField").is_none());
        assert!(saved_app.get("literal").is_none());
        let saved_op = nodes.iter().find(|node| node["id"] == "op").unwrap();
        assert_eq!(saved_op["kind"], "increment");
        assert_eq!(saved_op["sourceNodeId"], "a");
        assert_eq!(saved_op["sourceField"], "port");
        assert!(saved_op.get("literal").is_none());
        let saved_val = nodes.iter().find(|node| node["id"] == "val").unwrap();
        assert_eq!(saved_val["kind"], "value");
        assert_eq!(saved_val["literal"], "4000");
        assert!(saved_val.get("sourceField").is_none());
        let saved_edges = saved["edges"].as_array().unwrap();
        let saved_dest = saved_edges.iter().find(|edge| edge["id"] == "e3").unwrap();
        assert_eq!(saved_dest["targetField"], "env.PORT");
        let saved_chain = saved_edges.iter().find(|edge| edge["id"] == "e4").unwrap();
        assert!(saved_chain.get("targetField").is_none());

        let again = sanitize_communications(serde_json::from_str(&serde_json::to_string(&graph).unwrap()).unwrap());
        assert_eq!(serde_json::to_value(&again).unwrap(), saved);
    }

    #[test]
    fn rename_updates_only_app_alias() {
        let raw = r#"{
            "nodes": [
                {"id": "a", "folderName": "hello", "repository": "acme/hello", "name": "Hello", "x": 0, "y": 0},
                {"id": "b", "folderName": "other", "repository": "acme/other", "name": "Other", "x": 10, "y": 0},
                {"id": "c", "folderName": "", "repository": "acme/hello", "name": "Copia", "x": 30, "y": 0},
                {"id": "num", "kind": "primitive", "valueType": "number", "name": "Número", "literal": "1", "folderName": "hello", "repository": "acme/hello", "x": 20, "y": 0}
            ],
            "edges": []
        }"#;
        let graph: CommunicationsGraph = serde_json::from_str(raw).unwrap();
        let next = apply_app_alias(graph, "hello", "acme/hello", "Olá");
        let renamed = next.nodes.iter().find(|node| node.id == "a").unwrap();
        assert_eq!(renamed.name, "Olá");
        assert_eq!(renamed.folder_name, "hello");
        assert_eq!(renamed.repository, "acme/hello");
        assert!(renamed.kind.is_empty());
        let other = next.nodes.iter().find(|node| node.id == "b").unwrap();
        assert_eq!(other.name, "Other");
        assert_eq!(other.folder_name, "other");
        assert_eq!(other.repository, "acme/other");
        let copy = next.nodes.iter().find(|node| node.id == "c").unwrap();
        assert_eq!(copy.name, "Olá");
        assert_eq!(copy.folder_name, "");
        assert_eq!(copy.repository, "acme/hello");
        let primitive = next.nodes.iter().find(|node| node.id == "num").unwrap();
        assert_eq!(primitive.name, "Número");
        assert_eq!(primitive.kind, "primitive");
        assert_eq!(primitive.folder_name, "hello");
    }

    #[test]
    fn communications_keep_primitives() {
        let raw = r#"{
            "nodes": [
                {"id": "app", "name": "App", "x": 0, "y": 0},
                {"id": "num", "kind": "primitive", "valueType": "number", "name": "Número", "literal": " 42 ", "sourceNodeId": "app", "sourceField": "port", "alwaysOn": true, "x": 10, "y": 10},
                {"id": "note", "kind": "primitive", "valueType": "multiline", "literal": " linha \n duas ", "x": 10, "y": 40},
                {"id": "flag", "kind": "primitive", "valueType": "boolean", "literal": "", "x": 10, "y": 70},
                {"id": "odd", "kind": "primitive", "valueType": "nope", "literal": "oi", "x": 10, "y": 100},
                {"id": "bad", "kind": "nope", "literal": "1", "valueType": "number", "x": 10, "y": 130}
            ],
            "edges": [
                {"id": "to-app", "source": "num", "target": "app", "targetField": " port "},
                {"id": "to-note", "source": "num", "target": "note", "targetField": "port"}
            ]
        }"#;
        let graph = sanitize_communications(serde_json::from_str(raw).unwrap());
        let num = graph.nodes.iter().find(|node| node.id == "num").unwrap();
        assert_eq!(num.kind, "primitive");
        assert_eq!(num.value_type, "number");
        assert_eq!(num.literal, "42");
        assert!(num.source_node_id.is_empty());
        assert!(num.source_field.is_empty());
        assert!(!num.always_on);

        let note = graph.nodes.iter().find(|node| node.id == "note").unwrap();
        assert_eq!(note.value_type, "multiline");
        assert_eq!(note.literal, "linha \n duas");

        let flag = graph.nodes.iter().find(|node| node.id == "flag").unwrap();
        assert_eq!(flag.value_type, "boolean");
        assert_eq!(flag.literal, "false");

        let odd = graph.nodes.iter().find(|node| node.id == "odd").unwrap();
        assert_eq!(odd.value_type, "text", "tipo desconhecido cai em texto");
        assert_eq!(odd.literal, "oi");

        let bad = graph.nodes.iter().find(|node| node.id == "bad").unwrap();
        assert!(bad.kind.is_empty(), "kind desconhecido continua node de app");
        assert!(bad.literal.is_empty());
        assert!(bad.value_type.is_empty());

        let to_app = graph.edges.iter().find(|edge| edge.id == "to-app").unwrap();
        assert_eq!(to_app.target_field, "port");
        let to_note = graph.edges.iter().find(|edge| edge.id == "to-note").unwrap();
        assert!(to_note.target_field.is_empty(), "primitivo não é destino de campo");

        let saved = serde_json::to_value(&graph).unwrap();
        let saved_num = saved["nodes"].as_array().unwrap().iter().find(|node| node["id"] == "num").unwrap();
        assert_eq!(saved_num["kind"], "primitive");
        assert_eq!(saved_num["valueType"], "number");
        assert_eq!(saved_num["literal"], "42");
        assert!(saved_num.get("sourceNodeId").is_none());
        assert!(saved_num.get("sourceField").is_none());
    }

    #[test]
    fn communications_keep_port_nodes() {
        let raw = r#"{
            "nodes": [
                {"id": "app", "name": "App", "portStatus": {"inUse": true, "processName": "nope"}, "x": 0, "y": 0},
                {"id": "p", "kind": "port", "name": "Porta", "literal": " 3000 ", "folderName": "hello", "alwaysOn": true, "sourceNodeId": "app", "sourceField": "port", "valueType": "number", "portStatus": {"inUse": true, "pid": 4242, "processName": " node\n ", "appName": " Hello ", "folderName": " hello "}, "x": 12, "y": 8},
                {"id": "bare", "kind": "port", "literal": "8080", "portStatus": {"inUse": false, "pid": 9, "processName": "stale", "appName": "Nope"}, "x": 4, "y": 4},
                {"id": "fresh", "kind": "port", "literal": "81", "x": 5, "y": 5},
                {"id": "nopid", "kind": "port", "literal": "90", "portStatus": {"inUse": true, "pid": 0, "processName": ""}, "x": 6, "y": 6},
                {"id": "zero", "kind": "port", "literal": "0", "x": 1, "y": 1},
                {"id": "wide", "kind": "port", "literal": "70000", "x": 2, "y": 2},
                {"id": "nope", "kind": "nope", "literal": "1", "portStatus": {"inUse": true, "pid": 1, "processName": "ghost"}, "x": 3, "y": 3}
            ],
            "edges": [
                {"id": "e", "source": "p", "target": "app", "targetField": " env.PORT "}
            ]
        }"#;
        let graph = sanitize_communications(serde_json::from_str(raw).unwrap());
        assert!(graph.nodes.iter().all(|node| node.id != "zero" && node.id != "wide"));
        let port = graph.nodes.iter().find(|node| node.id == "p").unwrap();
        assert_eq!(port.kind, "port");
        assert_eq!(port.literal, "3000");
        assert_eq!(port.name, "Porta");
        assert!(!port.always_on);
        assert!(port.source_node_id.is_empty());
        assert!(port.source_field.is_empty());
        assert!(port.value_type.is_empty());
        assert!(port.step.is_empty());
        let occupied = port.port_status.as_ref().unwrap();
        assert!(occupied.in_use);
        assert_eq!(occupied.pid, Some(4242));
        assert_eq!(occupied.process_name.as_deref(), Some("node"));
        assert_eq!(occupied.app_name.as_deref(), Some("Hello"));
        assert_eq!(occupied.folder_name.as_deref(), Some("hello"));
        let bare = graph.nodes.iter().find(|node| node.id == "bare").unwrap();
        assert_eq!(bare.kind, "port");
        assert_eq!(bare.name, "Porta");
        assert_eq!(bare.literal, "8080");
        let free = bare.port_status.as_ref().unwrap();
        assert!(!free.in_use);
        assert!(free.pid.is_none());
        assert!(free.process_name.is_none());
        assert!(free.app_name.is_none());
        let fresh = graph.nodes.iter().find(|node| node.id == "fresh").unwrap();
        assert!(fresh.port_status.is_none(), "porta sem verificação continua sem estado");
        let nopid = graph.nodes.iter().find(|node| node.id == "nopid").unwrap();
        let nopid_status = nopid.port_status.as_ref().unwrap();
        assert!(nopid_status.in_use);
        assert!(nopid_status.pid.is_none());
        assert!(nopid_status.process_name.is_none());
        let app = graph.nodes.iter().find(|node| node.id == "app").unwrap();
        assert!(app.port_status.is_none(), "node de app não guarda verificação de porta");
        let nope = graph.nodes.iter().find(|node| node.id == "nope").unwrap();
        assert!(nope.kind.is_empty(), "kind desconhecido continua node de app");
        assert!(nope.port_status.is_none(), "kind desconhecido não guarda verificação de porta");
        let edge = graph.edges.iter().find(|edge| edge.id == "e").unwrap();
        assert_eq!(edge.target_field, "env.PORT", "porta numérica grava o campo de destino");

        let saved = serde_json::to_value(&graph).unwrap();
        let nodes = saved["nodes"].as_array().unwrap();
        let saved_port = nodes.iter().find(|node| node["id"] == "p").unwrap();
        assert_eq!(saved_port["kind"], "port");
        assert_eq!(saved_port["literal"], "3000");
        assert!(saved_port.get("sourceNodeId").is_none());
        assert!(saved_port.get("valueType").is_none());
        assert_eq!(saved_port["portStatus"]["inUse"], true);
        assert_eq!(saved_port["portStatus"]["pid"], 4242);
        assert_eq!(saved_port["portStatus"]["processName"], "node");
        assert_eq!(saved_port["portStatus"]["appName"], "Hello");
        assert_eq!(saved_port["portStatus"]["folderName"], "hello");
        let saved_bare = nodes.iter().find(|node| node["id"] == "bare").unwrap();
        assert_eq!(saved_bare["portStatus"], serde_json::json!({ "inUse": false }));
        let saved_fresh = nodes.iter().find(|node| node["id"] == "fresh").unwrap();
        assert!(saved_fresh.get("portStatus").is_none());
        let saved_nopid = nodes.iter().find(|node| node["id"] == "nopid").unwrap();
        assert_eq!(saved_nopid["portStatus"], serde_json::json!({ "inUse": true }));
        let saved_app = nodes.iter().find(|node| node["id"] == "app").unwrap();
        assert!(saved_app.get("portStatus").is_none());
        let saved_nope = nodes.iter().find(|node| node["id"] == "nope").unwrap();
        assert!(saved_nope.get("portStatus").is_none());
        let again = sanitize_communications(serde_json::from_str(&serde_json::to_string(&graph).unwrap()).unwrap());
        assert_eq!(serde_json::to_value(&again).unwrap(), saved);
    }

    #[test]
    fn branch_dir_replaces_slashes() {
        assert_eq!(sanitize_branch_dir("feature/foo"), "feature__foo");
        assert_eq!(sanitize_branch_dir("gh-pages"), "gh-pages");
        assert_eq!(sanitize_branch_dir("  "), "default");
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

    #[test]
    fn legacy_token_becomes_one_account() {
        let settings = json!({ "GitHubApiToken": "ghp_old" });
        let accounts = accounts_of(&settings, "GitHubAccounts", "GitHubApiToken");
        assert_eq!(accounts.len(), 1);
        assert_eq!(accounts[0].id, "legacy");
        assert_eq!(accounts[0].token, "ghp_old");

        let saved = json!({ "GitHubAccounts": [], "GitHubApiToken": "ghp_old" });
        assert!(accounts_of(&saved, "GitHubAccounts", "GitHubApiToken").is_empty());
    }

    #[test]
    fn duplicate_account_labels_keep_the_login() {
        let accounts = vec![
            ServiceAccount { id: "a".into(), label: "Trabalho".into(), token: "1".into(), update_repository: String::new() },
            ServiceAccount { id: "b".into(), label: "Trabalho".into(), token: "2".into(), update_repository: String::new() },
        ];
        let labels = account_labels(&accounts, &["octo".into(), "hub".into()]);
        assert_eq!(labels, vec!["Trabalho · octo".to_string(), "Trabalho · hub".to_string()]);
    }

    #[test]
    fn file_literal_keeps_newline_separated_paths() {
        let literal = " C:\\a.txt \n D:\\b.txt ";
        let raw = json!({
            "nodes": [{
                "id": "file",
                "kind": "primitive",
                "valueType": "file",
                "literal": literal,
                "x": 0,
                "y": 0
            }],
            "edges": []
        });
        let graph = sanitize_communications(serde_json::from_value(raw).unwrap());
        assert_eq!(graph.nodes[0].value_type, "file");
        assert_eq!(graph.nodes[0].literal, "C:\\a.txt \n D:\\b.txt");
    }

    #[test]
    fn catalog_account_name_keeps_github_account() {
        let root = std::env::temp_dir().join(format!("painel-catalog-name-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        ensure_root(&root).unwrap();
        let saved = apply_settings(
            &root,
            SettingsInput {
                apps_path: String::new(),
                github_api_token: "ghp_acc".into(),
                github_accounts: vec![ServiceAccount {
                    id: "acc-1".into(),
                    label: "Trabalho".into(),
                    token: "ghp_acc".into(),
                    update_repository: "acme/painel".into(),
                }],
                deepseek_api_token: String::new(),
                cloudflare_api_token: String::new(),
                cloudflare_accounts: Vec::new(),
                cloudflared_path: String::new(),
                platform: "Auto".into(),
                sort_by: "LastPlayed".into(),
                use_grid_view: true,
                start_fullscreen: false,
                close_after_launch: false,
                background_image_path: String::new(),
                launcher_music_path: String::new(),
                music_volume: 0.2,
                background_opacity: 0.15,
                enable_gamepad_input: true,
                linux_windows_launch_command: String::new(),
                app_list_repository: "SirDiabo/GHLAppList".into(),
                painel_update_repository: "acme/painel-app".into(),
                app_list_account_name: "Catálogo público".into(),
                app_list_api_token: "ghp_cat".into(),
            },
        )
        .unwrap();
        assert_eq!(saved.app_list_account_name, "Catálogo público");
        assert_eq!(saved.app_list_api_token, "ghp_cat");
        assert_eq!(saved.app_list_repository, "SirDiabo/GHLAppList");
        assert_eq!(saved.painel_update_repository, "acme/painel-app");
        assert_eq!(saved.github_accounts.len(), 1);
        assert_eq!(saved.github_accounts[0].label, "Trabalho");
        assert_eq!(saved.github_accounts[0].token, "ghp_acc");
        assert_eq!(saved.github_accounts[0].update_repository, "acme/painel");
        assert_eq!(saved.github_api_token, "ghp_acc");
        let again = public_settings(&root);
        assert_eq!(again.app_list_account_name, "Catálogo público");
        assert_eq!(again.github_accounts[0].label, "Trabalho");
        assert_eq!(again.github_accounts[0].token, "ghp_acc");
        assert_eq!(again.github_accounts[0].update_repository, "acme/painel");
        let _ = fs::remove_dir_all(&root);
    }
}
