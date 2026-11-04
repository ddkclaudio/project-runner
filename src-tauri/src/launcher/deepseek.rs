use crate::launcher::launchfile;
use serde_json::{json, Value};
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

const API_URL: &str = "https://api.deepseek.com/chat/completions";
const MODEL: &str = "deepseek-chat";
const MAX_ROUNDS: usize = 16;
const MAX_FILE_BYTES: usize = 48 * 1024;
const MAX_SEARCH_HITS: usize = 40;
const MAX_LIST_ENTRIES: usize = 200;

const SYSTEM_PROMPT: &str = r#"You are a launch-config agent for the Painel desktop app.
Explore the repository using tools only. Infer how this branch installs dependencies and starts.
Painel runs one Launchfile. It does not use a Procfile, Docker as a type, or several long-running processes.

Write YAML with:
version: launch/v1
name, runtime (node|python|rust|binary|other), kind (site|api|desktop|cli),
commands.pre-start (always present; YAML list of commands that exit),
commands.start (always present; YAML list; every item except the last must exit; the last stays running),
env (no secrets). Always include env.PORT.

Do not write a port key, a url key, or a cwd key. Painel opens http://localhost plus env.PORT for site and api. Commands always run in the clone root. Do not set a working directory and do not serve a parent folder.

Launch kinds Painel can execute:
- site: a dev server or static file server. Put the port it listens on in env.PORT.
- api: an HTTP server. Put the port it listens on in env.PORT.
- desktop: an executable that stays open. If it does not listen, still set env.PORT to "3000".
- cli: a foreground command that stays running. If it does not listen, still set env.PORT to "3000".

pre-start is where dependencies are installed. The steps change with the language and framework (npm install, python -m venv plus pip install, cargo fetch). Use an empty list when nothing must be installed. Each step must succeed again on the next launch, so prefer npm install and do not use npm ci, which deletes node_modules every time.
If start has several steps, only the last stays alive.

Painel has a Cloudflare tunnel. The tunnel only needs the port the app listens on. Painel starts cloudflared; do not put cloudflared in start or pre-start.
If the project already reads PORT (CRA, Vite, Next, Flask, uvicorn), put that same number only in env.PORT. If the project does not fix a port, write env.PORT as "3000". Do not invent CLOUDFLARE_*, TUNNEL_*, hostname, or token variables.

The Executável screen has two tabs. The App tab is this Launchfile: name, runtime, kind, commands, and env. The Variáveis tab reads the clone's .env, or .env.example when .env is missing. That file is not part of the YAML. You may read .env.example names to learn what the project expects. Never copy secret values into the Launchfile. Write under env only what startup needs, starting with PORT.

Never invent file paths — list_dir / search / read_file first.
Each command is a plain shell command. Put variables under env:, never VAR=value prefixes.
When ready, call write_launchfile or update_launchfile, then finish.
"#;

pub async fn ensure_launchfile(
    project: &Path,
    info: &Path,
    token: &str,
    branch: &str,
    on_progress: &impl Fn(u32, &str),
) -> Result<(), String> {
    if launchfile::exists(info) {
        let _ = launchfile::read(info)?;
        return Ok(());
    }
    run_agent(project, info, token, branch, false, on_progress).await
}

pub async fn generate_launchfile(
    project: &Path,
    info: &Path,
    token: &str,
    branch: &str,
    on_progress: &impl Fn(u32, &str),
) -> Result<(), String> {
    run_agent(project, info, token, branch, true, on_progress).await
}

async fn run_agent(
    project: &Path,
    info: &Path,
    token: &str,
    branch: &str,
    allow_update: bool,
    on_progress: &impl Fn(u32, &str),
) -> Result<(), String> {
    let token = token.trim();
    if token.is_empty() {
        return Err(
            "Configure o token DeepSeek em Configurações → Perfil antes de gerar o Launchfile.".into(),
        );
    }
    if !project.is_dir() {
        return Err("Pasta do projecto inválida.".into());
    }
    fs::create_dir_all(info).map_err(|err| err.to_string())?;
    on_progress(8, "DeepSeek a preparar…");

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|err| err.to_string())?;

    let tools = tool_schemas();
    let mut messages = vec![
        json!({"role": "system", "content": SYSTEM_PROMPT}),
        json!({
            "role": "user",
            "content": format!(
                "Repository root is ready. Current git branch: {branch}. Explore the files on this branch and {} a valid Launchfile so this branch can install dependencies and start. The commands must match the files that exist on this branch now. Do not keep npm start when package.json is absent. Always write commands.pre-start and commands.start as YAML lists. Prefer reading README, package manifests, index.html, and env examples.",
                if allow_update && launchfile::exists(info) { "update" } else { "create" }
            )
        }),
    ];

    let mut finished = false;
    for round in 0..MAX_ROUNDS {
        let pct = 10 + ((round as u32 * 28) / MAX_ROUNDS as u32);
        on_progress(pct.min(38), &format!("DeepSeek a explorar… ({}/{})", round + 1, MAX_ROUNDS));
        let body = json!({
            "model": MODEL,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
        });
        let response = client
            .post(API_URL)
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .map_err(|err| format!("Falha na API DeepSeek: {err}"))?;
        let status = response.status();
        let payload: Value = response
            .json()
            .await
            .map_err(|err| format!("Resposta DeepSeek inválida: {err}"))?;
        if !status.is_success() {
            let detail = payload
                .pointer("/error/message")
                .and_then(|item| item.as_str())
                .unwrap_or("erro desconhecido");
            return Err(format!("DeepSeek HTTP {status}: {detail}"));
        }

        let choice = payload
            .pointer("/choices/0/message")
            .cloned()
            .ok_or_else(|| "DeepSeek não devolveu mensagem.".to_string())?;
        messages.push(choice.clone());

        let tool_calls = choice
            .get("tool_calls")
            .and_then(|item| item.as_array())
            .cloned()
            .unwrap_or_default();
        if tool_calls.is_empty() {
            break;
        }

        for call in tool_calls {
            let id = call
                .get("id")
                .and_then(|item| item.as_str())
                .unwrap_or("call")
                .to_string();
            let name = call
                .pointer("/function/name")
                .and_then(|item| item.as_str())
                .unwrap_or("")
                .to_string();
            if name.contains("launchfile") {
                on_progress(40, "DeepSeek a escrever Launchfile…");
            }
            let args_raw = call
                .pointer("/function/arguments")
                .and_then(|item| item.as_str())
                .unwrap_or("{}");
            let args: Value = serde_json::from_str(args_raw).unwrap_or_else(|_| json!({}));
            let (result, is_finish) = execute_tool(project, info, &name, &args, allow_update);
            if is_finish {
                finished = true;
            }
            messages.push(json!({
                "role": "tool",
                "tool_call_id": id,
                "content": result,
            }));
        }
        if finished {
            break;
        }
    }

    on_progress(42, "A validar Launchfile…");
    let doc = launchfile::read(info).map_err(|_| {
        "O DeepSeek terminou sem criar um Launchfile válido. Tente regenerar.".to_string()
    })?;
    launchfile::validate(&doc)?;
    on_progress(45, "Launchfile pronto");
    Ok(())
}

fn tool_schemas() -> Value {
    json!([
        {
            "type": "function",
            "function": {
                "name": "list_dir",
                "description": "List files and directories under a relative path.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Relative path, default ." },
                        "depth": { "type": "integer", "description": "Max depth 1-3, default 1" }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "search",
                "description": "Search for a text needle in project files.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" },
                        "path": { "type": "string", "description": "Optional subdirectory" }
                    },
                    "required": ["query"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read a text file. .env values are redacted.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "write_launchfile",
                "description": "Create the Launchfile YAML for this branch. commands.pre-start and commands.start must be YAML lists.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "content": { "type": "string" }
                    },
                    "required": ["content"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "update_launchfile",
                "description": "Replace the Launchfile YAML for this branch. commands.pre-start and commands.start must be YAML lists.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "content": { "type": "string" }
                    },
                    "required": ["content"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "finish",
                "description": "Mark Launchfile as complete after write/update.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "summary": { "type": "string" }
                    }
                }
            }
        }
    ])
}

fn execute_tool(
    project: &Path,
    info: &Path,
    name: &str,
    args: &Value,
    allow_update: bool,
) -> (String, bool) {
    match name {
        "list_dir" => {
            let rel = args.get("path").and_then(|item| item.as_str()).unwrap_or(".");
            let depth = args
                .get("depth")
                .and_then(|item| item.as_u64())
                .unwrap_or(1)
                .clamp(1, 3) as usize;
            (list_dir(project, rel, depth), false)
        }
        "search" => {
            let query = args.get("query").and_then(|item| item.as_str()).unwrap_or("");
            let rel = args.get("path").and_then(|item| item.as_str()).unwrap_or(".");
            (search_files(project, rel, query), false)
        }
        "read_file" => {
            let rel = args.get("path").and_then(|item| item.as_str()).unwrap_or("");
            (read_file(project, rel), false)
        }
        "write_launchfile" => {
            let content = args.get("content").and_then(|item| item.as_str()).unwrap_or("");
            if launchfile::exists(info) && !allow_update {
                return (
                    "Launchfile already exists. Use update_launchfile if regeneration was requested."
                        .into(),
                    false,
                );
            }
            match launchfile::write_raw(info, content) {
                Ok(_) => ("Launchfile written to launch-info and validated.".into(), false),
                Err(err) => (format!("write_launchfile failed: {err}"), false),
            }
        }
        "update_launchfile" => {
            let content = args.get("content").and_then(|item| item.as_str()).unwrap_or("");
            match launchfile::write_raw(info, content) {
                Ok(_) => ("Launchfile updated in launch-info and validated.".into(), false),
                Err(err) => (format!("update_launchfile failed: {err}"), false),
            }
        }
        "finish" => {
            let summary = args
                .get("summary")
                .and_then(|item| item.as_str())
                .unwrap_or("done");
            if launchfile::exists(info) {
                (format!("finished: {summary}"), true)
            } else {
                (
                    "finish rejected: Launchfile missing. Call write_launchfile first.".into(),
                    false,
                )
            }
        }
        other => (format!("Unknown tool: {other}"), false),
    }
}

fn resolve_rel(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel = rel.trim().trim_start_matches("./");
    let candidate = if rel.is_empty() || rel == "." {
        root.to_path_buf()
    } else {
        root.join(rel)
    };
    let canon_root = root
        .canonicalize()
        .unwrap_or_else(|_| root.to_path_buf());
    let canon = candidate
        .canonicalize()
        .map_err(|_| format!("Path not found: {rel}"))?;
    if !canon.starts_with(&canon_root) {
        return Err("Path escapes repository root.".into());
    }
    // Also reject .. components in relative input
    for component in Path::new(rel).components() {
        if matches!(component, Component::ParentDir) {
            return Err("Parent directory segments are not allowed.".into());
        }
    }
    Ok(canon)
}

fn ignored_name(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".git"
            | "target"
            | "dist"
            | "build"
            | ".next"
            | "__pycache__"
            | "vendor"
            | ".venv"
            | "venv"
            | ".idea"
            | ".vs"
            | "coverage"
    )
}

fn list_dir(root: &Path, rel: &str, depth: usize) -> String {
    let Ok(base) = resolve_rel(root, rel) else {
        return format!("list_dir error: invalid path {rel}");
    };
    let mut lines = Vec::new();
    fn walk(
        root: &Path,
        dir: &Path,
        depth_left: usize,
        lines: &mut Vec<String>,
    ) -> Result<(), String> {
        if lines.len() >= MAX_LIST_ENTRIES {
            return Ok(());
        }
        let mut entries: Vec<_> = fs::read_dir(dir)
            .map_err(|err| err.to_string())?
            .flatten()
            .collect();
        entries.sort_by_key(|item| item.file_name());
        for entry in entries {
            if lines.len() >= MAX_LIST_ENTRIES {
                break;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if ignored_name(&name) {
                continue;
            }
            let path = entry.path();
            let rel = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .display()
                .to_string()
                .replace('\\', "/");
            let meta = entry.metadata().ok();
            let kind = if meta.as_ref().map(|item| item.is_dir()).unwrap_or(false) {
                "dir"
            } else {
                "file"
            };
            lines.push(format!("{kind}\t{rel}"));
            if kind == "dir" && depth_left > 1 {
                walk(root, &path, depth_left - 1, lines)?;
            }
        }
        Ok(())
    }
    match walk(root, &base, depth, &mut lines) {
        Ok(()) => {
            if lines.is_empty() {
                "(empty)".into()
            } else {
                lines.join("\n")
            }
        }
        Err(err) => format!("list_dir error: {err}"),
    }
}

fn search_files(root: &Path, rel: &str, query: &str) -> String {
    let query = query.trim();
    if query.is_empty() {
        return "search error: empty query".into();
    }
    let Ok(base) = resolve_rel(root, rel) else {
        return format!("search error: invalid path {rel}");
    };
    let mut hits = Vec::new();
    fn walk(
        root: &Path,
        dir: &Path,
        query: &str,
        hits: &mut Vec<String>,
    ) -> Result<(), String> {
        if hits.len() >= MAX_SEARCH_HITS {
            return Ok(());
        }
        for entry in fs::read_dir(dir).map_err(|err| err.to_string())?.flatten() {
            if hits.len() >= MAX_SEARCH_HITS {
                break;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if ignored_name(&name) {
                continue;
            }
            let path = entry.path();
            if path.is_dir() {
                walk(root, &path, query, hits)?;
                continue;
            }
            if !is_textish(&path) {
                continue;
            }
            let Ok(raw) = fs::read_to_string(&path) else {
                continue;
            };
            for (idx, line) in raw.lines().enumerate() {
                if line.to_lowercase().contains(&query.to_lowercase()) {
                    let rel = path
                        .strip_prefix(root)
                        .unwrap_or(&path)
                        .display()
                        .to_string()
                        .replace('\\', "/");
                    let snippet: String = line.chars().take(160).collect();
                    hits.push(format!("{rel}:{}: {snippet}", idx + 1));
                    if hits.len() >= MAX_SEARCH_HITS {
                        break;
                    }
                }
            }
        }
        Ok(())
    }
    match walk(root, &base, query, &mut hits) {
        Ok(()) => {
            if hits.is_empty() {
                "No matches.".into()
            } else {
                hits.join("\n")
            }
        }
        Err(err) => format!("search error: {err}"),
    }
}

fn read_file(root: &Path, rel: &str) -> String {
    let Ok(path) = resolve_rel(root, rel) else {
        return format!("read_file error: invalid path {rel}");
    };
    if !path.is_file() {
        return format!("read_file error: not a file: {rel}");
    }
    let mut file = match fs::File::open(&path) {
        Ok(file) => file,
        Err(err) => return format!("read_file error: {err}"),
    };
    let mut buf = vec![0u8; MAX_FILE_BYTES + 1];
    let read = match file.read(&mut buf) {
        Ok(n) => n,
        Err(err) => return format!("read_file error: {err}"),
    };
    let truncated = read > MAX_FILE_BYTES;
    let end = read.min(MAX_FILE_BYTES);
    let mut text = String::from_utf8_lossy(&buf[..end]).to_string();
    let name = path
        .file_name()
        .and_then(|item| item.to_str())
        .unwrap_or("")
        .to_lowercase();
    if name == ".env" || name.starts_with(".env.") {
        text = redact_env(&text);
    }
    if truncated {
        text.push_str("\n\n[truncated]");
    }
    text
}

fn redact_env(raw: &str) -> String {
    raw.lines()
        .map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                return line.to_string();
            }
            if let Some((key, _)) = line.split_once('=') {
                format!("{}=<redacted>", key.trim())
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn is_textish(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|item| item.to_str())
        .unwrap_or("")
        .to_lowercase();
    matches!(
        ext.as_str(),
        "" | "md"
            | "txt"
            | "json"
            | "yml"
            | "yaml"
            | "toml"
            | "js"
            | "jsx"
            | "ts"
            | "tsx"
            | "mjs"
            | "cjs"
            | "py"
            | "rs"
            | "go"
            | "java"
            | "kt"
            | "cs"
            | "php"
            | "rb"
            | "sh"
            | "bat"
            | "cmd"
            | "ps1"
            | "env"
            | "example"
            | "gitignore"
            | "dockerignore"
            | "html"
            | "css"
            | "scss"
            | "svg"
            | "xml"
            | "lock"
    ) || path
        .file_name()
        .and_then(|item| item.to_str())
        .is_some_and(|name| {
            matches!(
                name,
                "Dockerfile"
                    | "Makefile"
                    | "Procfile"
                    | "Launchfile"
                    | "README"
                    | "LICENSE"
                    | "Cargo.lock"
                    | "package.json"
                    | "package-lock.json"
                    | "pnpm-lock.yaml"
                    | "yarn.lock"
                    | "bun.lock"
                    | "bun.lockb"
                    | ".env"
                    | ".env.example"
                    | ".env.sample"
            )
        })
}
