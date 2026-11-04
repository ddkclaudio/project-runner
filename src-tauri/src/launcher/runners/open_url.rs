use crate::launcher::launchfile;
use std::path::Path;

/// URL local: `http://localhost:{env.PORT}` para `site` e `api`.
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
            pre_start: vec!["npm install".into()],
            start: vec!["npm start".into()],
            env: BTreeMap::from([("PORT".into(), "3000".into())]),
        };
        launchfile::write(&dir, &doc).unwrap();
        assert_eq!(detect(&dir).as_deref(), Some("http://localhost:3000"));
        let _ = fs::remove_dir_all(&dir);
    }
}
