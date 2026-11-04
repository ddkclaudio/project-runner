use crate::launcher::assets::{matching_assets, wine_warning};
use crate::launcher::github::{self, AssetInfo};
use crate::launcher::store::{self, find_app, install_dir, installed_version, load_apps};
use serde::Serialize;
use image::ImageEncoder;
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

fn run_git(dir: &Path, args: &[&str]) -> Result<(), String> {
    use std::process::Command;
    let shown = args.first().copied().unwrap_or("git");
    let status = Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .status()
        .map_err(|err| format!("git {shown} falhou: {err}"))?;
    if !status.success() {
        return Err(format!("git {shown} não concluiu com sucesso."));
    }
    Ok(())
}

/// `git fetch` + checkout da branch (funciona em clones shallow).
pub fn checkout_branch(dir: &Path, branch: &str) -> Result<(), String> {
    let branch = branch.trim();
    if branch.is_empty() {
        return Err("Indique a branch.".into());
    }
    if !dir.join(".git").is_dir() {
        return Err("Esta instalação não é um clone git.".into());
    }
    run_git(dir, &["fetch", "origin", branch, "--depth", "1"])?;
    run_git(dir, &["checkout", "-B", branch, "FETCH_HEAD"])
}

pub fn current_branch(dir: &Path) -> Option<String> {
    use std::process::Command;
    let output = Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if name.is_empty() || name == "HEAD" {
        None
    } else {
        Some(name)
    }
}

fn git_clone(
    repository: &str,
    dir: &Path,
    branch: Option<&str>,
    on_progress: &impl Fn(u32, &str),
) -> Result<(), String> {
    use std::process::Command;
    let branch = branch.map(str::trim).filter(|item| !item.is_empty());
    if dir.join(".git").is_dir() {
        on_progress(40, "A actualizar o clone");
        if let Some(branch) = branch {
            return checkout_branch(dir, branch);
        }
        return run_git(dir, &["pull", "--ff-only"]);
    }
    if dir.exists() {
        let empty = fs::read_dir(dir).map(|mut entries| entries.next().is_none()).unwrap_or(false);
        if !empty {
            return Err("A pasta de destino já existe e não está vazia.".into());
        }
        let _ = fs::remove_dir_all(dir);
    }
    if let Some(parent) = dir.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    on_progress(20, "A clonar o repositório");
    let url = format!("https://github.com/{repository}.git");
    let mut args = vec!["clone".to_string(), "--depth".into(), "1".into()];
    if let Some(branch) = branch {
        args.push("--branch".into());
        args.push(branch.to_string());
        args.push("--single-branch".into());
    }
    args.push(url);
    args.push(dir.display().to_string());
    let status = Command::new("git")
        .args(&args)
        .status()
        .map_err(|err| format!("git clone falhou (está o git instalado?): {err}"))?;
    if !status.success() {
        return Err("git clone não concluiu com sucesso.".into());
    }
    Ok(())
}

pub async fn install(
    meta: &Path,
    workspace: &Path,
    repository: &str,
    asset_name: Option<String>,
    tag: Option<String>,
    confirm_wine: bool,
    on_progress: impl Fn(u32, &str),
) -> Result<InstallResult, String> {
    let apps = load_apps(meta);
    let app = find_app(&apps, repository)?.clone();
    crate::launcher::activity_log::info(
        "install",
        &format!("start folder={} repo={}", app.folder_name, app.repository),
    );
    let tag = tag.filter(|value| !value.trim().is_empty()).or(app.preferred_version.clone());
    let _ = store::migrate_legacy_install(workspace, &app);
    let dir = install_dir(workspace, &app);
    on_progress(2, "A procurar a release");
    let release = match github::fetch_release(meta, &app.repository, tag.as_deref(), None).await {
        Ok(Some(release)) => release,
        Ok(None) | Err(_) => {
            on_progress(10, "Sem release — a clonar via git");
            let branch = crate::launcher::runtime::selected_branch(meta, &app.folder_name);
            git_clone(&app.repository, &dir, branch.as_deref(), &on_progress)?;
            let _ = store::write_version(workspace, &app, "git");
            if dir.join("package.json").is_file() {
                on_progress(85, "A instalar dependências Node");
                crate::launcher::runners::node::ensure_dependencies(&dir)?;
            }
            ensure_launchfile_during_install(meta, workspace, &app, &on_progress).await?;
            on_progress(100, "Concluído");
            let mut done = result_message(format!("{} clonada de {}.", app.name, app.repository));
            done.installed_version = Some("git".into());
            return Ok(done);
        }
    };
    if installed_version(workspace, &app).as_deref() == Some(release.tag.as_str()) {
        let mut done = result_message(format!("{} já está na versão {}.", app.name, release.tag));
        done.installed_version = Some(release.tag);
        return Ok(done);
    }
    let names: Vec<String> = release.assets.iter().map(|asset| asset.name.clone()).collect();
    let platform = store::platform_of(&store::load_settings(meta));
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
    let temp = meta.join("Cache").join(format!("download-{}", store::icon_stem(&app)));
    let _ = fs::remove_dir_all(&temp);
    fs::create_dir_all(&temp).map_err(|err| err.to_string())?;
    let file_path = temp.join(&chosen.name);
    on_progress(10, "A transferir");
    github::download_file(meta, &chosen.url, &file_path, |percent| on_progress(percent, "A transferir")).await?;
    on_progress(95, "A instalar");
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    place_asset(&file_path, &dir, &chosen)?;
    store::write_version(workspace, &app, &release.tag)?;
    let _ = fs::remove_dir_all(&temp);
    let mut cache = store::load_version_cache(meta);
    github::cache_release(&mut cache, &app.repository, &release);
    store::save_version_cache(meta, &cache)?;
    ensure_launchfile_during_install(meta, workspace, &app, &on_progress).await?;
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

async fn ensure_launchfile_during_install(
    meta: &Path,
    workspace: &Path,
    app: &store::AppEntry,
    on_progress: &impl Fn(u32, &str),
) -> Result<(), String> {
    crate::launcher::launch::ensure_branch_launchfile(meta, workspace, app, &|percent, phase| {
        let mapped = 85 + (percent.min(100) * 14 / 100);
        on_progress(mapped.min(99), phase);
    })
    .await?;
    Ok(())
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


const AVATAR_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp", "gif"];

fn image_extension(source: &Path) -> Option<String> {
    source
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .filter(|ext| AVATAR_EXTENSIONS.contains(&ext.as_str()))
}

fn encode_webp(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let decoded = image::load_from_memory(bytes).map_err(|_| "O ficheiro não é uma imagem válida.".to_string())?;
    let rgba = decoded.to_rgba8();
    let mut output = Vec::new();
    image::codecs::webp::WebPEncoder::new_lossless(&mut output)
        .write_image(
            rgba.as_raw(),
            rgba.width(),
            rgba.height(),
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|_| "Não foi possível converter a imagem.".to_string())?;
    if output.len() < 12 || &output[..4] != b"RIFF" || &output[8..12] != b"WEBP" {
        return Err("Não foi possível converter a imagem.".into());
    }
    Ok(output)
}

/// `launch-info/avatar/icon.webp`, garantido dentro da pasta de configuração.
fn avatar_destination(info: &Path) -> Result<PathBuf, String> {
    if info.components().any(|part| matches!(part, Component::ParentDir)) {
        return Err("Caminho de avatar inválido.".into());
    }
    fs::create_dir_all(info).map_err(|err| err.to_string())?;
    let root = info.canonicalize().map_err(|err| err.to_string())?;
    let dir = info.join("avatar");
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let dir = dir.canonicalize().map_err(|err| err.to_string())?;
    if !dir.starts_with(&root) {
        return Err("Caminho de avatar inválido.".into());
    }
    let dest = dir.join("icon.webp");
    if dest.file_name().and_then(|name| name.to_str()) != Some("icon.webp") {
        return Err("Caminho de avatar inválido.".into());
    }
    Ok(dest)
}

fn remove_files_in(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if entry.path().is_file() {
            let _ = fs::remove_file(entry.path());
        }
    }
}

fn clear_stored_icons(meta: &Path, workspace: &Path, app: &store::AppEntry) {
    let info = store::launch_info_dir(workspace, app);
    remove_files_in(&info.join("avatar"));
    remove_files_in(&store::images_dir(workspace, app));
    if let Ok(entries) = fs::read_dir(meta.join("Cache").join("CustomIcons")) {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().starts_with(&store::icon_stem(app)) {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
    let cached = meta.join("Cache").join("Icons").join(format!("{}.img", store::icon_stem(app)));
    let _ = fs::remove_file(cached);
}

pub fn remember_icon(meta: &Path, workspace: &Path, repository: &str, source: &Path) -> Result<String, String> {
    if !source.is_file() {
        return Err("O ficheiro de imagem não existe.".into());
    }
    if image_extension(source).is_none() {
        return Err("Escolha uma imagem jpg, jpeg, png, webp ou gif.".into());
    }
    let mut bytes = Vec::new();
    fs::File::open(source)
        .and_then(|mut file| file.read_to_end(&mut bytes))
        .map_err(|err| err.to_string())?;
    if bytes.len() > 4_000_000 {
        return Err("A imagem passa de 4 MB.".into());
    }
    let webp = encode_webp(&bytes)?;
    let apps = load_apps(meta);
    let app = find_app(&apps, repository)?.clone();
    let info = store::ensure_launch_info(workspace, &app)?;
    let dest = avatar_destination(&info)?;
    clear_stored_icons(meta, workspace, &app);
    fs::create_dir_all(dest.parent().unwrap_or(&info)).map_err(|err| err.to_string())?;
    fs::write(&dest, &webp).map_err(|err| err.to_string())?;
    Ok(dest.display().to_string())
}

pub fn clear_icon(meta: &Path, workspace: &Path, repository: &str) -> Result<(), String> {
    let apps = load_apps(meta);
    let app = find_app(&apps, repository)?.clone();
    clear_stored_icons(meta, workspace, &app);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::launcher::store::{self, AppEntry};
    use image::ImageFormat;
    use std::fs;

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("painel-avatar-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        store::ensure_root(&root).unwrap();
        root
    }

    fn sample(path: &Path, format: ImageFormat) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        if format == ImageFormat::Jpeg {
            image::RgbImage::from_pixel(3, 2, image::Rgb([12, 34, 56]))
                .save_with_format(path, format)
                .unwrap();
            return;
        }
        image::RgbaImage::from_pixel(3, 2, image::Rgba([12, 34, 56, 255]))
            .save_with_format(path, format)
            .unwrap();
    }

    fn seed(root: &Path) -> AppEntry {
        store::upsert_app(
            root,
            AppEntry {
                name: "Hello".into(),
                repository: "acme/hello".into(),
                folder_name: "hello".into(),
                install_path: None,
                app_icon_url: None,
                preferred_version: None,
                skipped_update_version: None,
            },
            None,
        )
        .unwrap()
    }

    #[test]
    fn avatar_is_webp_under_launch_info_not_beside_branch_launchfile() {
        let root = temp_root("webp");
        let app = seed(&root);
        let info = store::launch_info_dir(&root, &app);
        let launchfile = store::branch_launch_dir(&info, "master").join("Launchfile");
        fs::create_dir_all(launchfile.parent().unwrap()).unwrap();
        fs::write(&launchfile, "name: hello\ncommands:\n  start:\n    - echo hi\n").unwrap();
        let source = root.join("picked.png");
        sample(&source, ImageFormat::Png);

        let saved = remember_icon(&root, &root, "hello", &source).unwrap();
        let dest = PathBuf::from(&saved);
        let expected = store::project_avatar_path(&info);
        assert_eq!(dest.canonicalize().unwrap(), expected.canonicalize().unwrap());
        assert!(expected.ends_with(Path::new("launch-info").join("avatar").join("icon.webp")));
        assert!(!saved.contains("branches"));
        let bytes = fs::read(&dest).unwrap();
        assert_eq!(&bytes[..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WEBP");
        assert!(source.is_file(), "o original escolhido fica no sítio");
        let names: Vec<_> = fs::read_dir(dest.parent().unwrap())
            .unwrap()
            .flatten()
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["icon.webp".to_string()]);
        assert_eq!(fs::read_to_string(&launchfile).unwrap(), "name: hello\ncommands:\n  start:\n    - echo hi\n");

        for (name, format) in [
            ("photo.jpg", ImageFormat::Jpeg),
            ("photo.jpeg", ImageFormat::Jpeg),
            ("anim.gif", ImageFormat::Gif),
            ("already.webp", ImageFormat::WebP),
        ] {
            let file = root.join(name);
            sample(&file, format);
            let again = PathBuf::from(remember_icon(&root, &root, "hello", &file).unwrap());
            assert_eq!(again, dest);
            let encoded = fs::read(&again).unwrap();
            assert_eq!(&encoded[..4], b"RIFF");
            assert_eq!(&encoded[8..12], b"WEBP");
            assert!(file.is_file());
        }

        clear_icon(&root, &root, "hello").unwrap();
        assert!(!dest.exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn rejects_non_images_without_writing_avatar() {
        let root = temp_root("reject");
        let app = seed(&root);
        let dest = store::project_avatar_path(&store::launch_info_dir(&root, &app));
        let text = root.join("notes.txt");
        fs::write(&text, b"not an image").unwrap();
        let err = remember_icon(&root, &root, "hello", &text).unwrap_err();
        assert!(err.contains("jpg"));
        assert!(!dest.exists());

        let fake = root.join("fake.png");
        fs::write(&fake, b"not really a png").unwrap();
        let err = remember_icon(&root, &root, "hello", &fake).unwrap_err();
        assert!(err.contains("não é uma imagem"));
        assert!(!dest.exists());
        let _ = fs::remove_dir_all(&root);
    }
}
