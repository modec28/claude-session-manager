use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const ARCHIVES_DIR: &str = ".claude/session-archives";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    #[serde(default)]
    pub session_id: String,
    #[serde(default, alias = "timestamp")]
    pub start_date: String,
    #[serde(default)]
    pub end_date: String,
    #[serde(default)]
    pub project: String,
    #[serde(default)]
    pub cwd: String,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub issue_keys: Vec<String>,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub tasks: Vec<String>,
    #[serde(default)]
    pub files_changed: Vec<String>,
    #[serde(default)]
    pub decisions: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub filename: String,
}

fn archives_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to resolve home directory")?;
    Ok(home.join(ARCHIVES_DIR))
}

pub fn list_archives() -> Result<Vec<ArchiveEntry>, String> {
    let dir = archives_path()?;
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&dir)
        .map_err(|err| format!("Failed to read archives dir: {err}"))?;

    let mut archives: Vec<ArchiveEntry> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut archive: ArchiveEntry = match serde_json::from_str(&content) {
            Ok(a) => a,
            Err(_) => continue,
        };

        archive.filename = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        archives.push(archive);
    }

    archives.sort_by(|a, b| b.start_date.cmp(&a.start_date));
    Ok(archives)
}

pub fn delete_archive(filename: &str) -> Result<(), String> {
    let dir = archives_path()?;
    let path = dir.join(filename);

    if !path.exists() {
        return Err(format!("Archive not found: {filename}"));
    }

    if !path.starts_with(&dir) {
        return Err("Invalid archive path".to_string());
    }

    fs::remove_file(&path)
        .map_err(|err| format!("Failed to delete archive: {err}"))
}
