pub fn version_parts(raw: &str) -> Vec<i64> {
    let trimmed = raw.trim().trim_start_matches(['v', 'V']);
    let mut parts: Vec<i64> = trimmed
        .split(|c: char| !c.is_ascii_digit())
        .filter(|part| !part.is_empty())
        .filter_map(|part| part.parse().ok())
        .collect();
    while parts.len() < 3 {
        parts.push(0);
    }
    parts.truncate(4);
    parts
}

pub fn is_newer(remote: &str, local: &str) -> bool {
    version_parts(remote) > version_parts(local)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_prefix_and_pads() {
        assert_eq!(version_parts("v1.2"), vec![1, 2, 0]);
        assert!(is_newer("1.2.1", "1.2"));
        assert!(!is_newer("v1.0.0", "1.0.0"));
        assert!(is_newer("1.10.0", "1.9.9"));
        assert!(!is_newer("1.2.3", "1.2.3-extra"));
    }
}
