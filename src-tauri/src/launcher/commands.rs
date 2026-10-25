use crate::launcher::install::{self, InstallResult};
use crate::launcher::launch::{self, LaunchResult};
use crate::launcher::self_update::{self, UpdateStatus};
use crate::launcher::store::{self, AppEntry, AppView, LibrarySnapshot, PublicSettings, SettingsInput};
use crate::launcher::{github, LauncherState};
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
                if apps.is_empty() { None } else { Some(CatalogGroup { name: name.clone(), apps }) }
            })
            .collect();
        if !groups.is_empty() {
            return groups;
        }
    }
    vec![CatalogGroup { name: "Apps".into(), apps: store::parse_apps_value(value) }]
}

#[tauri::command]
pub fn launcher_boot(app: AppHandle, state: State<'_, LauncherState>) -> Result<PublicSettings, String> {
    store::ensure_root(&state.root)?;
    store::cleanup_backups(&state.root);
    let settings = store::public_settings(&state.root);
    if settings.start_fullscreen {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_fullscreen(true);
        }
    }
    Ok(settings)
}

#[tauri::command]
pub fn library_list(state: State<'_, LauncherState>) -> Result<LibrarySnapshot, String> {
    store::snapshot(&state.root)
}

#[tauri::command]
pub async fn library_refresh(state: State<'_, LauncherState>, force: bool) -> Result<LibrarySnapshot, String> {
    let root = state.root.clone();
    github::refresh_cache(&root, force).await?;
    store::snapshot(&root)
}

#[tauri::command]
pub fn library_save(state: State<'_, LauncherState>, entry: AppEntry, previous: Option<String>) -> Result<AppEntry, String> {
    store::upsert_app(&state.root, entry, previous)
}

#[tauri::command]
pub fn library_remove(state: State<'_, LauncherState>, repository: String) -> Result<(), String> {
    store::remove_app(&state.root, &repository)
}

#[tauri::command]
pub fn library_import(state: State<'_, LauncherState>, raw: String) -> Result<usize, String> {
    store::import_apps(&state.root, &raw)
}

#[tauri::command]
pub fn library_export(state: State<'_, LauncherState>) -> Result<String, String> {
    store::export_apps(&state.root)
}

#[tauri::command]
pub fn library_validate(state: State<'_, LauncherState>) -> Result<usize, String> {
    store::validate_apps(&state.root)
}

#[tauri::command]
pub fn library_set_sort(state: State<'_, LauncherState>, sort_by: String) -> Result<LibrarySnapshot, String> {
    store::set_sort(&state.root, &sort_by)?;
    store::snapshot(&state.root)
}

#[tauri::command]
pub fn library_set_filter(state: State<'_, LauncherState>, installed_only: bool) -> Result<LibrarySnapshot, String> {
    store::set_installed_filter(&state.root, installed_only)?;
    store::snapshot(&state.root)
}

#[tauri::command]
pub fn app_hide(state: State<'_, LauncherState>, repository: String, hidden: bool) -> Result<LibrarySnapshot, String> {
    store::set_manual_hide(&state.root, &repository, hidden)?;
    store::snapshot(&state.root)
}

#[tauri::command]
pub fn app_detail(state: State<'_, LauncherState>, repository: String) -> Result<AppView, String> {
    let snap = store::snapshot(&state.root)?;
    snap.apps.into_iter().find(|app| app.repository.eq_ignore_ascii_case(&repository)).ok_or_else(|| "App não encontrada.".to_string())
}

#[tauri::command]
pub async fn app_install(
    app: AppHandle,
    state: State<'_, LauncherState>,
    repository: String,
    asset_name: Option<String>,
    tag: Option<String>,
    confirm_wine: bool,
) -> Result<InstallResult, String> {
    let root = state.root.clone();
    let id = repository.clone();
    install::install(&root, &repository, asset_name, tag, confirm_wine, |percent, phase| {
        emit(&app, &id, percent, phase);
    })
    .await
}

#[tauri::command]
pub fn app_launch(state: State<'_, LauncherState>, repository: String, executable: Option<String>) -> Result<LaunchResult, String> {
    launch::launch(&state.root, &repository, executable)
}

#[tauri::command]
pub fn app_open_folder(state: State<'_, LauncherState>, repository: String) -> Result<(), String> {
    launch::open_folder(&state.root, &repository)
}

#[tauri::command]
pub fn app_executables(state: State<'_, LauncherState>, repository: String) -> Result<Vec<String>, String> {
    launch::executables_for(&state.root, &repository)
}

#[tauri::command]
pub fn app_set_executable(state: State<'_, LauncherState>, repository: String, executable: String) -> Result<(), String> {
    launch::set_executable(&state.root, &repository, &executable)
}

#[tauri::command]
pub fn app_skip_update(state: State<'_, LauncherState>, repository: String, version: Option<String>) -> Result<AppView, String> {
    store::set_skipped(&state.root, &repository, version)?;
    app_detail(state, repository)
}

#[tauri::command]
pub fn app_delete_install(state: State<'_, LauncherState>, repository: String) -> Result<(), String> {
    store::delete_install(&state.root, &repository)
}

#[tauri::command]
pub fn app_locate(state: State<'_, LauncherState>, repository: String, path: String) -> Result<(), String> {
    store::locate_install(&state.root, &repository, &path)
}

#[tauri::command]
pub fn app_set_icon(state: State<'_, LauncherState>, repository: String, path: String) -> Result<String, String> {
    install::remember_icon(&state.root, &repository, std::path::Path::new(&path))
}

#[tauri::command]
pub fn app_clear_icon(state: State<'_, LauncherState>, repository: String) -> Result<(), String> {
    install::clear_icon(&state.root, &repository)
}

#[tauri::command]
pub async fn app_releases(state: State<'_, LauncherState>, repository: String) -> Result<Vec<Value>, String> {
    github::list_releases(&state.root, &repository).await
}

#[tauri::command]
pub fn app_changelog(state: State<'_, LauncherState>, repository: String) -> Result<String, String> {
    let cache = store::load_version_cache(&state.root);
    Ok(cache
        .get(&repository)
        .and_then(|item| item.get("body"))
        .and_then(|item| item.as_str())
        .unwrap_or("")
        .to_string())
}

#[tauri::command]
pub fn app_shortcut_desktop(state: State<'_, LauncherState>, repository: String) -> Result<String, String> {
    launch::desktop_shortcut(&state.root, &repository)
}

#[tauri::command]
pub fn app_shortcut_steam(state: State<'_, LauncherState>, repository: String) -> Result<String, String> {
    launch::steam_shortcut(&state.root, &repository)
}

#[tauri::command]
pub fn settings_get(state: State<'_, LauncherState>) -> Result<PublicSettings, String> {
    Ok(store::public_settings(&state.root))
}

#[tauri::command]
pub fn settings_save(state: State<'_, LauncherState>, input: SettingsInput) -> Result<PublicSettings, String> {
    store::apply_settings(&state.root, input)
}

#[tauri::command]
pub async fn catalog_load(state: State<'_, LauncherState>) -> Result<CatalogPayload, String> {
    let settings = store::public_settings(&state.root);
    let (version, value, from_cache) = github::fetch_catalog(&state.root).await?;
    Ok(CatalogPayload {
        repository: settings.app_list_repository,
        version,
        from_cache,
        groups: catalog_groups(&value),
    })
}

#[tauri::command]
pub fn catalog_add(state: State<'_, LauncherState>, entry: AppEntry) -> Result<AppEntry, String> {
    store::upsert_app(&state.root, entry, None)
}

#[tauri::command]
pub async fn launcher_check_update(state: State<'_, LauncherState>, force: bool) -> Result<UpdateStatus, String> {
    self_update::check(&state.root, force).await
}

#[tauri::command]
pub async fn launcher_apply_update(app: AppHandle, state: State<'_, LauncherState>) -> Result<String, String> {
    let message = self_update::apply(&state.root).await?;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
    Ok(message)
}

#[tauri::command]
pub fn window_close(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("main").ok_or_else(|| "Janela em falta.".to_string())?.close().map_err(|err| err.to_string())
}
