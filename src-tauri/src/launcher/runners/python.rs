use super::{
    relative_to, spawn_command_line, write_text, CandidateKind, LaunchCandidate, LaunchConfigSave,
    LaunchConfigView, LaunchField, ProjectRunner,
};
use serde_json::Value;
use std::fs;
use std::path::Path;

pub struct PythonRunner;

impl ProjectRunner for PythonRunner {
    fn id(&self) -> &'static str {
        "python"
    }

    fn label(&self) -> &'static str {
        "Python"
    }

    fn detect(&self, root: &Path) -> bool {
        root.join("pyproject.toml").is_file()
            || root.join("requirements.txt").is_file()
            || root.join("main.py").is_file()
    }

    fn candidates(&self, root: &Path) -> Result<Vec<LaunchCandidate>, String> {
        let mut out = Vec::new();
        if root.join("main.py").is_file() {
            out.push(LaunchCandidate {
                id: "py:main".into(),
                label: "python main.py".into(),
                kind: CandidateKind::Command,
            });
        }
        if root.join("app.py").is_file() {
            out.push(LaunchCandidate {
                id: "py:app".into(),
                label: "python app.py".into(),
                kind: CandidateKind::Command,
            });
        }
        if root.join("manage.py").is_file() {
            out.push(LaunchCandidate {
                id: "py:django".into(),
                label: "python manage.py runserver".into(),
                kind: CandidateKind::Command,
            });
        }
        if out.is_empty() {
            out.push(LaunchCandidate {
                id: "py:module".into(),
                label: "python -m app".into(),
                kind: CandidateKind::Command,
            });
        }
        Ok(out)
    }

    fn spawn(
        &self,
        root: &Path,
        candidate: &LaunchCandidate,
        _settings: &Value,
    ) -> Result<Option<(u32, String)>, String> {
        let line = match candidate.id.as_str() {
            "py:main" => "python main.py",
            "py:app" => "python app.py",
            "py:django" => "python manage.py runserver",
            "py:module" => "python -m app",
            other if other.starts_with("cmd:") => other.strip_prefix("cmd:").unwrap_or(other),
            _ => candidate.label.as_str(),
        };
        spawn_command_line(root, line, None)
    }

    fn config_view(&self, root: &Path) -> Result<LaunchConfigView, String> {
        let file = if root.join("pyproject.toml").is_file() {
            root.join("pyproject.toml")
        } else if root.join("requirements.txt").is_file() {
            root.join("requirements.txt")
        } else {
            root.join("main.py")
        };
        let raw = if file.is_file() {
            fs::read_to_string(&file).unwrap_or_default()
        } else {
            String::new()
        };
        let command = if root.join("main.py").is_file() {
            "python main.py"
        } else if root.join("manage.py").is_file() {
            "python manage.py runserver"
        } else {
            "python -m app"
        };
        Ok(LaunchConfigView {
            runner_id: self.id().into(),
            runner_label: self.label().into(),
            config_path: if file.is_file() {
                Some(file.display().to_string())
            } else {
                None
            },
            relative_path: if file.is_file() {
                Some(relative_to(root, &file))
            } else {
                None
            },
            editable: file.is_file(),
            fields: vec![LaunchField::text(
                "command",
                "Comando sugerido (use painel.launch.json para fixar)",
                command,
            )],
            raw,
            raw_language: if file.extension().is_some_and(|ext| ext == "toml") {
                "toml".into()
            } else if file.extension().is_some_and(|ext| ext == "py") {
                "python".into()
            } else {
                "text".into()
            },
            can_create_manifest: true,
        })
    }

    fn save_config(&self, root: &Path, input: &LaunchConfigSave) -> Result<LaunchConfigView, String> {
        let file = if root.join("pyproject.toml").is_file() {
            root.join("pyproject.toml")
        } else if root.join("requirements.txt").is_file() {
            root.join("requirements.txt")
        } else {
            root.join("main.py")
        };
        if let Some(raw) = &input.raw {
            if file.is_file() || file.extension().is_some() {
                write_text(&file, raw)?;
            }
        }
        // Campos tipados: se command custom, criar manifesto
        if let Some(cmd) = input
            .fields
            .as_ref()
            .and_then(|fields| fields.iter().find(|item| item.key == "command"))
        {
            if !cmd.value.trim().is_empty() && !root.join("painel.launch.json").is_file() {
                let payload = serde_json::json!({
                    "version": 1,
                    "start": cmd.value.trim(),
                    "cwd": ".",
                    "env": {}
                });
                write_text(
                    &root.join("painel.launch.json"),
                    &serde_json::to_string_pretty(&payload).map_err(|err| err.to_string())?,
                )?;
            }
        }
        self.config_view(root)
    }
}
