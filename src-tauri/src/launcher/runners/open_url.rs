use crate::launcher::launchfile;
use std::path::Path;

/// URL local a partir do Launchfile (`url` ou `http://localhost:{port}`).
pub fn detect(root: &Path) -> Option<String> {
    let doc = launchfile::read(root).ok()?;
    launchfile::open_url_of(&doc)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::launcher::launchfile::{self, LaunchfileDoc};
    use std::collections::BTreeMap;
    use std::fs;

    #[test]
    fn from_launchfile_url() {
        let dir = std::env::temp_dir().join(format!("painel-url-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let doc = LaunchfileDoc {
            version: "launch/v1".into(),
            name: "x".into(),
            runtime: "node".into(),
            kind: "site".into(),
            port: Some(3000),
            url: Some("http://localhost:3000/react-gh-pages".into()),
            cwd: Some(".".into()),
            install: Some("npm install".into()),
            start: "npm start".into(),
            env: BTreeMap::new(),
        };
        launchfile::write(&dir, &doc).unwrap();
        assert_eq!(
            detect(&dir).as_deref(),
            Some("http://localhost:3000/react-gh-pages")
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
