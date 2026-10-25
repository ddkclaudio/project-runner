use crate::launcher::store::{
    cache_age_ok, ensure_root, install_dir, installed_version, load_apps, load_settings,
    load_version_cache, save_version_cache, token_of,
};
use serde_json::{json, Value};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs() as i64)
        .unwrap_or(0)
}

pub fn rate_limit_message() -> String {
    "O GitHub limitou os pedidos anónimos (cerca de 60 por hora). Crie um token clássico, sem permissões, em https://github.com/settings/tokens e cole-o nas definições.".into()
}

fn client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("Painel/1.0")
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|err| err.to_string())
}

fn auth(request: reqwest::RequestBuilder, token: &str) -> reqwest::RequestBuilder {
    if token.trim().is_empty() {
        request
    } else {
        request.bearer_auth(token.trim())
    }
}

pub struct ReleaseInfo {
    pub tag: String,
    pub body: String,
    pub html_url: String,
    pub assets: Vec<AssetInfo>,
    pub etag: String,
}

#[derive(Clone)]
pub struct AssetInfo {
    pub name: String,
    pub url: String,
    pub size: u64,
}

fn map_status(status: reqwest::StatusCode, body: &str) -> Result<(), String> {
    if status == reqwest::StatusCode::FORBIDDEN || status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        return Err(rate_limit_message());
    }
    if status == reqwest::StatusCode::NOT_FOUND {
        return Err("O GitHub não encontrou esse repositório ou essa release.".into());
    }
    if !status.is_success() && status != reqwest::StatusCode::NOT_MODIFIED {
        let detail = body.lines().next().unwrap_or("").trim();
        if detail.is_empty() {
            return Err(format!("O GitHub respondeu {status}."));
        }
        return Err(format!("O GitHub respondeu {status}: {detail}"));
    }
    Ok(())
}

pub async fn fetch_release(root: &Path, repository: &str, tag: Option<&str>, etag: Option<&str>) -> Result<Option<ReleaseInfo>, String> {
    let token = token_of(root);
    let url = match tag {
        Some(tag) if !tag.is_empty() => format!("https://api.github.com/repos/{repository}/releases/tags/{tag}"),
        _ => format!("https://api.github.com/repos/{repository}/releases/latest"),
    };
    let http = client(60)?;
    let mut request = auth(http.get(&url), &token).header("Accept", "application/vnd.github+json");
    if let Some(etag) = etag.filter(|value| !value.is_empty()) {
        request = request.header("If-None-Match", etag);
    }
    let response = request.send().await.map_err(|err| err.to_string())?;
    let status = response.status();
    if status == reqwest::StatusCode::NOT_MODIFIED {
        return Ok(None);
    }
    let next_etag = response
        .headers()
        .get("etag")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let body = response.text().await.map_err(|err| err.to_string())?;
    map_status(status, &body)?;
    let value: Value = serde_json::from_str(&body).map_err(|_| "A resposta do GitHub não é JSON.".to_string())?;
    Ok(Some(parse_release(&value, next_etag)?))
}

fn parse_release(value: &Value, etag: String) -> Result<ReleaseInfo, String> {
    let tag = value.get("tag_name").and_then(|item| item.as_str()).unwrap_or("").to_string();
    if tag.is_empty() {
        return Err("A release não tem tag.".into());
    }
    let assets = value
        .get("assets")
        .and_then(|item| item.as_array())
        .map(|items| {
            items.iter().filter_map(|asset| {
                let name = asset.get("name")?.as_str()?.to_string();
                let url = asset.get("browser_download_url")?.as_str()?.to_string();
                let size = asset.get("size").and_then(|item| item.as_u64()).unwrap_or(0);
                Some(AssetInfo { name, url, size })
            }).collect()
        })
        .unwrap_or_default();
    Ok(ReleaseInfo {
        body: value.get("body").and_then(|item| item.as_str()).unwrap_or("").to_string(),
        html_url: value.get("html_url").and_then(|item| item.as_str()).unwrap_or("").to_string(),
        tag,
        assets,
        etag,
    })
}

pub fn cache_release(cache: &mut Value, repository: &str, release: &ReleaseInfo) {
    let Some(map) = cache.as_object_mut() else { return };
    map.insert(repository.to_string(), json!({
        "tag": release.tag,
        "etag": release.etag,
        "checkedAt": now_secs(),
        "body": release.body,
        "htmlUrl": release.html_url,
        "assets": release.assets.iter().map(|asset| json!({
            "name": asset.name,
            "url": asset.url,
            "size": asset.size
        })).collect::<Vec<_>>()
    }));
}

pub fn touch_cache(cache: &mut Value, repository: &str) {
    if let Some(entry) = cache.get_mut(repository) {
        if let Some(map) = entry.as_object_mut() {
            map.insert("checkedAt".into(), json!(now_secs()));
        }
    }
}

pub async fn refresh_cache(root: &Path, force: bool) -> Result<(), String> {
    ensure_root(root)?;
    let apps = load_apps(root);
    let mut cache = load_version_cache(root);
    let now = now_secs();
    for app in apps {
        let installed = installed_version(&install_dir(root, &app)).is_some();
        let checked = cache.get(&app.repository).and_then(|item| item.get("checkedAt")).and_then(|item| item.as_i64()).unwrap_or(0);
        if cache_age_ok(checked, installed, now, force) && cache.get(&app.repository).is_some() {
            continue;
        }
        let etag = cache.get(&app.repository).and_then(|item| item.get("etag")).and_then(|item| item.as_str()).map(|item| item.to_string());
        let tag = app.preferred_version.as_deref();
        match fetch_release(root, &app.repository, tag, etag.as_deref()).await {
            Ok(Some(release)) => cache_release(&mut cache, &app.repository, &release),
            Ok(None) => touch_cache(&mut cache, &app.repository),
            Err(_err) => {}
        }
        save_version_cache(root, &cache)?;
    }
    Ok(())
}

pub async fn list_branches(root: &Path, repository: &str) -> Result<Vec<String>, String> {
    let token = token_of(root);
    let http = client(60)?;
    let response = auth(
        http.get(format!("https://api.github.com/repos/{repository}/branches?per_page=100")),
        &token,
    )
    .header("Accept", "application/vnd.github+json")
    .send()
    .await
    .map_err(|err| err.to_string())?;
    let status = response.status();
    let body = response.text().await.map_err(|err| err.to_string())?;
    map_status(status, &body)?;
    let value: Value = serde_json::from_str(&body).map_err(|_| "A resposta do GitHub não é JSON.".to_string())?;
    let items = value.as_array().cloned().unwrap_or_default();
    Ok(items
        .into_iter()
        .filter_map(|item| item.get("name")?.as_str().map(|name| name.to_string()))
        .collect())
}

pub async fn list_releases(root: &Path, repository: &str) -> Result<Vec<Value>, String> {
    let token = token_of(root);
    let http = client(60)?;
    let response = auth(
        http.get(format!("https://api.github.com/repos/{repository}/releases?per_page=30")),
        &token,
    )
    .header("Accept", "application/vnd.github+json")
    .send()
    .await
    .map_err(|err| err.to_string())?;
    let status = response.status();
    let body = response.text().await.map_err(|err| err.to_string())?;
    map_status(status, &body)?;
    let value: Value = serde_json::from_str(&body).map_err(|_| "A resposta do GitHub não é JSON.".to_string())?;
    let items = value.as_array().cloned().unwrap_or_default();
    Ok(items
        .into_iter()
        .map(|item| {
            json!({
                "tag": item.get("tag_name").and_then(|value| value.as_str()).unwrap_or(""),
                "name": item.get("name").and_then(|value| value.as_str()).unwrap_or(""),
                "published": item.get("published_at").and_then(|value| value.as_str()).unwrap_or(""),
                "body": item.get("body").and_then(|value| value.as_str()).unwrap_or("")
            })
        })
        .collect())
}

pub async fn download_file(root: &Path, url: &str, dest: &Path, on_progress: impl Fn(u32)) -> Result<(), String> {
    let token = token_of(root);
    let http = client(30 * 60)?;
    let response = auth(http.get(url), &token)
        .header("Accept", "application/octet-stream")
        .send()
        .await
        .map_err(|err| err.to_string())?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        map_status(status, &body)?;
        return Err(format!("O download falhou ({status})."));
    }
    let total = response.content_length().unwrap_or(0);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let mut file = tokio::fs::File::create(dest).await.map_err(|err| err.to_string())?;
    let mut response = response;
    let mut got = 0u64;
    while let Some(chunk) = response.chunk().await.map_err(|err| err.to_string())? {
        got += chunk.len() as u64;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|err| err.to_string())?;
        let percent = if total == 0 {
            50
        } else {
            10 + ((got.saturating_mul(80)) / total) as u32
        };
        on_progress(percent.min(90));
    }
    Ok(())
}

pub async fn fetch_catalog(root: &Path) -> Result<(String, Value, bool), String> {
    let settings = load_settings(root);
    let repository = settings
        .get("AppListRepository")
        .and_then(|item| item.as_str())
        .unwrap_or("SirDiabo/GHLAppList");
    let repository = if repository.trim().is_empty() { "SirDiabo/GHLAppList" } else { repository.trim() };
    let cached_version = std::fs::read_to_string(root.join("app_catalog_version.txt")).unwrap_or_default();
    let release = fetch_release(root, repository, None, None).await?.ok_or_else(|| "O catálogo não tem release.".to_string())?;
    let cache_file = root.join("app_catalog_cache.json");
    if cached_version.trim() == release.tag && cache_file.is_file() {
        if let Ok(raw) = std::fs::read_to_string(&cache_file) {
            if let Ok(value) = serde_json::from_str::<Value>(&raw) {
                return Ok((release.tag, value, true));
            }
        }
    }
    let url = format!("https://github.com/{repository}/releases/download/{}/apps.json", release.tag);
    let http = client(60)?;
    let response = auth(http.get(&url), &token_of(root)).send().await.map_err(|err| err.to_string())?;
    let status = response.status();
    let body = response.text().await.map_err(|err| err.to_string())?;
    map_status(status, &body)?;
    let value: Value = serde_json::from_str(&body).map_err(|_| "O apps.json do catálogo não é JSON.".to_string())?;
    ensure_root(root)?;
    std::fs::write(&cache_file, serde_json::to_string_pretty(&value).unwrap_or_else(|_| body.clone())).map_err(|err| err.to_string())?;
    std::fs::write(root.join("app_catalog_version.txt"), &release.tag).map_err(|err| err.to_string())?;
    let mut settings = load_settings(root);
    if let Some(map) = settings.as_object_mut() {
        map.insert("AppListCachedVersion".into(), json!(release.tag));
    }
    crate::launcher::store::save_settings(root, &settings)?;
    Ok((release.tag, value, false))
}
