use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchfileDoc {
    pub version: String,
    pub name: String,
    pub runtime: String,
    pub kind: String,
    pub port: Option<u16>,
    pub url: Option<String>,
    pub cwd: Option<String>,
    pub install: Option<String>,
    pub start: String,
    pub env: BTreeMap<String, String>,
}

pub fn path(root: &Path) -> PathBuf {
    root.join("Launchfile")
}

pub fn exists(root: &Path) -> bool {
    path(root).is_file()
}

pub fn read(root: &Path) -> Result<LaunchfileDoc, String> {
    let file = path(root);
    if !file.is_file() {
        return Err("Launchfile em falta.".into());
    }
    let raw = fs::read_to_string(&file).map_err(|err| err.to_string())?;
    parse(&raw)
}

pub fn write(root: &Path, doc: &LaunchfileDoc) -> Result<(), String> {
    validate(doc)?;
    let raw = serialize(doc);
    fs::write(path(root), raw).map_err(|err| err.to_string())
}

pub fn write_raw(root: &Path, raw: &str) -> Result<LaunchfileDoc, String> {
    let doc = parse(raw)?;
    validate(&doc)?;
    fs::write(path(root), raw).map_err(|err| err.to_string())?;
    Ok(doc)
}

pub fn validate(doc: &LaunchfileDoc) -> Result<(), String> {
    if doc.start.trim().is_empty() {
        return Err("Launchfile sem commands.start.".into());
    }
    Ok(())
}

/// Porta efectiva: campo `port` ou `env.PORT` / `env.PORTA`.
pub fn effective_port(doc: &LaunchfileDoc) -> Option<u16> {
    if let Some(port) = doc.port {
        return Some(port);
    }
    for key in ["PORT", "Port", "port", "PORTA"] {
        if let Some(raw) = doc.env.get(key) {
            if let Ok(port) = raw.trim().parse::<u16>() {
                if port > 0 {
                    return Some(port);
                }
            }
        }
    }
    None
}

pub fn open_url_of(doc: &LaunchfileDoc) -> Option<String> {
    if let Some(url) = doc.url.as_ref().map(|item| item.trim()).filter(|item| !item.is_empty()) {
        return Some(url.to_string());
    }
    if let Some(port) = effective_port(doc) {
        let kind = doc.kind.to_lowercase();
        if kind == "site" || kind == "api" {
            return Some(format!("http://localhost:{port}"));
        }
    }
    None
}

pub fn needs_install(root: &Path, doc: &LaunchfileDoc) -> bool {
    let Some(install) = doc.install.as_ref().map(|item| item.trim()).filter(|item| !item.is_empty()) else {
        return false;
    };
    let _ = install;
    match doc.runtime.to_lowercase().as_str() {
        "node" => !root.join("node_modules").is_dir(),
        "python" => {
            !root.join(".venv").is_dir()
                && !root.join("venv").is_dir()
                && !root.join(".venv").join("Scripts").is_dir()
        }
        "rust" => true,
        _ => true,
    }
}

pub fn template_raw(name: &str) -> String {
    format!(
        r#"# Launchfile — manifesto de arranque do Painel
version: launch/v1
name: {name}
runtime: node
kind: site
port: 3000
url: http://localhost:3000
cwd: .
commands:
  install: "npm install"
  start: "npm start"
env:
  PORT: "3000"
"#
    )
}

pub fn serialize(doc: &LaunchfileDoc) -> String {
    let mut out = String::new();
    out.push_str("# Launchfile — manifesto de arranque do Painel\n");
    out.push_str(&format!(
        "version: {}\n",
        if doc.version.trim().is_empty() {
            "launch/v1"
        } else {
            doc.version.trim()
        }
    ));
    out.push_str(&format!("name: {}\n", yaml_scalar(&doc.name)));
    out.push_str(&format!("runtime: {}\n", yaml_scalar(&doc.runtime)));
    out.push_str(&format!("kind: {}\n", yaml_scalar(&doc.kind)));
    if let Some(port) = doc.port {
        out.push_str(&format!("port: {port}\n"));
    }
    if let Some(url) = doc.url.as_ref().map(|item| item.trim()).filter(|item| !item.is_empty()) {
        out.push_str(&format!("url: {}\n", yaml_scalar(url)));
    }
    let cwd = doc
        .cwd
        .as_ref()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .unwrap_or(".");
    out.push_str(&format!("cwd: {}\n", yaml_scalar(cwd)));
    out.push_str("commands:\n");
    if let Some(install) = doc
        .install
        .as_ref()
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
    {
        out.push_str(&format!("  install: {}\n", yaml_quoted(install)));
    }
    out.push_str(&format!("  start: {}\n", yaml_quoted(doc.start.trim())));
    if !doc.env.is_empty() {
        out.push_str("env:\n");
        for (key, value) in &doc.env {
            out.push_str(&format!("  {}: {}\n", key, yaml_quoted(value)));
        }
    }
    out
}

pub fn parse(raw: &str) -> Result<LaunchfileDoc, String> {
    let mut doc = LaunchfileDoc {
        version: "launch/v1".into(),
        name: "app".into(),
        runtime: "other".into(),
        kind: "cli".into(),
        ..LaunchfileDoc::default()
    };
    let mut section = Section::Root;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let indent = line.len() - line.trim_start().len();
        if indent == 0 {
            if trimmed == "commands:" {
                section = Section::Commands;
                continue;
            }
            if trimmed == "env:" {
                section = Section::Env;
                continue;
            }
            section = Section::Root;
            if let Some((key, value)) = split_kv(trimmed) {
                match key {
                    "version" => doc.version = unquote(value),
                    "name" => doc.name = unquote(value),
                    "runtime" => doc.runtime = unquote(value),
                    "kind" => doc.kind = unquote(value),
                    "port" => {
                        doc.port = unquote(value).parse().ok();
                    }
                    "url" => doc.url = Some(unquote(value)).filter(|item| !item.is_empty()),
                    "cwd" => doc.cwd = Some(unquote(value)).filter(|item| !item.is_empty()),
                    "start" => doc.start = unquote(value),
                    _ => {}
                }
            }
            continue;
        }
        match section {
            Section::Commands => {
                if let Some((key, value)) = split_kv(trimmed) {
                    match key {
                        "install" => {
                            doc.install = Some(unquote(value)).filter(|item| !item.is_empty());
                        }
                        "start" => doc.start = unquote(value),
                        _ => {}
                    }
                }
            }
            Section::Env => {
                if let Some((key, value)) = split_kv(trimmed) {
                    if !key.is_empty() {
                        doc.env.insert(key.to_string(), unquote(value));
                    }
                }
            }
            Section::Root => {}
        }
    }
    validate(&doc)?;
    Ok(doc)
}

enum Section {
    Root,
    Commands,
    Env,
}

fn split_kv(line: &str) -> Option<(&str, &str)> {
    let (key, value) = line.split_once(':')?;
    Some((key.trim(), value.trim()))
}

fn unquote(value: &str) -> String {
    let value = value.trim();
    if (value.starts_with('"') && value.ends_with('"')) || (value.starts_with('\'') && value.ends_with('\'')) {
        value[1..value.len() - 1].replace("\\\"", "\"")
    } else {
        value.to_string()
    }
}

fn yaml_scalar(value: &str) -> String {
    if value.is_empty()
        || value.contains(':')
        || value.contains('#')
        || value.contains(' ')
        || value.contains('"')
    {
        yaml_quoted(value)
    } else {
        value.to_string()
    }
}

fn yaml_quoted(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_minimal() {
        let raw = r#"
version: launch/v1
name: demo
runtime: node
kind: site
port: 3000
url: http://localhost:3000/react-gh-pages
cwd: .
commands:
  install: "npm install"
  start: "npm start"
env:
  PORT: "3000"
"#;
        let doc = parse(raw).unwrap();
        assert_eq!(doc.start, "npm start");
        assert_eq!(doc.install.as_deref(), Some("npm install"));
        assert_eq!(doc.port, Some(3000));
        assert_eq!(doc.url.as_deref(), Some("http://localhost:3000/react-gh-pages"));
        assert_eq!(doc.env.get("PORT").map(String::as_str), Some("3000"));
        let again = parse(&serialize(&doc)).unwrap();
        assert_eq!(again.start, doc.start);
    }
}
