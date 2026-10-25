use crate::launcher::install::{self, InstallResult};
use crate::launcher::launch::{self, LaunchResult};
use crate::launcher::runtime;
use crate::launcher::self_update::{self, UpdateStatus};
use crate::launcher::store::{self, AppEntry, AppView, LibrarySnapshot, PublicSettings, SettingsInput};
use crate::launcher::github;
use crate::session::AppPaths;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};

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

fn root(paths: &AppPaths) -> Result<std::path::PathBuf, String> {
    paths.org_root()
}

#[tauri::command]
pub fn launcher_boot(app: AppHandle, paths: State<'_, AppPaths>) -> Result<PublicSettings, String> {
    let root = root(&paths)?;
    store::ensure_root(&root)?;
    store::cleanup_backups(&root);
    let settings = store::public_settings(&root);
    if settings.start_fullscreen {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_fullscreen(true);
        }
    }
    Ok(settings)
}

#[tauri::command]
pub fn library_list(paths: State<'_, AppPaths>) -> Result<LibrarySnapshot, String> {
    store::snapshot(&root(&paths)?)
}

#[tauri::command]
pub async fn library_refresh(paths: State<'_, AppPaths>, force: bool) -> Result<LibrarySnapshot, String> {
    let root = root(&paths)?;
    github::refresh_cache(&root, force).await?;
    store::snapshot(&root)
}

#[tauri::command]
pub fn library_save(paths: State<'_, AppPaths>, entry: AppEntry, previous: Option<String>) -> Result<AppEntry, String> {
    store::upsert_app(&root(&paths)?, entry, previous)
}

#[tauri::command]
pub fn library_remove(paths: State<'_, AppPaths>, repository: String) -> Result<(), String> {
    store::remove_app(&root(&paths)?, &repository)
}

#[tauri::command]
pub fn library_import(paths: State<'_, AppPaths>, raw: String) -> Result<usize, String> {
    store::import_apps(&root(&paths)?, &raw)
}

#[tauri::command]
pub fn library_export(paths: State<'_, AppPaths>) -> Result<String, String> {
    store::export_apps(&root(&paths)?)
}

#[tauri::command]
pub fn library_validate(paths: State<'_, AppPaths>) -> Result<usize, String> {
    store::validate_apps(&root(&paths)?)
}

#[tauri::command]
pub fn library_set_sort(paths: State<'_, AppPaths>, sort_by: String) -> Result<LibrarySnapshot, String> {
    let root = root(&paths)?;
    store::set_sort(&root, &sort_by)?;
    store::snapshot(&root)
}

#[tauri::command]
pub fn library_set_filter(paths: State<'_, AppPaths>, installed_only: bool) -> Result<LibrarySnapshot, String> {
    let root = root(&paths)?;
    store::set_installed_filter(&root, installed_only)?;
    store::snapshot(&root)
}

#[tauri::command]
pub fn app_hide(paths: State<'_, AppPaths>, repository: String, hidden: bool) -> Result<LibrarySnapshot, String> {
    let root = root(&paths)?;
    store::set_manual_hide(&root, &repository, hidden)?;
    store::snapshot(&root)
}

#[tauri::command]
pub fn app_detail(paths: State<'_, AppPaths>, repository: String) -> Result<AppView, String> {
    let snap = store::snapshot(&root(&paths)?)?;
    snap.apps
        .into_iter()
        .find(|app| app.repository.eq_ignore_ascii_case(&repository))
        .ok_or_else(|| "App não encontrada.".to_string())
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
    let root = root(&paths)?;
    let id = repository.clone();
    install::install(&root, &repository, asset_name, tag, confirm_wine, |percent, phase| {
        emit(&app, &id, percent, phase);
    })
    .await
}

#[tauri::command]
pub fn app_launch(paths: State<'_, AppPaths>, repository: String, executable: Option<String>) -> Result<LaunchResult, String> {
    launch::launch(&root(&paths)?, &repository, executable)
}

#[tauri::command]
pub fn app_stop(paths: State<'_, AppPaths>, repository: String) -> Result<(), String> {
    runtime::stop(&root(&paths)?, &repository)
}

#[tauri::command]
pub fn app_open_folder(paths: State<'_, AppPaths>, repository: String) -> Result<(), String> {
    launch::open_folder(&root(&paths)?, &repository)
}

#[tauri::command]
pub fn app_executables(paths: State<'_, AppPaths>, repository: String) -> Result<Vec<String>, String> {
    launch::executables_for(&root(&paths)?, &repository)
}

#[tauri::command]
pub fn app_set_executable(paths: State<'_, AppPaths>, repository: String, executable: String) -> Result<(), String> {
    launch::set_executable(&root(&paths)?, &repository, &executable)
}

#[tauri::command]
pub fn app_skip_update(paths: State<'_, AppPaths>, repository: String, version: Option<String>) -> Result<AppView, String> {
    let root = root(&paths)?;
    store::set_skipped(&root, &repository, version)?;
    let snap = store::snapshot(&root)?;
    snap.apps
        .into_iter()
        .find(|app| app.repository.eq_ignore_ascii_case(&repository))
        .ok_or_else(|| "App não encontrada.".to_string())
}

#[tauri::command]
pub fn app_delete_install(paths: State<'_, AppPaths>, repository: String) -> Result<(), String> {
    store::delete_install(&root(&paths)?, &repository)
}

#[tauri::command]
pub fn app_locate(paths: State<'_, AppPaths>, repository: String, path: String) -> Result<(), String> {
    store::locate_install(&root(&paths)?, &repository, &path)
}

#[tauri::command]
pub fn app_set_icon(paths: State<'_, AppPaths>, repository: String, path: String) -> Result<String, String> {
    install::remember_icon(&root(&paths)?, &repository, std::path::Path::new(&path))
}

#[tauri::command]
pub fn app_clear_icon(paths: State<'_, AppPaths>, repository: String) -> Result<(), String> {
    install::clear_icon(&root(&paths)?, &repository)
}

#[tauri::command]
pub async fn app_releases(paths: State<'_, AppPaths>, repository: String) -> Result<Vec<Value>, String> {
    github::list_releases(&root(&paths)?, &repository).await
}

#[tauri::command]
pub async fn app_branches(paths: State<'_, AppPaths>, repository: String) -> Result<Vec<String>, String> {
    github::list_branches(&root(&paths)?, &repository).await
}

#[tauri::command]
pub fn app_set_branch(paths: State<'_, AppPaths>, repository: String, branch: String) -> Result<AppView, String> {
    let root = root(&paths)?;
    runtime::set_selected_branch(&root, &repository, &branch)?;
    let snap = store::snapshot(&root)?;
    snap.apps
        .into_iter()
        .find(|app| app.repository.eq_ignore_ascii_case(&repository))
        .ok_or_else(|| "App não encontrada.".to_string())
}

#[tauri::command]
pub fn app_changelog(paths: State<'_, AppPaths>, repository: String) -> Result<String, String> {
    let cache = store::load_version_cache(&root(&paths)?);
    Ok(cache
        .get(&repository)
        .and_then(|item| item.get("body"))
        .and_then(|item| item.as_str())
        .unwrap_or("")
        .to_string())
}

#[tauri::command]
pub fn app_shortcut_desktop(paths: State<'_, AppPaths>, repository: String) -> Result<String, String> {
    launch::desktop_shortcut(&root(&paths)?, &repository)
}

#[tauri::command]
pub fn app_shortcut_steam(paths: State<'_, AppPaths>, repository: String) -> Result<String, String> {
    launch::steam_shortcut(&root(&paths)?, &repository)
}

#[tauri::command]
pub fn settings_get(paths: State<'_, AppPaths>) -> Result<PublicSettings, String> {
    Ok(store::public_settings(&root(&paths)?))
}

#[tauri::command]
pub fn settings_save(paths: State<'_, AppPaths>, input: SettingsInput) -> Result<PublicSettings, String> {
    store::apply_settings(&root(&paths)?, input)
}

#[tauri::command]
pub async fn catalog_load(paths: State<'_, AppPaths>) -> Result<CatalogPayload, String> {
    let root = root(&paths)?;
    let settings = store::public_settings(&root);
    let (version, value, from_cache) = github::fetch_catalog(&root).await?;
    Ok(CatalogPayload {
        repository: settings.app_list_repository,
        version,
        from_cache,
        groups: catalog_groups(&value),
    })
}

#[tauri::command]
pub fn catalog_add(paths: State<'_, AppPaths>, entry: AppEntry) -> Result<AppEntry, String> {
    store::upsert_app(&root(&paths)?, entry, None)
}

#[tauri::command]
pub async fn launcher_check_update(paths: State<'_, AppPaths>, force: bool) -> Result<UpdateStatus, String> {
    self_update::check(&root(&paths)?, force).await
}

#[tauri::command]
pub async fn launcher_apply_update(app: AppHandle, paths: State<'_, AppPaths>) -> Result<String, String> {
    let message = self_update::apply(&root(&paths)?).await?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
    Ok(message)
}

#[tauri::command]
pub fn window_close(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Janela em falta.".to_string())?
        .close()
        .map_err(|err| err.to_string())
}
