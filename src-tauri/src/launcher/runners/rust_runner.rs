use super::{
    relative_to, write_text, CandidateKind, LaunchCandidate, LaunchConfigSave, LaunchConfigView,
    LaunchField, ProjectRunner,
};
use serde_json::Value;
use std::fs;
use std::path::Path;

pub struct RustRunner;

fn path(root: &Path) -> std::path::PathBuf {
    root.join("Cargo.toml")
}

impl ProjectRunner for RustRunner {
    fn id(&self) -> &'static str {
        "rust"
    }

    fn label(&self) -> &'static str {
        "Rust"
    }

    fn detect(&self, root: &Path) -> bool {
        path(root).is_file()
    }

    fn candidates(&self, root: &Path) -> Result<Vec<LaunchCandidate>, String> {
        let _ = root;
        Ok(vec![
            LaunchCandidate {
                id: "cargo:run".into(),
                label: "cargo run".into(),
                kind: CandidateKind::Command,
            },
            LaunchCandidate {
                id: "cargo:run-release".into(),
                label: "cargo run --release".into(),
                kind: CandidateKind::Command,
            },
        ])
    }

    fn config_view(&self, root: &Path) -> Result<LaunchConfigView, String> {
        let file = path(root);
        let raw = fs::read_to_string(&file).map_err(|err| err.to_string())?;
        let args = if root.join("painel.launch.json").is_file() {
            let text = fs::read_to_string(root.join("painel.launch.json")).unwrap_or_default();
            serde_json::from_str::<Value>(&text)
                .ok()
                .and_then(|value| {
                    value
                        .get("start")
                        .and_then(|item| item.as_str())
                        .map(|item| item.trim_start_matches("cargo run").trim().to_string())
                })
                .unwrap_or_default()
        } else {
            String::new()
        };
        Ok(LaunchConfigView {
            runner_id: self.id().into(),
            runner_label: self.label().into(),
            config_path: Some(file.display().to_string()),
            relative_path: Some(relative_to(root, &file)),
            editable: false,
            fields: vec![LaunchField::text(
                "args",
                "Args extra (grava painel.launch.json)",
                args,
            )],
            raw,
            raw_language: "toml".into(),
            can_create_manifest: true,
        })
    }

    fn save_config(&self, root: &Path, input: &LaunchConfigSave) -> Result<LaunchConfigView, String> {
        // Não reescreve Cargo.toml; args → painel.launch.json
        if let Some(raw) = &input.raw {
            // permitir só se pedirem create via outro fluxo; ignorar raw no Cargo
            let _ = raw;
        }
        let args = input
            .fields
            .as_ref()
            .and_then(|fields| fields.iter().find(|item| item.key == "args"))
            .map(|item| item.value.trim().to_string())
            .unwrap_or_default();
        let start = if args.is_empty() {
            "cargo run".to_string()
        } else {
            format!("cargo run {args}")
        };
        let payload = serde_json::json!({
            "version": 1,
            "start": start,
            "cwd": ".",
            "env": {}
        });
        write_text(
            &root.join("painel.launch.json"),
            &serde_json::to_string_pretty(&payload).map_err(|err| err.to_string())?,
        )?;
        // Após criar manifesto, a vista passa a ser do manifest runner no próximo get;
        // aqui devolvemos vista rust actualizada.
        self.config_view(root)
    }
}
