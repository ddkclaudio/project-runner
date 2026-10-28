use crate::orgs::{self, PublicOrg};
use crate::launcher::store;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Clone)]
#[allow(dead_code)]
pub struct ActiveSession {
    pub user_id: String,
    pub org_id: String,
    pub org_slug: String,
    /// `{AppData}/data/{orgId}` — apps.json, settings, running, cache
    pub meta_root: PathBuf,
    /// `{appsRoot}/{orgSlug}` — pastas clonadas das apps
    pub workspace_root: PathBuf,
}

pub struct AppPaths {
    /// Conta/orgs/biblioteca — sempre AppData.
    pub global_root: PathBuf,
    /// Só clones das apps (pasta escolhida pelo utilizador ou AppData).
    apps_root: Mutex<PathBuf>,
    pub auth_path: PathBuf,
    pub orgs_path: PathBuf,
    pub active: Mutex<Option<ActiveSession>>,
}

impl AppPaths {
    pub fn new(meta_root: PathBuf, apps_root: PathBuf) -> Self {
        let data = store::system_data_dir(&meta_root);
        Self {
            auth_path: data.join("auth.json"),
            orgs_path: data.join("orgs.json"),
            global_root: meta_root,
            apps_root: Mutex::new(apps_root),
            active: Mutex::new(None),
        }
    }

    pub fn apps_root(&self) -> Result<PathBuf, String> {
        self.apps_root
            .lock()
            .map(|guard| guard.clone())
            .map_err(|_| "Sessão bloqueada.".to_string())
    }

    /// Actualiza a pasta das apps em runtime (sem fechar o programa).
    pub fn set_apps_root(&self, path: PathBuf) -> Result<(), String> {
        std::fs::create_dir_all(&path).map_err(|err| err.to_string())?;
        {
            let mut root = self.apps_root.lock().map_err(|_| "Sessão bloqueada.".to_string())?;
            *root = path.clone();
        }
        let mut active = self.active.lock().map_err(|_| "Sessão bloqueada.".to_string())?;
        if let Some(session) = active.as_mut() {
            let workspace = store::org_workspace(&path, &session.org_slug);
            std::fs::create_dir_all(&workspace).map_err(|err| err.to_string())?;
            session.workspace_root = workspace;
        }
        Ok(())
    }

    pub fn set_active(&self, user_id: &str, org_id: &str, org_slug: &str) -> Result<PathBuf, String> {
        let meta = orgs::ensure_org_root(&self.global_root, org_id)?;
        let apps = self.apps_root()?;
        let workspace = store::org_workspace(&apps, org_slug);
        std::fs::create_dir_all(&workspace).map_err(|err| err.to_string())?;
        let mut guard = self.active.lock().map_err(|_| "Sessão bloqueada.".to_string())?;
        *guard = Some(ActiveSession {
            user_id: user_id.to_string(),
            org_id: org_id.to_string(),
            org_slug: org_slug.to_string(),
            meta_root: meta.clone(),
            workspace_root: workspace,
        });
        Ok(meta)
    }

    pub fn clear_active(&self) {
        if let Ok(mut guard) = self.active.lock() {
            *guard = None;
        }
    }

    /// Metadados da org activa (biblioteca, settings).
    pub fn org_root(&self) -> Result<PathBuf, String> {
        let guard = self.active.lock().map_err(|_| "Sessão bloqueada.".to_string())?;
        guard
            .as_ref()
            .map(|session| session.meta_root.clone())
            .ok_or_else(|| "Nenhuma organização activa.".into())
    }

    pub fn active_org_id(&self) -> Result<String, String> {
        let guard = self.active.lock().map_err(|_| "Sessão bloqueada.".to_string())?;
        guard
            .as_ref()
            .map(|session| session.org_id.clone())
            .ok_or_else(|| "Nenhuma organização activa.".into())
    }

    /// Workspace da org: clones em `{appsRoot}/{orgSlug}/`.
    pub fn workspace_root(&self) -> Result<PathBuf, String> {
        let guard = self.active.lock().map_err(|_| "Sessão bloqueada.".to_string())?;
        guard
            .as_ref()
            .map(|session| session.workspace_root.clone())
            .ok_or_else(|| "Nenhuma organização activa.".into())
    }
}

fn activate_id(
    paths: &AppPaths,
    user_id: &str,
    org_id: &str,
) -> Result<PublicOrg, String> {
    let db = orgs::load(&paths.orgs_path);
    let org = orgs::require_member(&db, org_id, user_id)?;
    paths.set_active(user_id, org_id, &org.slug)?;
    orgs::public_org(&db, org_id, user_id)
}

pub fn activate_user_org(
    paths: &AppPaths,
    user_id: &str,
    preferred_org_id: Option<&str>,
) -> Result<PublicOrg, String> {
    let db = orgs::load(&paths.orgs_path);
    let list = orgs::list_for_user(&db, user_id);
    let org_id = if let Some(preferred) = preferred_org_id.filter(|id| !id.is_empty()) {
        if orgs::role_of(&db, preferred, user_id).is_some() {
            preferred.to_string()
        } else if let Some(first) = list.first() {
            first.id.clone()
        } else {
            return Err("Sem organização.".into());
        }
    } else if let Some(first) = list.first() {
        first.id.clone()
    } else {
        return Err("Sem organização.".into());
    };
    activate_id(paths, user_id, &org_id)
}

pub fn ensure_user_has_org(
    paths: &AppPaths,
    user_id: &str,
    display_name: &str,
) -> Result<PublicOrg, String> {
    let mut db = orgs::load(&paths.orgs_path);
    if orgs::list_for_user(&db, user_id).is_empty() {
        let org = orgs::create_org_for_owner(&mut db, &paths.global_root, user_id, display_name)?;
        orgs::migrate_legacy_into_org(&paths.global_root, &org.id)?;
        orgs::save(&paths.orgs_path, &db)?;
        paths.set_active(user_id, &org.id, &org.slug)?;
        return orgs::public_org(&db, &org.id, user_id);
    }
    activate_user_org(paths, user_id, None)
}
