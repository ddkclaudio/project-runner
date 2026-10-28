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
    /// Passos que terminam antes do arranque (instalar dependências, etc.).
    pub pre_start: Vec<String>,
    /// Passos de arranque. O último fica vivo; os anteriores terminam.
    pub start: Vec<String>,
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
    if lasting_start(doc).is_empty() {
        return Err("Launchfile sem commands.start.".into());
    }
    Ok(())
}

pub fn finished_steps(items: &[String]) -> Vec<String> {
    items
        .iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect()
}

/// Comando que permanece em execução: a última entrada não vazia de `start`.
pub fn lasting_start(doc: &LaunchfileDoc) -> String {
    doc.start
        .iter()
        .rev()
        .find(|item| !item.trim().is_empty())
        .map(|item| item.trim().to_string())
        .unwrap_or_default()
}

/// Passos de `start` que terminam antes do processo que fica vivo.
pub fn start_setup(doc: &LaunchfileDoc) -> Vec<String> {
    let steps = finished_steps(&doc.start);
    if steps.len() <= 1 {
        return Vec::new();
    }
    steps[..steps.len() - 1].to_vec()
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
  pre-start:
    - "npm install"
  start:
    - "npm start"
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
    write_list(&mut out, "pre-start", &doc.pre_start);
    write_list(&mut out, "start", &doc.start);
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
    let mut list_target = CommandList::None;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let indent = line.len() - line.trim_start().len();
        if indent == 0 {
            list_target = CommandList::None;
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
                    "start" => push_step(&mut doc.start, value),
                    _ => {}
                }
            }
            continue;
        }
        if let Some(item) = trimmed.strip_prefix("- ") {
            let item = unquote(item.trim());
            if item.is_empty() {
                continue;
            }
            match list_target {
                CommandList::PreStart => doc.pre_start.push(item),
                CommandList::Start => doc.start.push(item),
                CommandList::None => {}
            }
            continue;
        }
        match section {
            Section::Commands => {
                if let Some((key, value)) = split_kv(trimmed) {
                    match key {
                        "install" | "pre-start" => {
                            list_target = if open_list(&mut doc.pre_start, value) {
                                CommandList::PreStart
                            } else {
                                CommandList::None
                            };
                        }
                        "start" => {
                            list_target = if open_list(&mut doc.start, value) {
                                CommandList::Start
                            } else {
                                CommandList::None
                            };
                        }
                        _ => list_target = CommandList::None,
                    }
                }
            }
            Section::Env => {
                list_target = CommandList::None;
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

enum CommandList {
    None,
    PreStart,
    Start,
}

/// `true` quando o valor está vazio e os próximos `- item` pertencem a esta lista.
fn open_list(list: &mut Vec<String>, value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return true;
    }
    if unquote(trimmed) == "[]" {
        return false;
    }
    push_step(list, trimmed);
    false
}

fn push_step(list: &mut Vec<String>, value: &str) {
    let item = unquote(value);
    if !item.is_empty() && item != "[]" {
        list.push(item);
    }
}

fn write_list(out: &mut String, key: &str, items: &[String]) {
    let items = finished_steps(items);
    if items.is_empty() {
        out.push_str(&format!("  {key}: []\n"));
        return;
    }
    out.push_str(&format!("  {key}:\n"));
    for item in items {
        out.push_str(&format!("    - {}\n", yaml_quoted(&item)));
    }
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
    fn legacy_install_and_start_become_lists() {
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
        assert_eq!(doc.start, vec!["npm start".to_string()]);
        assert_eq!(doc.pre_start, vec!["npm install".to_string()]);
        assert_eq!(doc.port, Some(3000));
        assert_eq!(doc.url.as_deref(), Some("http://localhost:3000/react-gh-pages"));
        assert_eq!(doc.env.get("PORT").map(String::as_str), Some("3000"));
        let again = parse(&serialize(&doc)).unwrap();
        assert_eq!(again.start, doc.start);
        assert_eq!(again.pre_start, doc.pre_start);
    }

    #[test]
    fn parses_command_lists_and_empty_pre_start() {
        let raw = r#"
version: launch/v1
name: pages
runtime: node
kind: site
port: 3000
commands:
  pre-start: []
  start:
    - "npx --yes serve -l 3000 --no-clipboard ."
"#;
        let doc = parse(raw).unwrap();
        assert!(doc.pre_start.is_empty());
        assert_eq!(doc.start.len(), 1);
        assert_eq!(start_setup(&doc).len(), 0);
        assert_eq!(lasting_start(&doc), "npx --yes serve -l 3000 --no-clipboard .");
    }

    #[test]
    fn start_setup_is_every_step_but_the_last() {
        let raw = r#"
commands:
  pre-start:
    - "npm install"
    - "npm run build"
  start:
    - "npm run migrate"
    - "npm start"
"#;
        let doc = parse(raw).unwrap();
        assert_eq!(doc.pre_start.len(), 2);
        assert_eq!(start_setup(&doc), vec!["npm run migrate".to_string()]);
        assert_eq!(lasting_start(&doc), "npm start");
    }
}
