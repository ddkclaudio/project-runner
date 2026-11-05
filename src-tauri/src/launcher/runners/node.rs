use super::{
    relative_to, run_command_wait, write_text, CandidateKind, LaunchCandidate, LaunchConfigSave,
    LaunchConfigView, LaunchField, ProjectRunner,
};
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

#[allow(dead_code)]
pub struct NodeRunner;

fn path(root: &Path) -> std::path::PathBuf {
    root.join("package.json")
}

fn install_command(root: &Path) -> &'static str {
    if root.join("pnpm-lock.yaml").is_file() {
        "pnpm install"
    } else if root.join("yarn.lock").is_file() {
        "yarn install"
    } else if root.join("bun.lockb").is_file() || root.join("bun.lock").is_file() {
        "bun install"
    } else {
        "npm install"
    }
}

/// Instala dependências se `node_modules` ainda não existir.
pub fn ensure_dependencies(root: &Path) -> Result<(), String> {
    if !path(root).is_file() {
        return Ok(());
    }
    let modules = root.join("node_modules");
    if modules.is_dir() {
        // Já instalado — evita demorar a cada arranque.
        return Ok(());
    }
    let cmd = install_command(root);
    run_command_wait(root, cmd)
        .map_err(|err| format!("Não foi possível instalar dependências Node (`{cmd}`): {err}"))
}

#[allow(dead_code)]
fn scripts(root: &Path) -> Result<(Value, Vec<(String, String)>), String> {
    let raw = fs::read_to_string(path(root)).map_err(|err| err.to_string())?;
    let value: Value = serde_json::from_str(raw.trim_start_matches('\u{feff}')).map_err(|err| err.to_string())?;
    let mut list = Vec::new();
    if let Some(map) = value.get("scripts").and_then(|item| item.as_object()) {
        for (key, val) in map {
            if let Some(cmd) = val.as_str() {
                list.push((key.clone(), cmd.to_string()));
            }
        }
    }
    Ok((value, list))
}

impl ProjectRunner for NodeRunner {
    fn id(&self) -> &'static str {
        "node"
    }

    fn label(&self) -> &'static str {
        "Node"
    }

    fn detect(&self, root: &Path) -> bool {
        path(root).is_file()
    }

    fn candidates(&self, root: &Path) -> Result<Vec<LaunchCandidate>, String> {
        let (_, scripts) = scripts(root)?;
        let mut out = Vec::new();
        for preferred in ["start", "dev"] {
            if let Some((_, cmd)) = scripts.iter().find(|(name, _)| name == preferred) {
                out.push(LaunchCandidate {
                    id: format!("npm:{preferred}"),
                    label: format!("npm run {preferred} ({cmd})"),
                    kind: CandidateKind::Command,
                });
            }
        }
        for (name, cmd) in scripts {
            if name == "start" || name == "dev" {
                continue;
            }
            out.push(LaunchCandidate {
                id: format!("npm:{name}"),
                label: format!("npm run {name} ({cmd})"),
                kind: CandidateKind::Command,
            });
        }
        if out.is_empty() {
            return Err("package.json sem scripts.start/dev.".into());
        }
        Ok(out)
    }

    fn config_view(&self, root: &Path) -> Result<LaunchConfigView, String> {
        let file = path(root);
        let raw = fs::read_to_string(&file).map_err(|err| err.to_string())?;
        let (value, scripts) = scripts(root)?;
        let active = if scripts.iter().any(|(name, _)| name == "start") {
            "start"
        } else if scripts.iter().any(|(name, _)| name == "dev") {
            "dev"
        } else {
            scripts.first().map(|(name, _)| name.as_str()).unwrap_or("start")
        };
        let start_cmd = value
            .pointer("/scripts/start")
            .and_then(|item| item.as_str())
            .unwrap_or("")
            .to_string();
        let dev_cmd = value
            .pointer("/scripts/dev")
            .and_then(|item| item.as_str())
            .unwrap_or("")
            .to_string();
        Ok(LaunchConfigView {
            runner_id: self.id().into(),
            runner_label: self.label().into(),
            config_path: Some(file.display().to_string()),
            relative_path: Some(relative_to(root, &file)),
            editable: true,
            fields: vec![
                LaunchField::text("active", "Script activo", active),
                LaunchField::text("start", "scripts.start", start_cmd),
                LaunchField::text("dev", "scripts.dev", dev_cmd),
            ],
            raw,
            raw_language: "json".into(),
            can_create_manifest: true,
        })
    }

    fn save_config(&self, root: &Path, input: &LaunchConfigSave) -> Result<LaunchConfigView, String> {
        let file = path(root);
        if let Some(raw) = &input.raw {
            write_text(&file, raw)?;
            return self.config_view(root);
        }
        let raw = fs::read_to_string(&file).map_err(|err| err.to_string())?;
        let mut value: Value = serde_json::from_str(raw.trim_start_matches('\u{feff}')).map_err(|err| err.to_string())?;
        let scripts = value
            .as_object_mut()
            .ok_or_else(|| "package.json inválido.".to_string())?
            .entry("scripts".to_string())
            .or_insert_with(|| json!({}));
        let map = scripts
            .as_object_mut()
            .ok_or_else(|| "scripts inválido.".to_string())?;
        if let Some(fields) = &input.fields {
            for field in fields {
                if field.key == "start" || field.key == "dev" {
                    if field.value.trim().is_empty() {
                        map.remove(&field.key);
                    } else {
                        map.insert(field.key.clone(), json!(field.value.trim()));
                    }
                }
            }
        }
        let pretty = serde_json::to_string_pretty(&value).map_err(|err| err.to_string())?;
        write_text(&file, &pretty)?;
        self.config_view(root)
    }
}
