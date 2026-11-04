use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, State, WindowEvent};
mod launcher;
mod orgs;
mod session;
pub use launcher::{cli_requested, run_cli};
use orgs::{PublicInvite, PublicMember, PublicOrg};
use session::AppPaths;

fn restore_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

const SESSION_SECONDS: i64 = 60 * 60 * 24 * 30;
const RESET_SECONDS: i64 = 60 * 15;

#[derive(Default, Serialize, Deserialize)]
struct AuthDb {
    users: Vec<UserRecord>,
    sessions: Vec<SessionRecord>,
}

#[derive(Clone, Serialize, Deserialize)]
struct UserRecord {
    id: String,
    name: String,
    email: String,
    password_hash: String,
    #[serde(default)]
    active_org_id: Option<String>,
    #[serde(default)]
    reset_code: Option<String>,
    #[serde(default)]
    reset_expires: Option<i64>,
}

#[derive(Clone, Serialize, Deserialize)]
struct SessionRecord {
    token: String,
    user_id: String,
    expires: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicUser {
    uid: String,
    email: String,
    display_name: String,
    photo_url: Option<String>,
    active_org_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthSession {
    token: String,
    user: PublicUser,
    active_org: Option<PublicOrg>,
}

#[derive(Serialize)]
struct ResetIssued {
    code: Option<String>,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn random_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

pub fn random_token_public() -> String {
    random_token()
}

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| "Não foi possível guardar a senha.".to_string())
}

fn verify_password(password: &str, encoded: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(encoded) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn load_db(path: &PathBuf) -> AuthDb {
    let Ok(raw) = fs::read_to_string(path) else {
        return AuthDb::default();
    };
    serde_json::from_str(raw.trim_start_matches('\u{feff}')).unwrap_or_default()
}

fn save_db(path: &PathBuf, db: &AuthDb) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let raw = serde_json::to_string_pretty(db).map_err(|err| err.to_string())?;
    fs::write(path, raw).map_err(|err| err.to_string())
}

fn public_user(user: &UserRecord) -> PublicUser {
    PublicUser {
        uid: user.id.clone(),
        email: user.email.clone(),
        display_name: user.name.clone(),
        photo_url: None,
        active_org_id: user.active_org_id.clone(),
    }
}

fn issue_session(db: &mut AuthDb, user_id: &str) -> String {
    let token = random_token();
    db.sessions.push(SessionRecord {
        token: token.clone(),
        user_id: user_id.to_string(),
        expires: now_secs() + SESSION_SECONDS,
    });
    token
}

fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 6 {
        return Err("A senha deve ter pelo menos 6 caracteres.".into());
    }
    Ok(())
}

fn user_id_from_token(paths: &AppPaths, token: &str) -> Result<String, String> {
    let mut db = load_db(&paths.auth_path);
    let now = now_secs();
    db.sessions.retain(|session| session.expires > now);
    let user_id = db
        .sessions
        .iter()
        .find(|session| session.token == token)
        .map(|session| session.user_id.clone());
    let _ = save_db(&paths.auth_path, &db);
    user_id.ok_or_else(|| "Sessão inválida.".into())
}

fn find_user<'a>(db: &'a AuthDb, user_id: &str) -> Result<&'a UserRecord, String> {
    db.users
        .iter()
        .find(|user| user.id == user_id)
        .ok_or_else(|| "Utilizador não encontrado.".into())
}

fn activate_for_user(paths: &AppPaths, user: &UserRecord) -> Result<PublicOrg, String> {
    session::ensure_user_has_org(paths, &user.id, &user.name)?;
    let org = session::activate_user_org(paths, &user.id, user.active_org_id.as_deref())?;
    let mut db = load_db(&paths.auth_path);
    if let Some(record) = db.users.iter_mut().find(|item| item.id == user.id) {
        record.active_org_id = Some(org.id.clone());
        save_db(&paths.auth_path, &db)?;
    }
    Ok(org)
}

#[tauri::command]
fn register(
    paths: State<'_, AppPaths>,
    name: String,
    email: String,
    password: String,
) -> Result<AuthSession, String> {
    let name = name.trim().to_string();
    let email = normalize_email(&email);
    if name.is_empty() {
        return Err("Informe o seu nome.".into());
    }
    if !email.contains('@') {
        return Err("Informe um e-mail válido.".into());
    }
    validate_password(&password)?;

    let mut db = load_db(&paths.auth_path);
    if db.users.iter().any(|user| user.email == email) {
        return Err("Este e-mail já está cadastrado.".into());
    }

    let user_id = random_token();
    let mut orgs_db = orgs::load(&paths.orgs_path);
    let org = orgs::create_org_for_owner(&mut orgs_db, &paths.global_root, &user_id, &name)?;
    orgs::migrate_legacy_into_org(&paths.global_root, &org.id)?;
    orgs::save(&paths.orgs_path, &orgs_db)?;

    let user = UserRecord {
        id: user_id.clone(),
        name,
        email,
        password_hash: hash_password(&password)?,
        active_org_id: Some(org.id.clone()),
        reset_code: None,
        reset_expires: None,
    };
    let token = issue_session(&mut db, &user.id);
    let session = AuthSession {
        token,
        user: public_user(&user),
        active_org: Some(orgs::public_org(&orgs_db, &org.id, &user.id)?),
    };
    db.users.push(user);
    save_db(&paths.auth_path, &db)?;
    paths.set_active(&user_id, &org.id, &org.slug)?;
    Ok(session)
}

#[tauri::command]
fn login(paths: State<'_, AppPaths>, email: String, password: String) -> Result<AuthSession, String> {
    let email = normalize_email(&email);
    let mut db = load_db(&paths.auth_path);
    let Some(user) = db.users.iter().find(|user| user.email == email).cloned() else {
        return Err("E-mail ou senha incorretos.".into());
    };
    if !verify_password(&password, &user.password_hash) {
        return Err("E-mail ou senha incorretos.".into());
    }
    let token = issue_session(&mut db, &user.id);
    save_db(&paths.auth_path, &db)?;
    let active_org = activate_for_user(&paths, &user).ok();
    let mut user = user;
    user.active_org_id = active_org.as_ref().map(|org| org.id.clone());
    Ok(AuthSession {
        token,
        user: public_user(&user),
        active_org,
    })
}

#[tauri::command]
fn logout(paths: State<'_, AppPaths>, token: String) -> Result<(), String> {
    let mut db = load_db(&paths.auth_path);
    db.sessions.retain(|session| session.token != token);
    paths.clear_active();
    save_db(&paths.auth_path, &db)
}

#[tauri::command]
fn current_user(paths: State<'_, AppPaths>, token: String) -> Result<Option<PublicUser>, String> {
    let mut db = load_db(&paths.auth_path);
    let now = now_secs();
    db.sessions.retain(|session| session.expires > now);
    let user_id = db
        .sessions
        .iter()
        .find(|session| session.token == token)
        .map(|session| session.user_id.clone());
    save_db(&paths.auth_path, &db)?;
    let Some(user_id) = user_id else {
        paths.clear_active();
        return Ok(None);
    };
    let Some(user) = db.users.iter().find(|user| user.id == user_id).cloned() else {
        return Ok(None);
    };
    let _ = activate_for_user(&paths, &user);
    let db = load_db(&paths.auth_path);
    Ok(db.users.iter().find(|item| item.id == user_id).map(public_user))
}

#[tauri::command]
fn forgot_password(paths: State<'_, AppPaths>, email: String) -> Result<ResetIssued, String> {
    let email = normalize_email(&email);
    let mut db = load_db(&paths.auth_path);
    let Some(user) = db.users.iter_mut().find(|user| user.email == email) else {
        return Ok(ResetIssued { code: None });
    };
    let code = random_token()
        .chars()
        .take(6)
        .collect::<String>()
        .to_uppercase();
    user.reset_code = Some(code.clone());
    user.reset_expires = Some(now_secs() + RESET_SECONDS);
    save_db(&paths.auth_path, &db)?;
    Ok(ResetIssued { code: Some(code) })
}

#[tauri::command]
fn reset_password(
    paths: State<'_, AppPaths>,
    email: String,
    code: String,
    password: String,
) -> Result<(), String> {
    let email = normalize_email(&email);
    let code = code.trim().to_uppercase();
    validate_password(&password)?;

    let mut db = load_db(&paths.auth_path);
    let Some(user) = db.users.iter_mut().find(|user| user.email == email) else {
        return Err("Código inválido ou expirado.".into());
    };
    let matches = user.reset_code.as_deref() == Some(code.as_str());
    let fresh = user.reset_expires.unwrap_or(0) > now_secs();
    if !matches || !fresh {
        return Err("Código inválido ou expirado.".into());
    }
    user.password_hash = hash_password(&password)?;
    user.reset_code = None;
    user.reset_expires = None;
    let user_id = user.id.clone();
    db.sessions.retain(|session| session.user_id != user_id);
    save_db(&paths.auth_path, &db)
}

#[tauri::command]
fn update_profile(paths: State<'_, AppPaths>, token: String, name: String) -> Result<PublicUser, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Informe o seu nome.".into());
    }
    let user_id = user_id_from_token(&paths, &token)?;
    let mut db = load_db(&paths.auth_path);
    let user = db
        .users
        .iter_mut()
        .find(|user| user.id == user_id)
        .ok_or_else(|| "Utilizador não encontrado.".to_string())?;
    user.name = name;
    let public = public_user(user);
    save_db(&paths.auth_path, &db)?;
    Ok(public)
}

#[tauri::command]
fn list_orgs(paths: State<'_, AppPaths>, token: String) -> Result<Vec<PublicOrg>, String> {
    let user_id = user_id_from_token(&paths, &token)?;
    let db = orgs::load(&paths.orgs_path);
    Ok(orgs::list_for_user(&db, &user_id))
}

#[tauri::command]
fn current_org(paths: State<'_, AppPaths>, token: String) -> Result<Option<PublicOrg>, String> {
    let user_id = user_id_from_token(&paths, &token)?;
    let auth = load_db(&paths.auth_path);
    let user = find_user(&auth, &user_id)?;
    Ok(activate_for_user(&paths, user).ok())
}

#[tauri::command]
fn create_org(paths: State<'_, AppPaths>, token: String, name: String) -> Result<PublicOrg, String> {
    let user_id = user_id_from_token(&paths, &token)?;
    let mut db = orgs::load(&paths.orgs_path);
    let org = orgs::create_org_for_owner(&mut db, &paths.global_root, &user_id, &name)?;
    orgs::save(&paths.orgs_path, &db)?;
    paths.set_active(&user_id, &org.id, &org.slug)?;
    let mut auth = load_db(&paths.auth_path);
    if let Some(user) = auth.users.iter_mut().find(|user| user.id == user_id) {
        user.active_org_id = Some(org.id.clone());
        save_db(&paths.auth_path, &auth)?;
    }
    orgs::public_org(&db, &org.id, &user_id)
}

#[tauri::command]
fn set_active_org(paths: State<'_, AppPaths>, token: String, org_id: String) -> Result<PublicOrg, String> {
    let user_id = user_id_from_token(&paths, &token)?;
    let db = orgs::load(&paths.orgs_path);
    let org = orgs::require_member(&db, &org_id, &user_id)?;
    paths.set_active(&user_id, &org_id, &org.slug)?;
    let mut auth = load_db(&paths.auth_path);
    if let Some(user) = auth.users.iter_mut().find(|user| user.id == user_id) {
        user.active_org_id = Some(org_id.clone());
        save_db(&paths.auth_path, &auth)?;
    }
    orgs::public_org(&db, &org_id, &user_id)
}

#[tauri::command]
fn list_members(paths: State<'_, AppPaths>, token: String, org_id: String) -> Result<Vec<PublicMember>, String> {
    let user_id = user_id_from_token(&paths, &token)?;
    let db = orgs::load(&paths.orgs_path);
    orgs::require_member(&db, &org_id, &user_id)?;
    let auth = load_db(&paths.auth_path);
    Ok(db
        .memberships
        .iter()
        .filter(|item| item.org_id == org_id)
        .filter_map(|item| {
            let user = auth.users.iter().find(|user| user.id == item.user_id)?;
            Some(PublicMember {
                user_id: user.id.clone(),
                email: user.email.clone(),
                display_name: user.name.clone(),
                role: item.role.clone(),
            })
        })
        .collect())
}

#[tauri::command]
fn list_invites(paths: State<'_, AppPaths>, token: String, org_id: String) -> Result<Vec<PublicInvite>, String> {
    let user_id = user_id_from_token(&paths, &token)?;
    let db = orgs::load(&paths.orgs_path);
    orgs::list_invites(&db, &org_id, &user_id)
}

#[tauri::command]
fn invite_member(
    paths: State<'_, AppPaths>,
    token: String,
    org_id: String,
    email: String,
    role: String,
) -> Result<PublicInvite, String> {
    let user_id = user_id_from_token(&paths, &token)?;
    let mut db = orgs::load(&paths.orgs_path);
    let invite = orgs::create_invite(&mut db, &org_id, &email, &role, &user_id)?;
    orgs::save(&paths.orgs_path, &db)?;
    Ok(invite)
}

#[tauri::command]
fn accept_invite(paths: State<'_, AppPaths>, token: String, code: String) -> Result<PublicOrg, String> {
    let user_id = user_id_from_token(&paths, &token)?;
    let auth = load_db(&paths.auth_path);
    let user = find_user(&auth, &user_id)?;
    let mut db = orgs::load(&paths.orgs_path);
    let org = orgs::accept_invite(&mut db, &user_id, &user.email, &code)?;
    orgs::save(&paths.orgs_path, &db)?;
    paths.set_active(&user_id, &org.id, &org.slug)?;
    let mut auth = load_db(&paths.auth_path);
    if let Some(record) = auth.users.iter_mut().find(|item| item.id == user_id) {
        record.active_org_id = Some(org.id.clone());
        save_db(&paths.auth_path, &auth)?;
    }
    Ok(org)
}

#[tauri::command]
fn revoke_invite(
    paths: State<'_, AppPaths>,
    token: String,
    org_id: String,
    invite_id: String,
) -> Result<(), String> {
    let user_id = user_id_from_token(&paths, &token)?;
    let mut db = orgs::load(&paths.orgs_path);
    orgs::revoke_invite(&mut db, &org_id, &invite_id, &user_id)?;
    orgs::save(&paths.orgs_path, &db)
}

#[tauri::command]
fn remove_member(
    paths: State<'_, AppPaths>,
    token: String,
    org_id: String,
    target_user_id: String,
) -> Result<(), String> {
    let user_id = user_id_from_token(&paths, &token)?;
    let mut db = orgs::load(&paths.orgs_path);
    orgs::remove_member(&mut db, &org_id, &target_user_id, &user_id)?;
    orgs::save(&paths.orgs_path, &db)
}

#[tauri::command]
fn update_member_role(
    paths: State<'_, AppPaths>,
    token: String,
    org_id: String,
    target_user_id: String,
    role: String,
) -> Result<(), String> {
    let user_id = user_id_from_token(&paths, &token)?;
    let mut db = orgs::load(&paths.orgs_path);
    orgs::update_member_role(&mut db, &org_id, &target_user_id, &role, &user_id)?;
    orgs::save(&paths.orgs_path, &db)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let meta = launcher::store::resolve_meta_root();
            let apps = launcher::store::resolve_apps_root();
            fs::create_dir_all(&meta).map_err(std::io::Error::other)?;
            fs::create_dir_all(&apps).map_err(std::io::Error::other)?;
            launcher::store::ensure_system_data(&meta).map_err(std::io::Error::other)?;
            let data = launcher::store::system_data_dir(&meta);
            // Migrar auth/orgs da raiz antiga (AppData) para data/ se existirem
            for name in ["auth.json", "orgs.json"] {
                let from = meta.join(name);
                let to = data.join(name);
                if from.is_file() && !to.exists() {
                    let _ = fs::rename(&from, &to).or_else(|_| fs::copy(&from, &to).map(|_| ()));
                }
            }
            // Recuperar conta se a pasta das apps ficou com auth por engano
            if apps != meta {
                let apps_data = launcher::store::system_data_dir(&apps);
                for name in ["auth.json", "orgs.json"] {
                    let to = data.join(name);
                    if to.exists() {
                        continue;
                    }
                    for from in [apps_data.join(name), apps.join(name)] {
                        if from.is_file() {
                            let _ = fs::copy(&from, &to);
                            break;
                        }
                    }
                }
            }
            let paths = AppPaths::new(meta, apps);
            app.manage(paths);

            let open_item = MenuItem::with_id(app, "open", "Abrir", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&open_item, &quit_item])?;
            let tray_icon = app
                .default_window_icon()
                .cloned()
                .ok_or_else(|| std::io::Error::other("Ícone da janela em falta para a bandeja."))?;
            let _tray = TrayIconBuilder::with_id("painel-tray")
                .icon(tray_icon)
                .tooltip("Project Runner")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => restore_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        restore_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            register,
            login,
            logout,
            current_user,
            forgot_password,
            reset_password,
            update_profile,
            list_orgs,
            current_org,
            create_org,
            set_active_org,
            list_members,
            list_invites,
            invite_member,
            accept_invite,
            revoke_invite,
            remove_member,
            update_member_role,
            launcher::commands::get_data_location,
            launcher::commands::set_data_location,
            launcher::commands::launcher_boot,
            launcher::commands::library_list,
            launcher::commands::library_refresh,
            launcher::commands::library_save,
            launcher::commands::library_remove,
            launcher::commands::library_import,
            launcher::commands::library_export,
            launcher::commands::library_validate,
            launcher::commands::library_set_sort,
            launcher::commands::library_set_filter,
            launcher::commands::app_hide,
            launcher::commands::app_detail,
            launcher::commands::app_install,
            launcher::commands::app_launch,
            launcher::commands::app_stop,
            launcher::commands::app_open_folder,
            launcher::commands::app_open_launchfile_dir,
            launcher::commands::app_executables,
            launcher::commands::app_set_executable,
            launcher::commands::app_launch_config_get,
            launcher::commands::app_launch_config_save,
            launcher::commands::app_project_env,
            launcher::commands::app_cloudflare_get,
            launcher::commands::app_cloudflare_save,
            launcher::commands::app_cloudflare_start,
            launcher::commands::app_cloudflare_stop,
            launcher::commands::app_cloudflare_status,
            launcher::commands::app_cloudflare_zones,
            launcher::commands::github_repos,
            launcher::commands::app_generate_launchfile,
            launcher::commands::app_skip_update,
            launcher::commands::app_delete_install,
            launcher::commands::app_locate,
            launcher::commands::app_set_icon,
            launcher::commands::app_clear_icon,
            launcher::commands::app_releases,
            launcher::commands::app_branches,
            launcher::commands::app_set_branch,
            launcher::commands::app_changelog,
            launcher::commands::app_shortcut_desktop,
            launcher::commands::app_shortcut_steam,
            launcher::commands::settings_get,
            launcher::commands::settings_save,
            launcher::commands::communications_get,
            launcher::commands::communications_save,
            launcher::commands::communications_open_dir,
            launcher::commands::reveal_files,
            launcher::commands::port_check,
            launcher::commands::catalog_load,
            launcher::commands::catalog_add,
            launcher::commands::launcher_check_update,
            launcher::commands::launcher_apply_update,
            launcher::commands::log_write,
            launcher::commands::log_path,
            launcher::commands::log_open_folder,
            launcher::commands::window_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
