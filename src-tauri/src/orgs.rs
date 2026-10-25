use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const INVITE_SECONDS: i64 = 60 * 60 * 24 * 7;

#[derive(Default, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OrgsDb {
    #[serde(default)]
    pub organizations: Vec<Organization>,
    #[serde(default)]
    pub memberships: Vec<Membership>,
    #[serde(default)]
    pub invites: Vec<Invite>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Organization {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub owner_user_id: String,
    pub created_at: i64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Membership {
    pub org_id: String,
    pub user_id: String,
    pub role: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Invite {
    pub id: String,
    pub org_id: String,
    pub email: String,
    pub role: String,
    pub code: String,
    pub expires: i64,
    pub invited_by: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicOrg {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub role: String,
    pub is_owner: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicMember {
    pub user_id: String,
    pub email: String,
    pub display_name: String,
    pub role: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicInvite {
    pub id: String,
    pub org_id: String,
    pub email: String,
    pub role: String,
    pub code: String,
    pub expires: i64,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub fn load(path: &Path) -> OrgsDb {
    let Ok(raw) = fs::read_to_string(path) else {
        return OrgsDb::default();
    };
    serde_json::from_str(raw.trim_start_matches('\u{feff}')).unwrap_or_default()
}

pub fn save(path: &Path, db: &OrgsDb) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let raw = serde_json::to_string_pretty(db).map_err(|err| err.to_string())?;
    fs::write(path, raw).map_err(|err| err.to_string())
}

pub fn slugify(name: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            dash = false;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
    }
    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "org".into()
    } else {
        trimmed
    }
}

pub fn unique_slug(db: &OrgsDb, base: &str) -> String {
    let slug = slugify(base);
    if !db.organizations.iter().any(|org| org.slug == slug) {
        return slug;
    }
    for index in 2..10_000 {
        let candidate = format!("{slug}-{index}");
        if !db.organizations.iter().any(|org| org.slug == candidate) {
            return candidate;
        }
    }
    format!("{slug}-{}", now_secs())
}

pub fn org_data_root(global_root: &Path, org_id: &str) -> PathBuf {
    global_root.join("orgs").join(org_id)
}

pub fn ensure_org_root(global_root: &Path, org_id: &str) -> Result<PathBuf, String> {
    let root = org_data_root(global_root, org_id);
    crate::launcher::store::ensure_root(&root)?;
    Ok(root)
}

/// Move apps.json / settings / Cache / Apps from global root into the first org once.
pub fn migrate_legacy_into_org(global_root: &Path, org_id: &str) -> Result<(), String> {
    let dest = ensure_org_root(global_root, org_id)?;
    let marker = global_root.join(".org-migrated");
    if marker.is_file() {
        return Ok(());
    }
    for name in ["apps.json", "settings.json", "running.json", "app-state.json"] {
        let from = global_root.join(name);
        let to = dest.join(name);
        if from.is_file() && !to.exists() {
            let _ = fs::rename(&from, &to).or_else(|_| fs::copy(&from, &to).map(|_| ()));
        }
    }
    for name in ["Cache", "Apps"] {
        let from = global_root.join(name);
        let to = dest.join(name);
        if from.is_dir() && !to.exists() {
            let _ = fs::rename(&from, &to);
        }
    }
    let _ = fs::write(marker, org_id);
    Ok(())
}

pub fn create_org_for_owner(
    db: &mut OrgsDb,
    global_root: &Path,
    owner_user_id: &str,
    name: &str,
) -> Result<Organization, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Informe o nome da organização.".into());
    }
    let id = format!("org_{}", crate::random_token_public());
    let org = Organization {
        id: id.clone(),
        name: name.to_string(),
        slug: unique_slug(db, name),
        owner_user_id: owner_user_id.to_string(),
        created_at: now_secs(),
    };
    db.memberships.push(Membership {
        org_id: id.clone(),
        user_id: owner_user_id.to_string(),
        role: "owner".into(),
    });
    db.organizations.push(org.clone());
    ensure_org_root(global_root, &id)?;
    Ok(org)
}

pub fn role_of(db: &OrgsDb, org_id: &str, user_id: &str) -> Option<String> {
    db.memberships
        .iter()
        .find(|item| item.org_id == org_id && item.user_id == user_id)
        .map(|item| item.role.clone())
}

pub fn require_member<'a>(db: &'a OrgsDb, org_id: &str, user_id: &str) -> Result<&'a Organization, String> {
    role_of(db, org_id, user_id).ok_or_else(|| "Não pertence a esta organização.".to_string())?;
    db.organizations
        .iter()
        .find(|org| org.id == org_id)
        .ok_or_else(|| "Organização não encontrada.".into())
}

pub fn require_owner(db: &OrgsDb, org_id: &str, user_id: &str) -> Result<(), String> {
    match role_of(db, org_id, user_id).as_deref() {
        Some("owner") => Ok(()),
        _ => Err("Apenas o dono pode fazer isto.".into()),
    }
}

pub fn list_for_user(db: &OrgsDb, user_id: &str) -> Vec<PublicOrg> {
    db.memberships
        .iter()
        .filter(|item| item.user_id == user_id)
        .filter_map(|item| {
            let org = db.organizations.iter().find(|org| org.id == item.org_id)?;
            Some(PublicOrg {
                id: org.id.clone(),
                name: org.name.clone(),
                slug: org.slug.clone(),
                role: item.role.clone(),
                is_owner: item.role == "owner",
            })
        })
        .collect()
}

pub fn public_org(db: &OrgsDb, org_id: &str, user_id: &str) -> Result<PublicOrg, String> {
    let role = role_of(db, org_id, user_id).ok_or_else(|| "Não pertence a esta organização.".to_string())?;
    let org = db
        .organizations
        .iter()
        .find(|org| org.id == org_id)
        .ok_or_else(|| "Organização não encontrada.".to_string())?;
    Ok(PublicOrg {
        id: org.id.clone(),
        name: org.name.clone(),
        slug: org.slug.clone(),
        role: role.clone(),
        is_owner: role == "owner",
    })
}

pub fn create_invite(
    db: &mut OrgsDb,
    org_id: &str,
    email: &str,
    role: &str,
    invited_by: &str,
) -> Result<PublicInvite, String> {
    require_owner(db, org_id, invited_by)?;
    let email = email.trim().to_lowercase();
    if !email.contains('@') {
        return Err("Informe um e-mail válido.".into());
    }
    let role = if role == "owner" { "owner" } else { "member" };
    db.invites.retain(|invite| invite.expires > now_secs());
    let code = crate::random_token_public()
        .chars()
        .take(8)
        .collect::<String>()
        .to_uppercase();
    let invite = Invite {
        id: format!("inv_{}", crate::random_token_public()),
        org_id: org_id.to_string(),
        email,
        role: role.into(),
        code: code.clone(),
        expires: now_secs() + INVITE_SECONDS,
        invited_by: invited_by.to_string(),
    };
    let public = PublicInvite {
        id: invite.id.clone(),
        org_id: invite.org_id.clone(),
        email: invite.email.clone(),
        role: invite.role.clone(),
        code: invite.code.clone(),
        expires: invite.expires,
    };
    db.invites.push(invite);
    Ok(public)
}

pub fn accept_invite(db: &mut OrgsDb, user_id: &str, user_email: &str, code: &str) -> Result<PublicOrg, String> {
    let code = code.trim().to_uppercase();
    let email = user_email.trim().to_lowercase();
    db.invites.retain(|invite| invite.expires > now_secs());
    let Some(index) = db.invites.iter().position(|invite| invite.code == code) else {
        return Err("Convite inválido ou expirado.".into());
    };
    let invite = db.invites[index].clone();
    if invite.email != email {
        return Err("Este convite foi enviado para outro e-mail.".into());
    }
    if role_of(db, &invite.org_id, user_id).is_none() {
        db.memberships.push(Membership {
            org_id: invite.org_id.clone(),
            user_id: user_id.to_string(),
            role: invite.role.clone(),
        });
    }
    db.invites.remove(index);
    public_org(db, &invite.org_id, user_id)
}

pub fn revoke_invite(db: &mut OrgsDb, org_id: &str, invite_id: &str, user_id: &str) -> Result<(), String> {
    require_owner(db, org_id, user_id)?;
    let before = db.invites.len();
    db.invites
        .retain(|invite| !(invite.org_id == org_id && invite.id == invite_id));
    if db.invites.len() == before {
        return Err("Convite não encontrado.".into());
    }
    Ok(())
}

pub fn remove_member(db: &mut OrgsDb, org_id: &str, target_user_id: &str, actor_id: &str) -> Result<(), String> {
    require_owner(db, org_id, actor_id)?;
    let org = db
        .organizations
        .iter()
        .find(|org| org.id == org_id)
        .ok_or_else(|| "Organização não encontrada.".to_string())?;
    if org.owner_user_id == target_user_id {
        return Err("Não pode remover o dono da organização.".into());
    }
    let before = db.memberships.len();
    db.memberships
        .retain(|item| !(item.org_id == org_id && item.user_id == target_user_id));
    if db.memberships.len() == before {
        return Err("Membro não encontrado.".into());
    }
    Ok(())
}

pub fn update_member_role(
    db: &mut OrgsDb,
    org_id: &str,
    target_user_id: &str,
    role: &str,
    actor_id: &str,
) -> Result<(), String> {
    require_owner(db, org_id, actor_id)?;
    let org = db
        .organizations
        .iter()
        .find(|org| org.id == org_id)
        .ok_or_else(|| "Organização não encontrada.".to_string())?;
    if org.owner_user_id == target_user_id {
        return Err("O papel do dono não pode ser alterado.".into());
    }
    let role = if role == "owner" { "owner" } else { "member" };
    let member = db
        .memberships
        .iter_mut()
        .find(|item| item.org_id == org_id && item.user_id == target_user_id)
        .ok_or_else(|| "Membro não encontrado.".to_string())?;
    member.role = role.into();
    Ok(())
}

pub fn list_invites(db: &OrgsDb, org_id: &str, user_id: &str) -> Result<Vec<PublicInvite>, String> {
    require_owner(db, org_id, user_id)?;
    Ok(db
        .invites
        .iter()
        .filter(|invite| invite.org_id == org_id && invite.expires > now_secs())
        .map(|invite| PublicInvite {
            id: invite.id.clone(),
            org_id: invite.org_id.clone(),
            email: invite.email.clone(),
            role: invite.role.clone(),
            code: invite.code.clone(),
            expires: invite.expires,
        })
        .collect())
}
