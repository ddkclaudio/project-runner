use super::{
    relative_to, spawn_command_line, write_text, CandidateKind, LaunchCandidate, LaunchConfigSave,
    LaunchConfigView, LaunchField, ProjectRunner,
};
use serde_json::Value;
use std::fs;
use std::path::Path;

pub struct ProcfileRunner;

fn path(root: &Path) -> std::path::PathBuf {
    root.join("Procfile")
}

fn parse(raw: &str) -> Vec<(String, String)> {
    let mut items = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((name, cmd)) = trimmed.split_once(':') {
            let name = name.trim().to_string();
            let cmd = cmd.trim().to_string();
            if !name.is_empty() && !cmd.is_empty() {
                items.push((name, cmd));
            }
        }
    }
    items
}

impl ProjectRunner for ProcfileRunner {
    fn id(&self) -> &'static str {
        "procfile"
    }

    fn label(&self) -> &'static str {
        "Procfile"
    }

    fn detect(&self, root: &Path) -> bool {
        path(root).is_file()
    }

    fn candidates(&self, root: &Path) -> Result<Vec<LaunchCandidate>, String> {
        let raw = fs::read_to_string(path(root)).map_err(|err| err.to_string())?;
        let mut items = parse(&raw);
        if items.is_empty() {
            return Err("Procfile sem processos.".into());
        }
        items.sort_by(|a, b| {
            let rank = |name: &str| if name == "web" { 0 } else { 1 };
            rank(&a.0).cmp(&rank(&b.0)).then(a.0.cmp(&b.0))
        });
        Ok(items
            .into_iter()
            .map(|(name, cmd)| LaunchCandidate {
                id: format!("proc:{name}"),
                label: format!("{name}: {cmd}"),
                kind: CandidateKind::Command,
            })
            .collect())
    }

    fn spawn(
        &self,
        root: &Path,
        candidate: &LaunchCandidate,
        _settings: &Value,
    ) -> Result<Option<(u32, String)>, String> {
        let raw = fs::read_to_string(path(root)).map_err(|err| err.to_string())?;
        let items = parse(&raw);
        let name = candidate.id.strip_prefix("proc:").unwrap_or("");
        let cmd = items
            .iter()
            .find(|(item, _)| item == name)
            .map(|(_, cmd)| cmd.clone())
            .or_else(|| items.first().map(|(_, cmd)| cmd.clone()))
            .ok_or_else(|| "Processo do Procfile em falta.".to_string())?;
        spawn_command_line(root, &cmd, None)
    }

    fn config_view(&self, root: &Path) -> Result<LaunchConfigView, String> {
        let file = path(root);
        let raw = fs::read_to_string(&file).map_err(|err| err.to_string())?;
        let items = parse(&raw);
        let web = items
            .iter()
            .find(|(name, _)| name == "web")
            .map(|(_, cmd)| cmd.clone())
            .unwrap_or_default();
        Ok(LaunchConfigView {
            runner_id: self.id().into(),
            runner_label: self.label().into(),
            config_path: Some(file.display().to_string()),
            relative_path: Some(relative_to(root, &file)),
            editable: true,
            fields: vec![LaunchField::text("web", "Processo web", web)],
            raw,
            raw_language: "text".into(),
            can_create_manifest: true,
        })
    }

    fn save_config(&self, root: &Path, input: &LaunchConfigSave) -> Result<LaunchConfigView, String> {
        let file = path(root);
        if let Some(raw) = &input.raw {
            write_text(&file, raw)?;
            return self.config_view(root);
        }
        let mut raw = fs::read_to_string(&file).unwrap_or_default();
        if let Some(web) = input
            .fields
            .as_ref()
            .and_then(|fields| fields.iter().find(|item| item.key == "web"))
        {
            let mut lines = Vec::new();
            let mut replaced = false;
            for line in raw.lines() {
                if line.trim_start().starts_with("web:") {
                    lines.push(format!("web: {}", web.value.trim()));
                    replaced = true;
                } else {
                    lines.push(line.to_string());
                }
            }
            if !replaced {
                lines.insert(0, format!("web: {}", web.value.trim()));
            }
            raw = lines.join("\n");
            if !raw.ends_with('\n') {
                raw.push('\n');
            }
        }
        write_text(&file, &raw)?;
        self.config_view(root)
    }
}
