// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if painel_lib::cli_requested() {
        std::process::exit(painel_lib::run_cli());
    }
    painel_lib::run()
}
