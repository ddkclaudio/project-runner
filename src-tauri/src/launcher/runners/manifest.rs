use super::{
    relative_to, spawn_command_line_with_env, write_text, CandidateKind, LaunchCandidate,
    LaunchConfigSave, LaunchConfigView, LaunchField, ProjectRunner,
};
use crate::launcher::launchfile::{self, LaunchfileDoc};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

pub struct ManifestRunner;

impl ProjectRunner for ManifestRunner {
    fn id(&self) -> &'static str {
        "launchfile"
    }

    fn label(&self) -> &'static str {
        "Launchfile"
    }

    fn detect(&self, root: &Path) -> bool {
        launchfile::exists(root)
    }

    fn candidates(&self, root: &Path) -> Result<Vec<LaunchCandidate>, String> {
        let doc = launchfile::read(root)?;
        Ok(vec![LaunchCandidate {
            id: format!("cmd:{}", doc.start),
            label: doc.start.clone(),
            kind: CandidateKind::Command,
        }])
    }

    fn spawn(
        &self,
        root: &Path,
        candidate: &LaunchCandidate,
        _settings: &Value,
    ) -> Result<Option<(u32, String)>, String> {
        let doc = launchfile::read(root)?;
        let command = candidate
            .id
            .strip_prefix("cmd:")
            .unwrap_or(candidate.id.as_str());
        let command = if command.is_empty() {
            doc.start.as_str()
        } else {
            command
        };
        let work = doc
            .cwd
            .as_ref()
            .map(|item| root.join(item))
            .filter(|path| path.is_dir());
        spawn_command_line_with_env(root, command, work.as_deref(), &doc.env, None)
    }

    fn config_view(&self, root: &Path) -> Result<LaunchConfigView, String> {
        let file = launchfile::path(root);
        let (raw, doc) = if file.is_file() {
            let raw = fs::read_to_string(&file).map_err(|err| err.to_string())?;
            let doc = launchfile::parse(&raw)?;
            (raw, doc)
        } else {
            let name = root
                .file_name()
                .and_then(|item| item.to_str())
                .unwrap_or("app");
            let raw = launchfile::template_raw(name);
            let doc = launchfile::parse(&raw).unwrap_or_default();
            (raw, doc)
        };
        Ok(view_from(root, &file, &raw, &doc))
    }

    fn save_config(&self, root: &Path, input: &LaunchConfigSave) -> Result<LaunchConfigView, String> {
        if let Some(raw) = input.raw.as_ref() {
            launchfile::write_raw(root, raw)?;
            return self.config_view(root);
        }
        let fields = input.fields.clone().unwrap_or_default();
        let get = |key: &str| {
            fields
                .iter()
                .find(|item| item.key == key)
                .map(|item| item.value.clone())
                .unwrap_or_default()
        };
        let mut env = BTreeMap::new();
        for item in &fields {
            if let Some(name) = item.key.strip_prefix("env.") {
                let name = name.trim();
                if !name.is_empty() {
                    env.insert(name.to_string(), item.value.clone());
                }
            }
        }
        // Compat: bloco antigo "CHAVE=valor" por linha.
        for line in get("env").lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                env.insert(k.trim().to_string(), v.trim().to_string());
            }
        }
        let port = get("port").trim().parse().ok();
        let doc = LaunchfileDoc {
            version: "launch/v1".into(),
            name: {
                let name = get("name");
                if name.trim().is_empty() {
                    "app".into()
                } else {
                    name
                }
            },
            runtime: {
                let runtime = get("runtime");
                if runtime.trim().is_empty() {
                    "other".into()
                } else {
                    runtime
                }
            },
            kind: {
                let kind = get("kind");
                if kind.trim().is_empty() {
                    "cli".into()
                } else {
                    kind
                }
            },
            port,
            url: Some(get("url")).filter(|item| !item.trim().is_empty()),
            cwd: Some(get("cwd")).filter(|item| !item.trim().is_empty()),
            install: Some(get("install")).filter(|item| !item.trim().is_empty()),
            start: {
                let start = get("start");
                if start.trim().is_empty() {
                    "npm start".into()
                } else {
                    start
                }
            },
            env,
        };
        launchfile::write(root, &doc)?;
        self.config_view(root)
    }
}

fn infer_env_field_type(key: &str, value: &str) -> &'static str {
    let key_u = key.to_ascii_uppercase();
    let v = value.trim();
    if matches!(
        v.to_ascii_lowercase().as_str(),
        "true" | "false" | "yes" | "no" | "on" | "off"
    ) {
        return "boolean";
    }
    if v.starts_with("http://") || v.starts_with("https://") {
        return "url";
    }
    if key_u.contains("URL") || key_u.ends_with("_URI") || key_u == "HOMEPAGE" {
        return "url";
    }
    if !v.is_empty() && v.parse::<f64>().is_ok() {
        return "number";
    }
    if key_u == "PORT" || key_u.ends_with("_PORT") {
        return "number";
    }
    "text"
}

fn view_from(root: &Path, file: &Path, raw: &str, doc: &LaunchfileDoc) -> LaunchConfigView {
    let mut fields = vec![
        LaunchField::text("name", "Nome", doc.name.clone()),
        LaunchField::text("runtime", "Runtime", doc.runtime.clone()),
        LaunchField::text("kind", "Tipo (site/api/desktop/cli)", doc.kind.clone()),
        LaunchField::typed(
            "port",
            "Porta",
            doc.port.map(|item| item.to_string()).unwrap_or_default(),
            "number",
        ),
        LaunchField::typed("url", "URL Abrir", doc.url.clone().unwrap_or_default(), "url"),
        LaunchField::text(
            "cwd",
            "Pasta de trabalho",
            doc.cwd.clone().unwrap_or_else(|| ".".into()),
        ),
        LaunchField::text("install", "Comando install", doc.install.clone().unwrap_or_default()),
        LaunchField::text("start", "Comando start", doc.start.clone()),
    ];
    for (key, value) in &doc.env {
        fields.push(LaunchField::typed(
            format!("env.{key}"),
            format!("Env · {key}"),
            value.clone(),
            infer_env_field_type(key, value),
        ));
    }
    LaunchConfigView {
        runner_id: "launchfile".into(),
        runner_label: "Launchfile".into(),
        config_path: Some(file.display().to_string()),
        relative_path: Some(relative_to(root, file)),
        editable: true,
        fields,
        raw: raw.to_string(),
        raw_language: "yaml".into(),
        can_create_manifest: false,
    }
}

pub(crate) fn create_default_launchfile(root: &Path) -> Result<LaunchConfigView, String> {
    if launchfile::exists(root) {
        return ManifestRunner.config_view(root);
    }
    let name = root
        .file_name()
        .and_then(|item| item.to_str())
        .unwrap_or("app");
    write_text(&launchfile::path(root), &launchfile::template_raw(name))?;
    ManifestRunner.config_view(root)
}
