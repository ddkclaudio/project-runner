use crate::orgs::{self, PublicOrg};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Clone)]
#[allow(dead_code)]
pub struct ActiveSession {
    pub user_id: String,
    pub org_id: String,
    pub org_root: PathBuf,
}

pub struct AppPaths {
    pub global_root: PathBuf,
    pub auth_path: PathBuf,
    pub orgs_path: PathBuf,
    pub active: Mutex<Option<ActiveSession>>,
}

impl AppPaths {
    pub fn new(global_root: PathBuf) -> Self {
        Self {
            auth_path: global_root.join("auth.json"),
            orgs_path: global_root.join("orgs.json"),
            global_root,
            active: Mutex::new(None),
        }
    }

    pub fn set_active(&self, user_id: &str, org_id: &str) -> Result<PathBuf, String> {
        let root = orgs::ensure_org_root(&self.global_root, org_id)?;
        let mut guard = self.active.lock().map_err(|_| "Sessão bloqueada.".to_string())?;
        *guard = Some(ActiveSession {
            user_id: user_id.to_string(),
            org_id: org_id.to_string(),
            org_root: root.clone(),
        });
        Ok(root)
    }

    pub fn clear_active(&self) {
        if let Ok(mut guard) = self.active.lock() {
            *guard = None;
        }
    }

    pub fn org_root(&self) -> Result<PathBuf, String> {
        let guard = self.active.lock().map_err(|_| "Sessão bloqueada.".to_string())?;
        guard
            .as_ref()
            .map(|session| session.org_root.clone())
            .ok_or_else(|| "Nenhuma organização activa.".into())
    }

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
    paths.set_active(user_id, &org_id)?;
    orgs::public_org(&db, &org_id, user_id)
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
        paths.set_active(user_id, &org.id)?;
        return orgs::public_org(&db, &org.id, user_id);
    }
    activate_user_org(paths, user_id, None)
}
