use crate::launcher::install;
use crate::launcher::launch;
use crate::launcher::self_update;
use crate::launcher::store::{self, find_app_by_name};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

fn cli_org_root(meta: &Path) -> PathBuf {
    let data = store::system_data_dir(meta);
    if let Ok(entries) = std::fs::read_dir(&data) {
        let mut dirs: Vec<_> = entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| {
                path.is_dir()
                    && path
                        .file_name()
                        .and_then(|name| name.to_str())
                        .is_some_and(|name| name != "Cache" && !name.starts_with('.'))
            })
            .collect();
        dirs.sort();
        if let Some(first) = dirs.into_iter().next() {
            return first;
        }
    }
    let legacy = meta.join("orgs");
    if let Ok(entries) = std::fs::read_dir(&legacy) {
        let mut dirs: Vec<_> = entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.is_dir())
            .collect();
        dirs.sort();
        if let Some(first) = dirs.into_iter().next() {
            return first;
        }
    }
    meta.to_path_buf()
}

fn cli_workspace(meta: &Path, apps: &Path) -> PathBuf {
    let orgs_path = store::system_data_dir(meta).join("orgs.json");
    if let Ok(raw) = std::fs::read_to_string(&orgs_path) {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let Some(orgs) = value.get("orgs").and_then(|item| item.as_array()) {
                if let Some(slug) = orgs
                    .first()
                    .and_then(|org| org.get("slug"))
                    .and_then(|item| item.as_str())
                    .map(str::trim)
                    .filter(|item| !item.is_empty())
                {
                    return store::org_workspace(apps, slug);
                }
            }
        }
    }
    apps.to_path_buf()
}

pub fn cli_requested() -> bool {
    std::env::args().skip(1).any(|arg| {
        matches!(
            arg.as_str(),
            "--help" | "-h" | "--list" | "-l" | "--run" | "-r" | "--download" | "-d" | "--update" | "-u"
                | "--update-launcher" | "--self-update" | "--uninstall" | "-x" | "--add-steam-shortcut"
        )
    })
}

pub fn run_cli() -> i32 {
    attach_console();
    let runtime = match tokio::runtime::Runtime::new() {
        Ok(runtime) => runtime,
        Err(err) => {
            eprintln!("{err}");
            return 1;
        }
    };
    match runtime.block_on(execute()) {
        Ok(()) => 0,
        Err(err) => {
            eprintln!("{err}");
            1
        }
    }
}

async fn execute() -> Result<(), String> {
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    args.retain(|arg| arg != "--");
    let command = args.first().map(|arg| arg.as_str()).unwrap_or("--help");
    let name = args.iter().skip(1).cloned().collect::<Vec<_>>().join(" ");
    let meta = store::resolve_meta_root();
    let apps = store::resolve_apps_root();
    let root = cli_org_root(&meta);
    let workspace = cli_workspace(&meta, &apps);
    store::ensure_root(&root)?;
    let _ = std::fs::create_dir_all(&workspace);
    match command {
        "--help" | "-h" => {
            println!(
                "Painel\n\n  --list, -l                 lista as apps\n  --run, -r NOME             lança uma app\n  --download, -d NOME        instala uma app\n  --update, -u [NOME]        atualiza uma app ou todas\n  --uninstall, -x NOME       apaga a pasta instalada\n  --add-steam-shortcut NOME  adiciona à Steam\n  --self-update              atualiza o Painel\n  --help, -h                 mostra esta ajuda"
            );
            Ok(())
        }
        "--list" | "-l" => {
            let snap = store::snapshot(&root, &workspace)?;
            if snap.apps.is_empty() {
                println!("A biblioteca está vazia.");
                return Ok(());
            }
            for app in snap.apps {
                let state = match app.status.as_str() {
                    "update" => "atualização",
                    "installed" => "instalada",
                    _ => "por instalar",
                };
                println!("{:<24} {:<28} {state}", app.name, app.repository);
            }
            Ok(())
        }
        "--run" | "-r" => {
            let app = named(&root, &name)?;
            let result = launch::launch(&root, &workspace, &app.repository, None, false).await?;
            println!("{}", result.message);
            if result.needs_choice {
                for exe in result.executables {
                    println!("  {exe}");
                }
            }
            Ok(())
        }
        "--download" | "-d" => {
            let app = named(&root, &name)?;
            let result = install::install(&root, &workspace, &app.repository, None, None, true, |percent, phase| {
                print!("\r{phase} {percent}%");
                let _ = io::stdout().flush();
            })
            .await?;
            println!("\n{}", result.message);
            Ok(())
        }
        "--update" | "-u" => {
            if name.trim().is_empty() {
                let snap = store::snapshot(&root, &workspace)?;
                let targets: Vec<String> = snap.apps.into_iter().filter(|app| app.status == "update").map(|app| app.repository).collect();
                if targets.is_empty() {
                    println!("Nenhuma app tem atualização.");
                    return Ok(());
                }
                for repository in targets {
                    let result = install::install(&root, &workspace, &repository, None, None, true, |_, _| {}).await?;
                    println!("{}", result.message);
                }
            } else {
                let app = named(&root, &name)?;
                let result = install::install(&root, &workspace, &app.repository, None, None, true, |_, _| {}).await?;
                println!("{}", result.message);
            }
            Ok(())
        }
        "--uninstall" | "-x" => {
            let app = named(&root, &name)?;
            store::delete_install(&root, &workspace, &app.repository)?;
            println!("A instalação de {} foi apagada. A entrada continua na biblioteca.", app.name);
            Ok(())
        }
        "--add-steam-shortcut" => {
            let app = named(&root, &name)?;
            let path = launch::steam_shortcut(&root, &app.repository)?;
            println!("Atalho gravado em {path}");
            Ok(())
        }
        "--self-update" | "--update-launcher" => {
            let message = self_update::apply(&root).await?;
            println!("{message}");
            Ok(())
        }
        _ => Err("Comando desconhecido. Use --help.".into()),
    }
}

fn named(root: &std::path::Path, name: &str) -> Result<store::AppEntry, String> {
    if name.trim().is_empty() {
        return Err("Indique o nome da app.".into());
    }
    let apps = store::load_apps(root);
    find_app_by_name(&apps, name).cloned()
}

fn attach_console() {
    #[cfg(windows)]
    {
        unsafe extern "system" {
            fn AttachConsole(pid: u32) -> i32;
            fn AllocConsole() -> i32;
        }
        unsafe {
            if AttachConsole(u32::MAX) == 0 {
                let _ = AllocConsole();
            }
        }
    }
}
