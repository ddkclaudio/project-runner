use crate::launcher::cloudflare::{self, CloudflareSaveInput, CloudflareView, CloudflareZoneList};
use crate::launcher::install::{self, InstallResult};
use crate::launcher::launch::{self, LaunchResult};
use crate::launcher::runners::{self, LaunchConfigSave, LaunchConfigView};
use crate::launcher::runtime;
use crate::launcher::self_update::{self, UpdateStatus};
use crate::launcher::store::{
    self, AppEntry, AppView, CommunicationsGraph, LibrarySnapshot, PublicSettings, SettingsInput,
};
use crate::launcher::github;
use crate::session::AppPaths;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StopResult {
    pub tunnel_stopped: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    repository: String,
    percent: u32,
    phase: String,
}

fn emit(app: &AppHandle, repository: &str, percent: u32, phase: &str) {
    let _ = app.emit(
        "launcher-progress",
        ProgressEvent {
            repository: repository.to_string(),
            percent,
            phase: phase.to_string(),
        },
    );
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogGroup {
    pub name: String,
    pub apps: Vec<AppEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPayload {
    pub repository: String,
    pub version: String,
    pub from_cache: bool,
    pub groups: Vec<CatalogGroup>,
    /// Falhas parciais (catálogo ou uma conta). A lista que deu certo continua aqui.
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataLocation {
    pub current: String,
    pub default: String,
    pub custom_configured: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetDataLocationResult {
    pub current: String,
    pub restart_required: bool,
}

fn catalog_groups(value: &Value) -> Vec<CatalogGroup> {
    if let Some(map) = value.as_object() {
        let groups: Vec<CatalogGroup> = map
            .iter()
            .filter_map(|(name, child)| {
                if !child.is_array() {
                    return None;
                }
                let apps = store::parse_apps_value(child);
                if apps.is_empty() {
                    None
                } else {
                    Some(CatalogGroup {
                        name: name.clone(),
                        apps,
                    })
                }
            })
            .collect();
        if !groups.is_empty() {
            return groups;
        }
    }
    vec![CatalogGroup {
        name: "Apps".into(),
        apps: store::parse_apps_value(value),
    }]
}

/// Identidade de clone: `dono/nome`, sem maiúsculas e sem sufixo `.git`.
fn repo_identity(value: &str) -> String {
    let trimmed = value.trim().trim_matches('/');
    let bytes = trimmed.as_bytes();
    let trimmed = if bytes.len() >= 4 && bytes[bytes.len() - 4..].eq_ignore_ascii_case(b".git") {
        &trimmed[..trimmed.len() - 4]
    } else {
        trimmed
    };
    trimmed.trim_matches('/').to_lowercase()
}

fn unique_group_name(groups: &[CatalogGroup], label: &str) -> String {
    let base = {
        let trimmed = label.trim();
        if trimmed.is_empty() { "Conta" } else { trimmed }
    };
    if !groups.iter().any(|group| group.name.eq_ignore_ascii_case(base)) {
        return base.to_string();
    }
    let suffixed = format!("{base} · Conta");
    if !groups.iter().any(|group| group.name.eq_ignore_ascii_case(&suffixed)) {
        return suffixed;
    }
    let mut index = 2usize;
    loop {
        let candidate = format!("{base} · Conta {index}");
        if !groups.iter().any(|group| group.name.eq_ignore_ascii_case(&candidate)) {
            return candidate;
        }
        index += 1;
    }
}

fn entry_from_repo(repo: &github::GithubRepo) -> store::AppEntry {
    let icon = repo.avatar_url.trim();
    let name = repo.name.trim();
    store::AppEntry {
        name: if name.is_empty() { repo.full_name.trim().to_string() } else { name.to_string() },
        repository: repo.full_name.trim().trim_matches('/').to_string(),
        folder_name: String::new(),
        install_path: None,
        app_icon_url: if icon.is_empty() { None } else { Some(icon.to_string()) },
        preferred_version: None,
        skipped_update_version: None,
    }
}

/// Projetos do catálogo primeiro. Repositórios das contas vêm a seguir, agrupados pelo nome da conta.
/// O mesmo `dono/nome` fica uma vez: a entrada do catálogo ganha.
fn append_account_projects(groups: &mut Vec<CatalogGroup>, repos: &[github::GithubRepo]) {
    let mut seen: HashSet<String> = groups
        .iter()
        .flat_map(|group| group.apps.iter().map(|app| repo_identity(&app.repository)))
        .filter(|key| !key.is_empty())
        .collect();
    let mut ordered: Vec<&github::GithubRepo> = repos.iter().collect();
    ordered.sort_by(|left, right| {
        left.account_label
            .to_lowercase()
            .cmp(&right.account_label.to_lowercase())
            .then_with(|| left.full_name.to_lowercase().cmp(&right.full_name.to_lowercase()))
            .then_with(|| left.account_id.cmp(&right.account_id))
    });
    let mut created: Vec<(String, String)> = Vec::new();
    for repo in ordered {
        let key = repo_identity(&repo.full_name);
        if key.is_empty() || !seen.insert(key) {
            continue;
        }
        let label_key = repo.account_label.trim().to_lowercase();
        if let Some((_, name)) = created.iter().find(|(label, _)| label == &label_key) {
            let name = name.clone();
            if let Some(group) = groups.iter_mut().find(|group| group.name == name) {
                group.apps.push(entry_from_repo(repo));
            }
            continue;
        }
        let name = unique_group_name(groups, &repo.account_label);
        created.push((label_key, name.clone()));
        groups.push(CatalogGroup {
            name,
            apps: vec![entry_from_repo(repo)],
        });
    }
}

/// Junta o apps.json do repositório Catálogo com os repositórios das contas GitHub.
/// Uma fonte em falta ou com erro não apaga a outra.
fn assemble_catalog(
    repository: String,
    catalog: Result<(String, Value, bool), String>,
    accounts: Result<github::GithubRepoList, String>,
) -> Result<CatalogPayload, String> {
    let mut warnings = Vec::new();
    let (version, from_cache, mut groups) = match catalog {
        Ok((version, value, from_cache)) => (version, from_cache, catalog_groups(&value)),
        Err(err) => {
            warnings.push(format!("Catálogo: {err}"));
            (String::new(), false, Vec::new())
        }
    };
    groups.retain(|group| !group.apps.is_empty());
    match accounts {
        Ok(list) => {
            warnings.extend(list.warnings);
            append_account_projects(&mut groups, &list.repos);
        }
        Err(err) => warnings.push(err),
    }
    if groups.is_empty() && !warnings.is_empty() {
        return Err(warnings.join(" "));
    }
    Ok(CatalogPayload {
        repository,
        version,
        from_cache,
        groups,
        warnings,
    })
}

fn roots(paths: &AppPaths) -> Result<(PathBuf, PathBuf), String> {
    Ok((paths.org_root()?, paths.workspace_root()?))
}

#[tauri::command]
pub fn launcher_boot(app: AppHandle, paths: State<'_, AppPaths>) -> Result<PublicSettings, String> {
    let (meta, _) = roots(&paths)?;
    store::ensure_root(&meta)?;
    store::cleanup_backups(&meta);
    let settings = store::public_settings(&meta);
    if settings.start_fullscreen {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_fullscreen(true);
        }
    }
    Ok(settings)
}

#[tauri::command]
pub fn library_list(paths: State<'_, AppPaths>) -> Result<LibrarySnapshot, String> {
    let (meta, workspace) = roots(&paths)?;
    store::snapshot(&meta, &workspace)
}

#[tauri::command]
pub async fn library_refresh(paths: State<'_, AppPaths>, force: bool) -> Result<LibrarySnapshot, String> {
    let (meta, workspace) = roots(&paths)?;
    github::refresh_cache(&meta, &workspace, force).await?;
    store::snapshot(&meta, &workspace)
}

fn sync_launchfile_alias(workspace: &std::path::Path, app: &AppEntry) -> Result<(), String> {
    crate::launcher::launchfile::set_name(&store::app_dir(workspace, app), &app.name)
}

#[tauri::command]
pub fn library_save(paths: State<'_, AppPaths>, entry: AppEntry, previous: Option<String>) -> Result<AppEntry, String> {
    let (meta, workspace) = roots(&paths)?;
    let previous_key = previous.clone().unwrap_or_default();
    let previous_name = if previous_key.trim().is_empty() {
        None
    } else {
        store::load_apps(&meta).into_iter().find(|app| {
            app.folder_name.eq_ignore_ascii_case(previous_key.trim())
                || app.repository.eq_ignore_ascii_case(previous_key.trim())
        }).map(|app| app.name)
    };
    let saved = store::upsert_app(&meta, entry, previous)?;
    if previous_name.as_deref().is_some_and(|name| name != saved.name) {
        store::persist_app_alias(&meta, &saved)?;
        sync_launchfile_alias(&workspace, &saved)?;
    }
    Ok(saved)
}

#[tauri::command]
pub fn library_remove(paths: State<'_, AppPaths>, repository: String) -> Result<(), String> {
    let (meta, workspace) = roots(&paths)?;
    let apps = store::load_apps(&meta);
    if let Ok(app) = store::find_app(&apps, &repository) {
        store::halt_app(&meta, &workspace, app);
    }
    store::remove_app(&meta, &repository)
}

#[tauri::command]
pub fn library_import(paths: State<'_, AppPaths>, raw: String) -> Result<usize, String> {
    store::import_apps(&paths.org_root()?, &raw)
}

#[tauri::command]
pub fn library_export(paths: State<'_, AppPaths>) -> Result<String, String> {
    store::export_apps(&paths.org_root()?)
}

#[tauri::command]
pub fn library_validate(paths: State<'_, AppPaths>) -> Result<usize, String> {
    store::validate_apps(&paths.org_root()?)
}

#[tauri::command]
pub fn library_set_sort(paths: State<'_, AppPaths>, sort_by: String) -> Result<LibrarySnapshot, String> {
    let (meta, workspace) = roots(&paths)?;
    store::set_sort(&meta, &sort_by)?;
    store::snapshot(&meta, &workspace)
}

#[tauri::command]
pub fn library_set_filter(paths: State<'_, AppPaths>, installed_only: bool) -> Result<LibrarySnapshot, String> {
    let (meta, workspace) = roots(&paths)?;
    store::set_installed_filter(&meta, &workspace, installed_only)?;
    store::snapshot(&meta, &workspace)
}

#[tauri::command]
pub fn app_hide(paths: State<'_, AppPaths>, repository: String, hidden: bool) -> Result<LibrarySnapshot, String> {
    let (meta, workspace) = roots(&paths)?;
    store::set_manual_hide(&meta, &repository, hidden)?;
    store::snapshot(&meta, &workspace)
}

fn app_view_by_key(snap: LibrarySnapshot, key: &str) -> Result<AppView, String> {
    let key = key.trim();
    snap.apps
        .into_iter()
        .find(|app| {
            app.folder_name.eq_ignore_ascii_case(key) || app.repository.eq_ignore_ascii_case(key)
        })
        .ok_or_else(|| "App não encontrada.".to_string())
}

#[tauri::command]
pub fn app_detail(paths: State<'_, AppPaths>, repository: String) -> Result<AppView, String> {
    let (meta, workspace) = roots(&paths)?;
    let snap = store::snapshot(&meta, &workspace)?;
    app_view_by_key(snap, &repository)
}

#[tauri::command]
pub async fn app_install(
    app: AppHandle,
    paths: State<'_, AppPaths>,
    repository: String,
    asset_name: Option<String>,
    tag: Option<String>,
    confirm_wine: bool,
) -> Result<InstallResult, String> {
    let (meta, workspace) = roots(&paths)?;
    let apps = store::load_apps(&meta);
    let progress_key = store::find_app(&apps, &repository)
        .map(|entry| entry.folder_name.clone())
        .unwrap_or_else(|_| repository.clone());
    install::install(&meta, &workspace, &repository, asset_name, tag, confirm_wine, |percent, phase| {
        emit(&app, &progress_key, percent, phase);
    })
    .await
}

#[tauri::command]
pub async fn app_launch(
    app: AppHandle,
    paths: State<'_, AppPaths>,
    repository: String,
    executable: Option<String>,
    force: Option<bool>,
) -> Result<LaunchResult, String> {
    let (meta, workspace) = roots(&paths)?;
    let apps = store::load_apps(&meta);
    let progress_key = store::find_app(&apps, &repository)
        .map(|entry| entry.folder_name.clone())
        .unwrap_or_else(|_| repository.clone());
    let handle = app.clone();
    let key = progress_key.clone();
    launch::launch(
        &meta,
        &workspace,
        &repository,
        executable,
        force.unwrap_or(false),
        &|percent, phase| emit(&handle, &key, percent, phase),
    )
    .await
}

#[tauri::command]
pub async fn app_generate_launchfile(
    app: AppHandle,
    paths: State<'_, AppPaths>,
    repository: String,
) -> Result<String, String> {
    let (meta, workspace) = roots(&paths)?;
    let apps = store::load_apps(&meta);
    let progress_key = store::find_app(&apps, &repository)
        .map(|entry| entry.folder_name.clone())
        .unwrap_or_else(|_| repository.clone());
    let handle = app.clone();
    let key = progress_key.clone();
    launch::generate_launchfile(&meta, &workspace, &repository, &|percent, phase| {
        emit(&handle, &key, percent, phase);
    })
    .await?;
    Ok("Launchfile gerado com DeepSeek.".into())
}

#[tauri::command]
pub fn app_stop(paths: State<'_, AppPaths>, repository: String) -> Result<StopResult, String> {
    let (meta, workspace) = roots(&paths)?;
    let apps = store::load_apps(&meta);
    let app = store::find_app(&apps, &repository)?.clone();
    let tunnel_stopped = cloudflare::tunnel_is_running(&meta, &app);
    crate::launcher::activity_log::info("stop", &format!("folder={}", app.folder_name));
    match runtime::stop(&meta, &app.folder_name) {
        Ok(()) => {
            // Parar túnel Cloudflare e limpar URL pública com a app.
            if let Ok(info) = store::ensure_launch_info(&workspace, &app) {
                match cloudflare::stop_tunnel(&meta, &workspace, &info, &app) {
                    Ok(_) => crate::launcher::activity_log::info(
                        "cloudflare",
                        &format!("stop com a app folder={}", app.folder_name),
                    ),
                    Err(err) => crate::launcher::activity_log::warn(
                        "cloudflare",
                        &format!("stop com a app falhou folder={}: {err}", app.folder_name),
                    ),
                }
            }
            crate::launcher::activity_log::info("stop", &format!("ok folder={}", app.folder_name));
            Ok(StopResult { tunnel_stopped })
        }
        Err(err) => {
            crate::launcher::activity_log::error("stop", &err, None);
            Err(err)
        }
    }
}

#[tauri::command]
pub fn app_open_folder(paths: State<'_, AppPaths>, repository: String) -> Result<(), String> {
    let (meta, workspace) = roots(&paths)?;
    launch::open_folder(&meta, &workspace, &repository)
}

#[tauri::command]
pub fn app_open_launchfile_dir(paths: State<'_, AppPaths>, repository: String) -> Result<(), String> {
    let (meta, workspace) = roots(&paths)?;
    launch::open_launch_dir(&meta, &workspace, &repository)
}

#[tauri::command]
pub fn app_executables(paths: State<'_, AppPaths>, repository: String) -> Result<Vec<String>, String> {
    let (meta, workspace) = roots(&paths)?;
    launch::executables_for(&meta, &workspace, &repository)
}

#[tauri::command]
pub fn app_set_executable(paths: State<'_, AppPaths>, repository: String, executable: String) -> Result<(), String> {
    let (meta, workspace) = roots(&paths)?;
    launch::set_executable(&meta, &workspace, &repository, &executable)
}

#[tauri::command]
pub fn app_launch_config_get(
    paths: State<'_, AppPaths>,
    repository: String,
) -> Result<LaunchConfigView, String> {
    let (meta, workspace) = roots(&paths)?;
    let apps = store::load_apps(&meta);
    let app = store::find_app(&apps, &repository)?;
    let project = store::install_dir(&workspace, app);
    if !project.is_dir() {
        return Err("Esta app não está instalada.".into());
    }
    let launch_dir = store::active_launch_dir(&meta, &workspace, app)?;
    runners::get_launch_config(&launch_dir)
}

#[tauri::command]
pub fn app_launch_config_save(
    paths: State<'_, AppPaths>,
    repository: String,
    input: LaunchConfigSave,
) -> Result<LaunchConfigView, String> {
    let (meta, workspace) = roots(&paths)?;
    let apps = store::load_apps(&meta);
    let app = store::find_app(&apps, &repository)?;
    let project = store::install_dir(&workspace, app);
    if !project.is_dir() {
        return Err("Esta app não está instalada.".into());
    }
    let launch_dir = store::active_launch_dir(&meta, &workspace, app)?;
    runners::save_launch_config(&launch_dir, input)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectEnvEntry {
    pub key: String,
    pub value: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectEnvFile {
    /// `dotenv` quando existe `.env`, `example` quando só existe `.env.example`, `none` quando nenhum existe.
    pub source: String,
    pub entries: Vec<ProjectEnvEntry>,
}

fn parse_env_file(raw: &str) -> Vec<ProjectEnvEntry> {
    let mut entries = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let trimmed = trimmed.strip_prefix("export ").unwrap_or(trimmed).trim();
        let Some((key, value)) = trimmed.split_once('=') else {
            continue;
        };
        let key = key.trim();
        if key.is_empty() || key.contains(char::is_whitespace) {
            continue;
        }
        let value = value.trim();
        let value = if value.len() >= 2 {
            let quote = value.as_bytes()[0];
            let end = value.as_bytes()[value.len() - 1];
            if (quote == b'"' && end == b'"') || (quote == b'\'' && end == b'\'') {
                value[1..value.len() - 1].to_string()
            } else {
                value.to_string()
            }
        } else {
            value.to_string()
        };
        entries.push(ProjectEnvEntry {
            key: key.to_string(),
            value,
        });
    }
    entries
}

#[tauri::command]
pub fn app_project_env(paths: State<'_, AppPaths>, repository: String) -> Result<ProjectEnvFile, String> {
    let (meta, workspace) = roots(&paths)?;
    let apps = store::load_apps(&meta);
    let app = store::find_app(&apps, &repository)?;
    let project = store::install_dir(&workspace, app);
    if !project.is_dir() {
        return Err("Esta app não está instalada.".into());
    }
    let dotenv = project.join(".env");
    if dotenv.is_file() {
        let raw = fs::read_to_string(&dotenv).map_err(|err| err.to_string())?;
        return Ok(ProjectEnvFile {
            source: "dotenv".into(),
            entries: parse_env_file(&raw),
        });
    }
    let example = project.join(".env.example");
    if example.is_file() {
        let raw = fs::read_to_string(&example).map_err(|err| err.to_string())?;
        return Ok(ProjectEnvFile {
            source: "example".into(),
            entries: parse_env_file(&raw),
        });
    }
    Ok(ProjectEnvFile {
        source: "none".into(),
        entries: Vec::new(),
    })
}

fn cloudflare_paths_full(
    paths: &AppPaths,
    repository: &str,
) -> Result<(PathBuf, PathBuf, PathBuf, AppEntry), String> {
    let (meta, workspace) = roots(paths)?;
    let apps = store::load_apps(&meta);
    let app = store::find_app(&apps, repository)?.clone();
    let info = store::ensure_launch_info(&workspace, &app)?;
    Ok((meta, workspace, info, app))
}

#[tauri::command]
pub fn app_cloudflare_get(paths: State<'_, AppPaths>, repository: String) -> Result<CloudflareView, String> {
    let (meta, workspace, info, app) = cloudflare_paths_full(&paths, &repository)?;
    Ok(cloudflare::view(&meta, &workspace, &info, &app))
}

#[tauri::command]
pub fn app_cloudflare_save(
    paths: State<'_, AppPaths>,
    repository: String,
    input: CloudflareSaveInput,
) -> Result<CloudflareView, String> {
    let (meta, workspace, info, app) = cloudflare_paths_full(&paths, &repository)?;
    cloudflare::save_config(&meta, &workspace, &info, &app, input)?;
    Ok(cloudflare::view(&meta, &workspace, &info, &app))
}

#[tauri::command]
pub async fn app_cloudflare_start(
    paths: State<'_, AppPaths>,
    repository: String,
) -> Result<CloudflareView, String> {
    let (meta, workspace, info, app) = cloudflare_paths_full(&paths, &repository)?;
    cloudflare::start(&meta, &workspace, &info, &app).await
}

#[tauri::command]
pub fn app_cloudflare_stop(paths: State<'_, AppPaths>, repository: String) -> Result<CloudflareView, String> {
    let (meta, workspace, info, app) = cloudflare_paths_full(&paths, &repository)?;
    cloudflare::stop_tunnel(&meta, &workspace, &info, &app)
}

#[tauri::command]
pub fn app_cloudflare_status(paths: State<'_, AppPaths>, repository: String) -> Result<CloudflareView, String> {
    let (meta, workspace, info, app) = cloudflare_paths_full(&paths, &repository)?;
    Ok(cloudflare::view(&meta, &workspace, &info, &app))
}

#[tauri::command]
pub async fn app_cloudflare_zones(paths: State<'_, AppPaths>) -> Result<CloudflareZoneList, String> {
    let meta = paths.org_root()?;
    cloudflare::list_zones(&meta).await
}

#[tauri::command]
pub async fn github_repos(paths: State<'_, AppPaths>) -> Result<crate::launcher::github::GithubRepoList, String> {
    let meta = paths.org_root()?;
    crate::launcher::github::list_account_repos(&meta).await
}

#[tauri::command]
pub fn app_skip_update(paths: State<'_, AppPaths>, repository: String, version: Option<String>) -> Result<AppView, String> {
    let (meta, workspace) = roots(&paths)?;
    let apps = store::load_apps(&meta);
    let app = store::find_app(&apps, &repository)?;
    store::set_skipped(&meta, &app.repository, version)?;
    let snap = store::snapshot(&meta, &workspace)?;
    app_view_by_key(snap, &app.folder_name)
}

#[tauri::command]
pub fn app_delete_install(paths: State<'_, AppPaths>, repository: String) -> Result<(), String> {
    let (meta, workspace) = roots(&paths)?;
    store::delete_install(&meta, &workspace, &repository)
}

#[tauri::command]
pub fn app_locate(paths: State<'_, AppPaths>, repository: String, path: String) -> Result<(), String> {
    store::locate_install(&paths.org_root()?, &repository, &path)
}

#[tauri::command]
pub fn app_set_icon(paths: State<'_, AppPaths>, repository: String, path: String) -> Result<String, String> {
    install::remember_icon(
        &paths.org_root()?,
        &paths.workspace_root()?,
        &repository,
        std::path::Path::new(&path),
    )
}

#[tauri::command]
pub fn app_clear_icon(paths: State<'_, AppPaths>, repository: String) -> Result<(), String> {
    install::clear_icon(&paths.org_root()?, &paths.workspace_root()?, &repository)
}

#[tauri::command]
pub async fn app_releases(paths: State<'_, AppPaths>, repository: String) -> Result<Vec<Value>, String> {
    let meta = paths.org_root()?;
    let apps = store::load_apps(&meta);
    let app = store::find_app(&apps, &repository)?;
    github::list_releases(&meta, &app.repository).await
}

#[tauri::command]
pub async fn app_branches(paths: State<'_, AppPaths>, repository: String) -> Result<Vec<String>, String> {
    let meta = paths.org_root()?;
    let apps = store::load_apps(&meta);
    let app = store::find_app(&apps, &repository)?;
    github::list_branches(&meta, &app.repository).await
}

#[tauri::command]
pub async fn app_set_branch(
    app: AppHandle,
    paths: State<'_, AppPaths>,
    repository: String,
    branch: String,
) -> Result<AppView, String> {
    let (meta, workspace) = roots(&paths)?;
    let apps = store::load_apps(&meta);
    let entry = store::find_app(&apps, &repository)?.clone();
    let dir = store::install_dir(&workspace, &entry);
    if !dir.join(".git").is_dir() {
        return Err("Esta instalação não é um clone git.".into());
    }
    let progress_key = entry.folder_name.clone();
    if runtime::is_running(&meta, &entry.folder_name) {
        runtime::stop(&meta, &entry.folder_name)?;
        store::halt_app(&meta, &workspace, &entry);
    }
    emit(&app, &progress_key, 4, "A mudar de branch…");
    install::checkout_branch(&dir, &branch)?;
    runtime::set_selected_branch(&meta, &entry.folder_name, &branch)?;
    let info = store::ensure_launch_info(&workspace, &entry)?;
    let launch_dir = store::branch_launch_dir(&info, &branch);
    if !crate::launcher::launchfile::exists(&launch_dir) {
        let handle = app.clone();
        let key = progress_key.clone();
        launch::generate_launchfile(&meta, &workspace, &repository, &|percent, phase| {
            emit(&handle, &key, percent.max(8), phase);
        })
        .await?;
    }
    let snap = store::snapshot(&meta, &workspace)?;
    app_view_by_key(snap, &entry.folder_name)
}

#[tauri::command]
pub fn app_changelog(paths: State<'_, AppPaths>, repository: String) -> Result<String, String> {
    let meta = paths.org_root()?;
    let apps = store::load_apps(&meta);
    let app = store::find_app(&apps, &repository)?;
    let cache = store::load_version_cache(&meta);
    Ok(cache
        .get(&app.repository)
        .and_then(|item| item.get("body"))
        .and_then(|item| item.as_str())
        .unwrap_or("")
        .to_string())
}

#[tauri::command]
pub fn app_shortcut_desktop(paths: State<'_, AppPaths>, repository: String) -> Result<String, String> {
    let org_id = paths.active_org_id()?;
    launch::desktop_shortcut(&paths.org_root()?, &repository, &org_id)
}

#[tauri::command]
pub fn app_shortcut_steam(paths: State<'_, AppPaths>, repository: String) -> Result<String, String> {
    let org_id = paths.active_org_id()?;
    launch::steam_shortcut(&paths.org_root()?, &repository, &org_id)
}

#[tauri::command]
pub fn settings_get(paths: State<'_, AppPaths>) -> Result<PublicSettings, String> {
    Ok(store::public_settings(&paths.org_root()?))
}

#[tauri::command]
pub fn settings_save(paths: State<'_, AppPaths>, input: SettingsInput) -> Result<PublicSettings, String> {
    store::apply_settings(&paths.org_root()?, input)
}

#[tauri::command]
pub fn communications_get(paths: State<'_, AppPaths>) -> Result<CommunicationsGraph, String> {
    store::load_communications(&paths.org_root()?)
}

#[tauri::command]
pub fn communications_save(
    paths: State<'_, AppPaths>,
    graph: CommunicationsGraph,
) -> Result<CommunicationsGraph, String> {
    store::save_communications(&paths.org_root()?, graph)
}

#[tauri::command]
pub fn communications_open_dir(paths: State<'_, AppPaths>) -> Result<(), String> {
    let root = paths.org_root()?;
    store::ensure_root(&root)?;
    launch::reveal_dir(&root)
}

/// Abre o explorador com os arquivos selecionados. Vários caminhos no mesmo texto vão separados por quebra de linha.
#[tauri::command]
pub fn reveal_files(paths: Vec<String>) -> Result<(), String> {
    launch::reveal_files(&paths)
}

/// Porta livre, ou quem a ocupa: app do Painel em execução e processo à escuta.
#[tauri::command]
pub fn port_check(paths: State<'_, AppPaths>, port: u16) -> Result<runtime::PortOccupancy, String> {
    if port == 0 {
        return Err("Porta inválida.".into());
    }
    let (meta, workspace) = roots(&paths)?;
    Ok(runtime::inspect_port(&meta, &workspace, port))
}

#[tauri::command]
pub async fn catalog_load(paths: State<'_, AppPaths>) -> Result<CatalogPayload, String> {
    let meta = paths.org_root()?;
    let repository = store::public_settings(&meta).app_list_repository;
    let accounts_configured = !store::github_accounts(&meta).is_empty();
    let catalog = github::fetch_catalog(&meta).await;
    let accounts = if accounts_configured {
        github::list_account_repos(&meta).await
    } else {
        Ok(github::GithubRepoList {
            repos: Vec::new(),
            warnings: Vec::new(),
        })
    };
    assemble_catalog(repository, catalog, accounts)
}

#[tauri::command]
pub fn catalog_add(paths: State<'_, AppPaths>, entry: AppEntry) -> Result<AppEntry, String> {
    store::upsert_app(&paths.org_root()?, entry, None)
}

#[tauri::command]
pub async fn launcher_check_update(
    paths: State<'_, AppPaths>,
    force: bool,
    repository: Option<String>,
) -> Result<UpdateStatus, String> {
    self_update::check(&paths.org_root()?, force, repository.as_deref()).await
}

#[tauri::command]
pub async fn launcher_apply_update(
    app: AppHandle,
    paths: State<'_, AppPaths>,
    repository: Option<String>,
) -> Result<String, String> {
    let message = self_update::apply(&paths.org_root()?, repository.as_deref()).await?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
    Ok(message)
}

#[tauri::command]
pub fn log_write(
    level: String,
    source: String,
    message: String,
    detail: Option<String>,
) -> Result<(), String> {
    crate::launcher::activity_log::write_from_ui(level, source, message, detail)
}

#[tauri::command]
pub fn log_path() -> Result<String, String> {
    crate::launcher::activity_log::path_string()
}

#[tauri::command]
pub fn log_open_folder() -> Result<String, String> {
    crate::launcher::activity_log::open_folder()
}

#[tauri::command]
pub fn window_close(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Janela em falta.".to_string())?
        .close()
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn get_data_location() -> Result<DataLocation, String> {
    let default = store::user_data_dir();
    let current = store::resolve_apps_root();
    Ok(DataLocation {
        custom_configured: store::read_bootstrap_apps_root().is_some(),
        current: current.display().to_string(),
        default: default.display().to_string(),
    })
}

#[tauri::command]
pub fn set_data_location(
    paths: State<'_, AppPaths>,
    path: String,
) -> Result<SetDataLocationResult, String> {
    let trimmed = path.trim();
    let current = if trimmed.is_empty() {
        store::write_bootstrap_apps_root(None)?;
        store::resolve_apps_root()
    } else {
        let dest = PathBuf::from(trimmed);
        let active = paths.apps_root().unwrap_or_else(|_| store::resolve_apps_root());
        // Nova pasta (ou diferente da actual) tem de estar vazia.
        if !store::same_path(&dest, &active) {
            store::require_empty_apps_dir(&dest)?;
        }
        std::fs::create_dir_all(&dest).map_err(|err| err.to_string())?;
        // Só pasta de clones — conta/orgs ficam sempre em AppData.
        store::write_bootstrap_apps_root(Some(trimmed))?;
        dest
    };
    paths.set_apps_root(current.clone())?;
    Ok(SetDataLocationResult {
        current: current.display().to_string(),
        restart_required: false,
    })
}

#[cfg(test)]
mod tests {
    use super::{assemble_catalog, repo_identity};
    use crate::launcher::github::{GithubRepo, GithubRepoList};
    use serde_json::json;

    fn repo(account_id: &str, label: &str, name: &str, full_name: &str) -> GithubRepo {
        GithubRepo {
            account_id: account_id.into(),
            account_label: label.into(),
            name: name.into(),
            full_name: full_name.into(),
            avatar_url: String::new(),
        }
    }

    fn names(payload: &super::CatalogPayload) -> Vec<String> {
        payload
            .groups
            .iter()
            .flat_map(|group| group.apps.iter().map(|app| format!("{}:{}", group.name, app.repository)))
            .collect()
    }

    #[test]
    fn repo_identity_ignores_case_and_git_suffix() {
        assert_eq!(repo_identity(" Acme/Shared.git "), "acme/shared");
        assert_eq!(repo_identity("acme/shared"), repo_identity("ACME/Shared"));
    }

    #[test]
    fn catalog_projects_stay_first_and_duplicates_drop() {
        let catalog = Ok((
            "v9".into(),
            json!({
                "standard": [
                    {"name": "Alpha", "repository": "acme/alpha"},
                    {"name": "Shared", "repository": "acme/shared"}
                ]
            }),
            true,
        ));
        let accounts = Ok(GithubRepoList {
            repos: vec![
                repo("b", "Beta", "zeta", "acme/zeta"),
                repo("a", "Alpha", "shared", "Acme/Shared.git"),
                repo("a", "Alpha", "other", "acme/other"),
            ],
            warnings: vec![],
        });
        let payload = assemble_catalog("acme/catalog".into(), catalog, accounts).unwrap();
        assert_eq!(payload.version, "v9");
        assert!(payload.from_cache);
        assert!(payload.warnings.is_empty());
        assert_eq!(
            names(&payload),
            vec![
                "standard:acme/alpha".to_string(),
                "standard:acme/shared".to_string(),
                "Alpha:acme/other".to_string(),
                "Beta:acme/zeta".to_string(),
            ]
        );
    }

    #[test]
    fn same_repo_from_two_accounts_is_kept_once() {
        let catalog = Ok(("".into(), json!({}), false));
        let accounts = Ok(GithubRepoList {
            repos: vec![
                repo("2", "Zeta", "app", "acme/app"),
                repo("1", "Alpha", "app", "acme/app"),
            ],
            warnings: vec![],
        });
        let payload = assemble_catalog("acme/catalog".into(), catalog, accounts).unwrap();
        assert_eq!(names(&payload), vec!["Alpha:acme/app".to_string()]);
    }

    #[test]
    fn catalog_failure_keeps_account_projects() {
        let accounts = Ok(GithubRepoList {
            repos: vec![repo("1", "Conta", "app", "acme/app")],
            warnings: vec!["Outra: O GitHub recusou o token.".into()],
        });
        let payload = assemble_catalog(
            "acme/catalog".into(),
            Err("O GitHub não encontrou esse repositório ou essa release.".into()),
            accounts,
        )
        .unwrap();
        assert_eq!(names(&payload), vec!["Conta:acme/app".to_string()]);
        assert_eq!(payload.version, "");
        assert_eq!(
            payload.warnings,
            vec![
                "Catálogo: O GitHub não encontrou esse repositório ou essa release.".to_string(),
                "Outra: O GitHub recusou o token.".to_string(),
            ]
        );
    }

    #[test]
    fn account_failure_keeps_catalog_projects() {
        let catalog = Ok((
            "v1".into(),
            json!({"apps": [{"name": "Alpha", "repository": "acme/alpha"}]}),
            false,
        ));
        let payload = assemble_catalog(
            "acme/catalog".into(),
            catalog,
            Err("O GitHub limitou os pedidos anónimos.".into()),
        )
        .unwrap();
        assert_eq!(names(&payload), vec!["apps:acme/alpha".to_string()]);
        assert_eq!(payload.warnings, vec!["O GitHub limitou os pedidos anónimos.".to_string()]);
    }

    #[test]
    fn both_sources_failing_returns_both_errors() {
        let err = match assemble_catalog(
            "acme/catalog".into(),
            Err("O catálogo não tem release.".into()),
            Err("O GitHub recusou o token.".into()),
        ) {
            Err(err) => err,
            Ok(_) => panic!("as duas fontes falharam"),
        };
        assert!(err.contains("Catálogo: O catálogo não tem release."));
        assert!(err.contains("O GitHub recusou o token."));
    }

    #[test]
    fn missing_account_still_returns_catalog() {
        let catalog = Ok((
            "v1".into(),
            json!({"standard": [{"name": "Alpha", "repository": "acme/alpha"}]}),
            false,
        ));
        let accounts = Ok(GithubRepoList {
            repos: vec![],
            warnings: vec![],
        });
        let payload = assemble_catalog("acme/catalog".into(), catalog, accounts).unwrap();
        assert!(payload.warnings.is_empty());
        assert_eq!(names(&payload), vec!["standard:acme/alpha".to_string()]);
    }
}
