use crate::launcher::assets::{matching_assets, wine_warning};
use crate::launcher::github::{self, AssetInfo};
use crate::launcher::store::{self, find_app, install_dir, installed_version, load_apps};
use serde::Serialize;
use std::fs;
use std::io::{self, Read};
use std::path::{Component, Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub needs_choice: bool,
    pub needs_confirm: bool,
    pub assets: Vec<String>,
    pub warning: Option<String>,
    pub message: String,
    pub installed_version: Option<String>,
}

fn result_message(message: impl Into<String>) -> InstallResult {
    InstallResult {
        needs_choice: false,
        needs_confirm: false,
        assets: Vec::new(),
        warning: None,
        message: message.into(),
        installed_version: None,
    }
}

pub async fn install(
    root: &Path,
    repository: &str,
    asset_name: Option<String>,
    tag: Option<String>,
    confirm_wine: bool,
    on_progress: impl Fn(u32, &str),
) -> Result<InstallResult, String> {
    let apps = load_apps(root);
    let app = find_app(&apps, repository)?.clone();
    let tag = tag.filter(|value| !value.trim().is_empty()).or(app.preferred_version.clone());
    on_progress(2, "A procurar a release");
    let release = match github::fetch_release(root, &app.repository, tag.as_deref(), None).await? {
        Some(release) => release,
        None => return Err("A release não foi encontrada.".into()),
    };
    let dir = install_dir(root, &app);
    if installed_version(&dir).as_deref() == Some(release.tag.as_str()) {
        let mut done = result_message(format!("{} já está na versão {}.", app.name, release.tag));
        done.installed_version = Some(release.tag);
        return Ok(done);
    }
    let names: Vec<String> = release.assets.iter().map(|asset| asset.name.clone()).collect();
    let platform = store::platform_of(&store::load_settings(root));
    let matches = matching_assets(&names, &platform);
    let chosen = if let Some(name) = asset_name.filter(|value| !value.trim().is_empty()) {
        release
            .assets
            .iter()
            .find(|asset| asset.name.eq_ignore_ascii_case(&name))
            .cloned()
            .ok_or_else(|| "Esse ficheiro não está na release.".to_string())?
    } else if matches.len() == 1 {
        release
            .assets
            .iter()
            .find(|asset| asset.name == matches[0])
            .cloned()
            .ok_or_else(|| "Ficheiro da release em falta.".to_string())?
    } else if matches.is_empty() {
        return Err("Nenhum ficheiro desta release serve para a plataforma escolhida.".into());
    } else {
        return Ok(InstallResult {
            needs_choice: true,
            needs_confirm: false,
            assets: matches,
            warning: None,
            message: "Há vários ficheiros compatíveis. Escolha um para continuar.".into(),
            installed_version: None,
        });
    };
    if let Some(warning) = wine_warning(&platform, &chosen.name) {
        if !confirm_wine {
            return Ok(InstallResult {
                needs_choice: false,
                needs_confirm: true,
                assets: vec![chosen.name],
                warning: Some(warning),
                message: "Confirme a instalação deste ficheiro de Windows.".into(),
                installed_version: None,
            });
        }
    }
    let temp = root.join("Cache").join(format!("download-{}", store::icon_stem(&app)));
    let _ = fs::remove_dir_all(&temp);
    fs::create_dir_all(&temp).map_err(|err| err.to_string())?;
    let file_path = temp.join(&chosen.name);
    on_progress(10, "A transferir");
    github::download_file(root, &chosen.url, &file_path, |percent| on_progress(percent, "A transferir")).await?;
    on_progress(95, "A instalar");
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    place_asset(&file_path, &dir, &chosen)?;
    fs::write(dir.join("version.txt"), &release.tag).map_err(|err| err.to_string())?;
    let _ = fs::remove_dir_all(&temp);
    let mut cache = store::load_version_cache(root);
    github::cache_release(&mut cache, &app.repository, &release);
    store::save_version_cache(root, &cache)?;
    on_progress(100, "Concluído");
    Ok(InstallResult {
        needs_choice: false,
        needs_confirm: false,
        assets: vec![chosen.name],
        warning: None,
        message: format!("{} instalada ({})", app.name, release.tag),
        installed_version: Some(release.tag),
    })
}

fn place_asset(file: &Path, dir: &Path, asset: &AssetInfo) -> Result<(), String> {
    let name = asset.name.to_lowercase();
    if name.ends_with(".zip") {
        extract_zip(file, dir)
    } else if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        extract_tar_gz(file, dir)
    } else if name.ends_with(".tar.xz") || name.ends_with(".7z") {
        Err("Este formato ainda não é extraído. Use zip ou tar.gz.".into())
    } else {
        let dest = dir.join(&asset.name);
        fs::copy(file, dest).map(|_| ()).map_err(|err| err.to_string())
    }
}

fn safe_join(root: &Path, relative: &Path) -> Result<PathBuf, String> {
    if relative.components().any(|part| matches!(part, Component::ParentDir | Component::RootDir)) {
        return Err("O arquivo tem um caminho inválido.".into());
    }
    Ok(root.join(relative))
}

fn extract_zip(file: &Path, dir: &Path) -> Result<(), String> {
    let opened = fs::File::open(file).map_err(|err| err.to_string())?;
    let mut archive = zip::ZipArchive::new(opened).map_err(|err| err.to_string())?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|err| err.to_string())?;
        let Some(relative) = entry.enclosed_name().map(|path| path.to_path_buf()) else {
            continue;
        };
        let dest = safe_join(dir, &relative)?;
        if entry.is_dir() {
            fs::create_dir_all(&dest).map_err(|err| err.to_string())?;
            continue;
        }
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        let mut outfile = fs::File::create(&dest).map_err(|err| err.to_string())?;
        io::copy(&mut entry, &mut outfile).map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn extract_tar_gz(file: &Path, dir: &Path) -> Result<(), String> {
    let opened = fs::File::open(file).map_err(|err| err.to_string())?;
    let decoder = flate2::read::GzDecoder::new(opened);
    let mut archive = tar::Archive::new(decoder);
    for entry in archive.entries().map_err(|err| err.to_string())? {
        let mut entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path().map_err(|err| err.to_string())?.into_owned();
        let dest = safe_join(dir, &path)?;
        entry.unpack(&dest).map_err(|err| err.to_string())?;
    }
    Ok(())
}

pub fn read_executables(dir: &Path) -> Vec<String> {
    fn is_launchable(path: &Path) -> bool {
        if !path.is_file() && !path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("app")) {
            return false;
        }
        let ext = path.extension().and_then(|ext| ext.to_str()).unwrap_or("").to_lowercase();
        if cfg!(windows) {
            matches!(ext.as_str(), "exe" | "bat" | "cmd")
        } else if cfg!(target_os = "macos") {
            matches!(ext.as_str(), "app" | "sh" | "command" | "")
        } else {
            matches!(ext.as_str(), "" | "appimage" | "sh" | "bin" | "exe" | "x86_64" | "app")
        }
    }
    fn collect(dir: &Path, recursive: bool, into: &mut Vec<PathBuf>, depth: usize) {
        if depth > 4 || into.len() > 200 {
            return;
        }
        let Ok(entries) = fs::read_dir(dir) else { return };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("app")) {
                    into.push(path);
                } else if recursive {
                    collect(&path, true, into, depth + 1);
                }
            } else if is_launchable(&path) {
                into.push(path);
            }
        }
    }
    let mut found = Vec::new();
    collect(dir, false, &mut found, 0);
    if found.is_empty() {
        collect(dir, true, &mut found, 0);
    }
    found.sort();
    found.into_iter().map(|path| path.display().to_string()).collect()
}

pub fn remember_icon(root: &Path, repository: &str, source: &Path) -> Result<String, String> {
    if !source.is_file() {
        return Err("O ficheiro de imagem não existe.".into());
    }
    let mut bytes = Vec::new();
    fs::File::open(source)
        .and_then(|mut file| file.read_to_end(&mut bytes))
        .map_err(|err| err.to_string())?;
    if bytes.len() > 4_000_000 {
        return Err("A imagem passa de 4 MB.".into());
    }
    let apps = load_apps(root);
    let app = find_app(&apps, repository)?;
    let ext = source.extension().and_then(|ext| ext.to_str()).unwrap_or("img");
    let dest = root.join("Cache").join("CustomIcons").join(format!("{}.{ext}", store::icon_stem(app)));
    if let Ok(entries) = fs::read_dir(root.join("Cache").join("CustomIcons")) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(&store::icon_stem(app)) {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    fs::write(&dest, bytes).map_err(|err| err.to_string())?;
    Ok(dest.display().to_string())
}

pub fn clear_icon(root: &Path, repository: &str) -> Result<(), String> {
    let apps = load_apps(root);
    let app = find_app(&apps, repository)?;
    let dir = root.join("Cache").join("CustomIcons");
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().starts_with(&store::icon_stem(app)) {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    Ok(())
}
