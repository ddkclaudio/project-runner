// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if painel_lib::cli_requested() {
        std::process::exit(painel_lib::run_cli());
    }
    // Release não tem console. Sem um console oculto, cada node.exe do Run flow abre uma janela.
    #[cfg(all(windows, not(debug_assertions)))]
    hide_console();
    painel_lib::run()
}

#[cfg(all(windows, not(debug_assertions)))]
#[link(name = "kernel32")]
unsafe extern "system" {
    fn AllocConsole() -> i32;
    fn GetConsoleWindow() -> *mut std::ffi::c_void;
}

#[cfg(all(windows, not(debug_assertions)))]
#[link(name = "user32")]
unsafe extern "system" {
    fn ShowWindow(hwnd: *mut std::ffi::c_void, cmd: i32) -> i32;
}

#[cfg(all(windows, not(debug_assertions)))]
fn hide_console() {
    const SW_HIDE: i32 = 0;
    unsafe {
        let _ = AllocConsole();
        let window = GetConsoleWindow();
        if !window.is_null() {
            ShowWindow(window, SW_HIDE);
        }
    }
}
