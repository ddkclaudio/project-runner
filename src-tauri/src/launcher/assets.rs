pub fn host_platform() -> &'static str {
    if cfg!(windows) {
        "Windows"
    } else if cfg!(target_os = "macos") {
        "macOS"
    } else if cfg!(target_arch = "aarch64") {
        "Linux-ARM64"
    } else {
        "Linux-X64"
    }
}

pub fn effective_platform(setting: &str) -> String {
    let value = setting.trim();
    if value.is_empty() || value.eq_ignore_ascii_case("auto") {
        host_platform().to_string()
    } else {
        value.to_string()
    }
}

fn has_any(name: &str, markers: &[&str]) -> bool {
    markers.iter().any(|marker| name.contains(marker))
}

pub fn is_windows_asset(name: &str) -> bool {
    let name = name.to_lowercase();
    if has_any(
        &name,
        &["linux", "macos", "darwin", ".dmg", ".deb", ".rpm", "appimage", "switch"],
    ) {
        return false;
    }
    has_any(
        &name,
        &["windows", "win64", "win32", "win-x64", ".exe", ".msi", "msvc", "mingw"],
    )
}

pub fn is_macos_asset(name: &str) -> bool {
    let name = name.to_lowercase();
    if has_any(&name, &["macos", "osx", "darwin", ".dmg", ".pkg"]) {
        return true;
    }
    name.contains("mac") && !name.contains("machin")
}

pub fn is_linux_asset(name: &str, arm: bool) -> bool {
    let name = name.to_lowercase();
    let linux = has_any(
        &name,
        &["linux", ".appimage", ".deb", ".rpm", ".tar.gz", ".tgz", ".tar.xz"],
    );
    if !linux {
        return false;
    }
    let arm_name = name.contains("arm64") || name.contains("aarch64");
    let x64 = name.contains("x86_64") || name.contains("x64") || name.contains("amd64");
    let i686 = name.contains("i686") || name.contains("x86");
    if arm {
        if x64 && !arm_name {
            return false;
        }
        return arm_name || !x64;
    }
    if arm_name {
        return false;
    }
    if i686 && !x64 {
        return false;
    }
    true
}

pub fn matching_assets(names: &[String], platform: &str) -> Vec<String> {
    let platform = effective_platform(platform);
    names
        .iter()
        .filter(|name| match platform.as_str() {
            "Windows" => is_windows_asset(name),
            "macOS" => is_macos_asset(name),
            "Linux-ARM64" => is_linux_asset(name, true),
            _ => is_linux_asset(name, false),
        })
        .cloned()
        .collect()
}

pub fn wine_warning(platform: &str, asset: &str) -> Option<String> {
    let platform = effective_platform(platform);
    if platform.starts_with("Linux") && is_windows_asset(asset) {
        Some(
            "Este ficheiro é de Windows. No Linux ele abre com Wine ou Proton, se estiverem instalados."
                .into(),
        )
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_windows_and_rejects_foreign() {
        let names = vec![
            "game-linux.AppImage".into(),
            "game-win64.exe".into(),
            "game.dmg".into(),
            "notes.txt".into(),
        ];
        assert_eq!(
            matching_assets(&names, "Windows"),
            vec!["game-win64.exe".to_string()]
        );
    }

    #[test]
    fn splits_linux_arch() {
        let names = vec![
            "app-linux-arm64.tar.gz".into(),
            "app-linux-x86_64.tar.gz".into(),
        ];
        assert_eq!(
            matching_assets(&names, "Linux-X64"),
            vec!["app-linux-x86_64.tar.gz".to_string()]
        );
        assert_eq!(
            matching_assets(&names, "Linux-ARM64"),
            vec!["app-linux-arm64.tar.gz".to_string()]
        );
    }
}
