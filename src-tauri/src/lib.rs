use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};
mod launcher;
pub use launcher::{cli_requested, run_cli};

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
}

#[derive(Serialize)]
struct AuthSession {
    token: String,
    user: PublicUser,
}

#[derive(Serialize)]
struct ResetIssued {
    code: Option<String>,
}

struct AuthState {
    path: PathBuf,
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
    serde_json::from_str(&raw).unwrap_or_default()
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

#[tauri::command]
fn register(
    state: State<'_, AuthState>,
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

    let mut db = load_db(&state.path);
    if db.users.iter().any(|user| user.email == email) {
        return Err("Este e-mail já está cadastrado.".into());
    }

    let user = UserRecord {
        id: random_token(),
        name,
        email,
        password_hash: hash_password(&password)?,
        reset_code: None,
        reset_expires: None,
    };
    let token = issue_session(&mut db, &user.id);
    let session = AuthSession {
        token,
        user: public_user(&user),
    };
    db.users.push(user);
    save_db(&state.path, &db)?;
    Ok(session)
}

#[tauri::command]
fn login(
    state: State<'_, AuthState>,
    email: String,
    password: String,
) -> Result<AuthSession, String> {
    let email = normalize_email(&email);
    let mut db = load_db(&state.path);
    let Some(user) = db.users.iter().find(|user| user.email == email).cloned() else {
        return Err("E-mail ou senha incorretos.".into());
    };
    if !verify_password(&password, &user.password_hash) {
        return Err("E-mail ou senha incorretos.".into());
    }
    let token = issue_session(&mut db, &user.id);
    save_db(&state.path, &db)?;
    Ok(AuthSession {
        token,
        user: public_user(&user),
    })
}

#[tauri::command]
fn logout(state: State<'_, AuthState>, token: String) -> Result<(), String> {
    let mut db = load_db(&state.path);
    db.sessions.retain(|session| session.token != token);
    save_db(&state.path, &db)
}

#[tauri::command]
fn current_user(state: State<'_, AuthState>, token: String) -> Result<Option<PublicUser>, String> {
    let mut db = load_db(&state.path);
    let now = now_secs();
    db.sessions.retain(|session| session.expires > now);
    let user_id = db
        .sessions
        .iter()
        .find(|session| session.token == token)
        .map(|session| session.user_id.clone());
    save_db(&state.path, &db)?;
    let Some(user_id) = user_id else {
        return Ok(None);
    };
    Ok(db
        .users
        .iter()
        .find(|user| user.id == user_id)
        .map(public_user))
}

#[tauri::command]
fn forgot_password(state: State<'_, AuthState>, email: String) -> Result<ResetIssued, String> {
    let email = normalize_email(&email);
    let mut db = load_db(&state.path);
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
    save_db(&state.path, &db)?;
    Ok(ResetIssued { code: Some(code) })
}

#[tauri::command]
fn reset_password(
    state: State<'_, AuthState>,
    email: String,
    code: String,
    password: String,
) -> Result<(), String> {
    let email = normalize_email(&email);
    let code = code.trim().to_uppercase();
    validate_password(&password)?;

    let mut db = load_db(&state.path);
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
    save_db(&state.path, &db)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            fs::create_dir_all(&dir)?;
            app.manage(AuthState {
                path: dir.join("auth.json"),
            });
            let root = launcher::resolve_root();
            launcher::store::ensure_root(&root).map_err(std::io::Error::other)?;
            launcher::store::cleanup_backups(&root);
            app.manage(launcher::LauncherState { root });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            register,
            login,
            logout,
            current_user,
            forgot_password,
            reset_password,
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
            launcher::commands::app_open_folder,
            launcher::commands::app_executables,
            launcher::commands::app_set_executable,
            launcher::commands::app_skip_update,
            launcher::commands::app_delete_install,
            launcher::commands::app_locate,
            launcher::commands::app_set_icon,
            launcher::commands::app_clear_icon,
            launcher::commands::app_releases,
            launcher::commands::app_changelog,
            launcher::commands::app_shortcut_desktop,
            launcher::commands::app_shortcut_steam,
            launcher::commands::settings_get,
            launcher::commands::settings_save,
            launcher::commands::catalog_load,
            launcher::commands::catalog_add,
            launcher::commands::launcher_check_update,
            launcher::commands::launcher_apply_update,
            launcher::commands::window_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
