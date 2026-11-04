use crate::launcher::assets::{matching_assets, wine_warning};
use crate::launcher::github::{self, fetch_release};
use crate::launcher::store::{load_settings, platform_of};
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub configured: bool,
    pub update_available: bool,
    pub current_version: String,
    pub remote_version: Option<String>,
    pub message: String,
}

fn update_repo(root: &Path) -> String {
    load_settings(root)
        .get("PainelUpdateRepository")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim()
        .to_string()
}

fn read_check(root: &Path) -> Value {
    fs::read_to_string(root.join("update_check.json"))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_else(|| json!({}))
}

fn write_check(root: &Path, value: &Value) {
    let _ = fs::write(
        root.join("update_check.json"),
        serde_json::to_string_pretty(value).unwrap_or_else(|_| "{}".into()),
    );
}

pub async fn check(root: &Path, force: bool, repository: Option<&str>) -> Result<UpdateStatus, String> {
    let current = env!("CARGO_PKG_VERSION").to_string();
    let stored = update_repo(root);
    let repo = match repository {
        Some(value) => value.trim().to_string(),
        None => stored.clone(),
    };
    let isolated = repository.is_some() && !repo.eq_ignore_ascii_case(&stored);
    if repo.is_empty() {
        return Ok(UpdateStatus {
            configured: false,
            update_available: false,
            current_version: current,
            remote_version: None,
            message: "Nenhuma origem de atualização configurada.".into(),
        });
    }
    if repo.eq_ignore_ascii_case("SirDiabo/GithubLauncher") {
        return Err("Esta origem é o launcher em Avalonia. Indique o repositório do Project Runner.".into());
    }
    let mut saved = read_check(root);
    let last = saved.get("LastCheckTime").and_then(|value| value.as_i64()).unwrap_or(0);
    let now = github::now_secs();
    if !isolated && !force && now.saturating_sub(last) < 300 {
        let remote = saved.get("LastKnownVersion").and_then(|value| value.as_str()).map(|value| value.to_string());
        let available = saved.get("UpdateAvailable").and_then(|value| value.as_bool()).unwrap_or(false);
        return Ok(UpdateStatus {
            configured: true,
            update_available: available,
            remote_version: remote,
            message: if available { "Há uma versão mais recente do Project Runner.".into() } else { "O Project Runner está atualizado.".into() },
            current_version: current,
        });
    }
    let etag = if isolated {
        None
    } else {
        saved.get("ETag").and_then(|value| value.as_str()).map(|value| value.to_string())
    };
    let release = fetch_release(root, &repo, None, etag.as_deref()).await?;
    let remote = if let Some(release) = release.as_ref() {
        release.tag.clone()
    } else {
        saved.get("LastKnownVersion").and_then(|value| value.as_str()).unwrap_or("").to_string()
    };
    let available = !remote.is_empty() && crate::launcher::version::is_newer(&remote, &current);
    if !isolated {
        if let Some(map) = saved.as_object_mut() {
            map.insert("LastCheckTime".into(), json!(now));
            map.insert("LastKnownVersion".into(), json!(remote));
            map.insert("CurrentVersion".into(), json!(current));
            map.insert("UpdateAvailable".into(), json!(available));
            if let Some(release) = &release {
                map.insert("ETag".into(), json!(release.etag));
            }
        }
        write_check(root, &saved);
    }
    Ok(UpdateStatus {
        configured: true,
        update_available: available,
        remote_version: if remote.is_empty() { None } else { Some(remote) },
        current_version: current,
        message: if available { "Há uma versão mais recente do Project Runner.".into() } else { "O Project Runner está atualizado.".into() },
    })
}

pub async fn apply(root: &Path, repository: Option<&str>) -> Result<String, String> {
    let status = check(root, true, repository).await?;
    if !status.configured {
        return Err(status.message);
    }
    if !status.update_available {
        return Err("Não há atualização para aplicar.".into());
    }
    let exe = std::env::current_exe().map_err(|err| err.to_string())?;
    let parent = exe.parent().unwrap_or(Path::new("."));
    let parent_text = parent.display().to_string().replace('/', "\\").to_lowercase();
    if parent_text.contains("target\\debug") || parent_text.contains("target\\release") {
        return Err("A atualização do executável só corre numa instalação, não na pasta de desenvolvimento.".into());
    }
    let repo = match repository {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => update_repo(root),
    };
    let release = fetch_release(root, &repo, None, None).await?.ok_or_else(|| "A release não foi encontrada.".to_string())?;
    let names: Vec<String> = release.assets.iter().map(|asset| asset.name.clone()).collect();
    let platform = platform_of(&load_settings(root));
    let matches = matching_assets(&names, &platform);
    if matches.len() != 1 {
        return Err("A release do Project Runner precisa de um único ficheiro para esta plataforma.".into());
    }
    let asset = release.assets.iter().find(|item| item.name == matches[0]).ok_or_else(|| "Ficheiro em falta.".to_string())?;
    if wine_warning(&platform, &asset.name).is_some() {
        return Err("O ficheiro desta release não é nativo desta plataforma.".into());
    }
    let temp = std::env::temp_dir().join(format!("Painel_update_{}", release.tag.replace(['\\', '/', ':'], "_")));
    let _ = fs::remove_dir_all(&temp);
    fs::create_dir_all(&temp).map_err(|err| err.to_string())?;
    let file = temp.join(&asset.name);
    github::download_file(root, &asset.url, &file, |_| {}).await?;
    let stamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let backup = std::env::temp_dir().join(format!("Painel_backup_{stamp}"));
    write_updater(&exe, &file, &backup)?;
    Ok("O Project Runner vai fechar para aplicar a atualização.".into())
}

fn write_updater(exe: &Path, payload: &Path, backup: &Path) -> Result<(), String> {
    let parent = exe.parent().unwrap_or(Path::new("."));
    if cfg!(windows) {
        let script = parent.join("Painel_Updater.cmd");
        let body = format!(
            "@echo off\r\nset /a n=0\r\n:wait\r\ntasklist /FI \"IMAGENAME eq {exe_name}\" | find /I \"{exe_name}\" >nul\r\nif %ERRORLEVEL%==0 (\r\n  set /a n+=1\r\n  if %n% GEQ 120 exit /b 1\r\n  timeout /t 1 /nobreak >nul\r\n  goto wait\r\n)\r\nmkdir \"{backup}\"\r\ncopy /Y \"{exe}\" \"{backup}\\\" >nul\r\ncopy /Y \"{payload}\" \"{exe}\" >nul\r\nstart \"\" \"{exe}\"\r\n",
            exe_name = exe.file_name().unwrap_or_default().to_string_lossy(),
            backup = backup.display(),
            exe = exe.display(),
            payload = payload.display(),
        );
        fs::write(&script, body).map_err(|err| err.to_string())?;
        Command::new("cmd").args(["/C", "start", "", script.to_string_lossy().as_ref()]).spawn().map_err(|err| err.to_string())?;
    } else {
        let script = parent.join("Painel_Updater.sh");
        let pid = std::process::id();
        let exe_q = shell_single_quote(&exe.display().to_string());
        let body = format!(
            "#!/bin/sh\n\
             pid={pid}\n\
             n=0\n\
             while kill -0 \"$pid\" 2>/dev/null; do\n\
               n=$((n+1))\n\
               if [ \"$n\" -ge 120 ]; then exit 1; fi\n\
               sleep 1\n\
             done\n\
             mkdir -p {backup}\n\
             cp {exe_q} {backup}/\n\
             cp {payload} {exe_q}\n\
             chmod +x {exe_q}\n\
             {relaunch}\n",
            backup = shell_single_quote(&backup.display().to_string()),
            payload = shell_single_quote(&payload.display().to_string()),
            relaunch = relaunch_line(exe),
        );
        fs::write(&script, body).map_err(|err| err.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&script, fs::Permissions::from_mode(0o755));
        }
        Command::new("sh").arg(&script).spawn().map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn shell_single_quote(text: &str) -> String {
    format!("'{}'", text.replace('\'', "'\\''"))
}

fn relaunch_line(exe: &Path) -> String {
    if cfg!(target_os = "macos") {
        let mut cursor = exe.to_path_buf();
        loop {
            if cursor
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("app"))
            {
                return format!("open {}", shell_single_quote(&cursor.display().to_string()));
            }
            if !cursor.pop() {
                break;
            }
        }
    }
    format!("{} &", shell_single_quote(&exe.display().to_string()))
}
