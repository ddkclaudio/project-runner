use super::{
    CandidateKind, LaunchCandidate, LaunchConfigSave, LaunchConfigView, LaunchField, ProjectRunner,
};
use std::fs;
use std::path::{Path, PathBuf};

pub struct BinaryRunner;

#[allow(dead_code)]
pub fn read_executables(dir: &Path) -> Vec<String> {
    find_binaries(dir)
        .into_iter()
        .map(|path| path.display().to_string())
        .collect()
}

fn path_depth(root: &Path, path: &Path) -> usize {
    path.strip_prefix(root)
        .map(|rel| rel.components().count())
        .unwrap_or(99)
}

fn is_launchable(path: &Path) -> bool {
    if !path.is_file() && !path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("app")) {
        return false;
    }
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .to_lowercase();
    if matches!(
        name.as_str(),
        "version.txt" | "lastplayed.txt" | "selected_executable.txt"
    ) {
        return false;
    }
    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();
    if cfg!(windows) {
        matches!(ext.as_str(), "exe" | "bat" | "cmd")
    } else if cfg!(target_os = "macos") {
        matches!(ext.as_str(), "app" | "sh" | "command" | "")
    } else {
        matches!(
            ext.as_str(),
            "" | "appimage" | "sh" | "bin" | "exe" | "x86_64" | "app" | "arm64" | "aarch64"
        )
    }
}

fn collect(dir: &Path, recursive: bool, into: &mut Vec<PathBuf>, depth: usize) {
    if depth > 4 || into.len() > 200 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
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

fn find_binaries(dir: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    collect(dir, false, &mut found, 0);
    if found.is_empty() {
        collect(dir, true, &mut found, 0);
    }
    found.sort_by(|a, b| {
        path_depth(dir, a)
            .cmp(&path_depth(dir, b))
            .then(
                a.file_name()
                    .unwrap_or_default()
                    .cmp(b.file_name().unwrap_or_default()),
            )
    });
    found
}

impl ProjectRunner for BinaryRunner {
    fn id(&self) -> &'static str {
        "binary"
    }

    fn label(&self) -> &'static str {
        "Binário"
    }

    fn detect(&self, root: &Path) -> bool {
        // Fallback: sempre “detecta”; active_runner só chega aqui se nada mais casar.
        let _ = root;
        true
    }

    fn candidates(&self, root: &Path) -> Result<Vec<LaunchCandidate>, String> {
        let found = find_binaries(root);
        Ok(found
            .into_iter()
            .map(|path| {
                let rel = path
                    .strip_prefix(root)
                    .map(|item| item.display().to_string().replace('\\', "/"))
                    .unwrap_or_else(|_| path.display().to_string());
                LaunchCandidate {
                    id: rel.clone(),
                    label: rel,
                    kind: CandidateKind::Binary,
                }
            })
            .collect())
    }

    fn config_view(&self, root: &Path) -> Result<LaunchConfigView, String> {
        let _ = root;
        Ok(LaunchConfigView {
            runner_id: self.id().into(),
            runner_label: self.label().into(),
            config_path: None,
            relative_path: None,
            editable: false,
            fields: vec![LaunchField::text(
                "hint",
                "Dica",
                "Escolha um executável na lista, ou crie painel.launch.json para um comando custom.",
            )],
            raw: String::new(),
            raw_language: "text".into(),
            can_create_manifest: true,
        })
    }

    fn save_config(&self, root: &Path, input: &LaunchConfigSave) -> Result<LaunchConfigView, String> {
        if input.create_manifest.unwrap_or(false) {
            return super::create_default_manifest(root);
        }
        Err("Runner binário não edita ficheiro de projecto. Crie um painel.launch.json.".into())
    }
}
