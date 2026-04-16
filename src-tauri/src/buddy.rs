use std::fs;
use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};

const BUDDY_FILENAME: &str = ".claude/session-manager-buddy.json";
const ARCHIVES_DIR: &str = ".claude/session-archives";
const XP_PER_LEVEL: u32 = 100;
const XP_PER_TASK: u32 = 5;
const XP_PER_FILE_CHANGED: u32 = 3;
const XP_PER_DECISION: u32 = 8;
const XP_BASE_PER_ARCHIVE: u32 = 10;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuddyState {
    pub github_username: Option<String>,
    pub avatar_url: Option<String>,
    pub level: u32,
    pub xp: u32,
    pub total_archives: u32,
    pub d_plus_day: Option<u64>,
    pub first_activity: Option<String>,
    pub total_sessions: usize,
}

impl Default for BuddyState {
    fn default() -> Self {
        Self {
            github_username: None,
            avatar_url: None,
            level: 1,
            xp: 0,
            total_archives: 0,
            d_plus_day: None,
            first_activity: None,
            total_sessions: 0,
        }
    }
}

fn buddy_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to resolve home directory")?;
    Ok(home.join(BUDDY_FILENAME))
}

fn load_buddy() -> Result<BuddyState, String> {
    let path = buddy_path()?;
    if !path.exists() {
        return Ok(BuddyState::default());
    }
    let content =
        fs::read_to_string(&path).map_err(|err| format!("Failed to read buddy file: {err}"))?;
    serde_json::from_str(&content).map_err(|err| format!("Failed to parse buddy file: {err}"))
}

fn save_buddy(state: &BuddyState) -> Result<(), String> {
    let path = buddy_path()?;
    let content = serde_json::to_string_pretty(state)
        .map_err(|err| format!("Failed to serialize buddy: {err}"))?;
    fs::write(&path, content).map_err(|err| format!("Failed to write buddy file: {err}"))
}

fn detect_github_username() -> Option<String> {
    let home = dirs::home_dir()?;
    let projects_dir = home.join(".claude/projects");

    if let Ok(projects) = fs::read_dir(&projects_dir) {
        for project in projects.flatten() {
            if !project.path().is_dir() {
                continue;
            }
            if let Ok(files) = fs::read_dir(project.path()) {
                for file in files.flatten() {
                    let path = file.path();
                    if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                        continue;
                    }
                    if let Some(cwd) = extract_cwd_from_jsonl(&path) {
                        if let Ok(output) = Command::new("git")
                            .args(["config", "user.name"])
                            .current_dir(&cwd)
                            .output()
                        {
                            if output.status.success() {
                                let name =
                                    String::from_utf8_lossy(&output.stdout).trim().to_string();
                                if !name.is_empty() {
                                    return Some(name);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

fn extract_cwd_from_jsonl(path: &std::path::Path) -> Option<String> {
    use std::io::{BufRead, BufReader};
    let file = fs::File::open(path).ok()?;
    let reader = BufReader::new(file);

    for line in reader.lines().flatten() {
        if !line.contains("\"cwd\"") {
            continue;
        }
        if let Ok(entry) = serde_json::from_str::<serde_json::Value>(&line) {
            if entry.get("type").and_then(|v| v.as_str()) == Some("user") {
                if let Some(cwd) = entry.get("cwd").and_then(|v| v.as_str()) {
                    let cwd_path = std::path::Path::new(cwd);
                    if cwd_path.is_dir() {
                        return Some(cwd.to_string());
                    }
                }
            }
        }
    }

    None
}

struct ArchiveStats {
    count: u32,
    total_xp: u32,
    earliest: Option<String>,
}

fn scan_archives() -> ArchiveStats {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return ArchiveStats { count: 0, total_xp: 0, earliest: None },
    };
    let archives_dir = home.join(ARCHIVES_DIR);

    if !archives_dir.exists() {
        return ArchiveStats { count: 0, total_xp: 0, earliest: None };
    }

    let entries = match fs::read_dir(&archives_dir) {
        Ok(e) => e,
        Err(_) => return ArchiveStats { count: 0, total_xp: 0, earliest: None },
    };

    let mut count = 0u32;
    let mut total_xp = 0u32;
    let mut earliest: Option<String> = None;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        count += 1;

        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(archive) = serde_json::from_str::<serde_json::Value>(&content) {
                let task_count = archive.get("tasks")
                    .and_then(|v| v.as_array())
                    .map_or(0, |a| a.len()) as u32;
                let file_count = archive.get("filesChanged")
                    .and_then(|v| v.as_array())
                    .map_or(0, |a| a.len()) as u32;
                let decision_count = archive.get("decisions")
                    .and_then(|v| v.as_array())
                    .map_or(0, |a| a.len()) as u32;

                total_xp += XP_BASE_PER_ARCHIVE
                    + (task_count * XP_PER_TASK)
                    + (file_count * XP_PER_FILE_CHANGED)
                    + (decision_count * XP_PER_DECISION);

                let start = archive
                    .get("startDate")
                    .or_else(|| archive.get("timestamp"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                if let Some(ts) = start {
                    if earliest.as_ref().map_or(true, |e| ts < *e) {
                        earliest = Some(ts);
                    }
                }
            }
        }
    }

    ArchiveStats { count, total_xp, earliest }
}

fn count_total_sessions() -> usize {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return 0,
    };
    let projects_dir = home.join(".claude/projects");

    if !projects_dir.exists() {
        return 0;
    }

    let mut count = 0;
    if let Ok(projects) = fs::read_dir(&projects_dir) {
        for project in projects.flatten() {
            if !project.path().is_dir() {
                continue;
            }
            if let Ok(files) = fs::read_dir(project.path()) {
                count += files
                    .flatten()
                    .filter(|e| e.path().extension().is_some_and(|ext| ext == "jsonl"))
                    .count();
            }
        }
    }

    count
}

fn days_since(iso_timestamp: &str) -> Option<u64> {
    let parsed = chrono::DateTime::parse_from_rfc3339(iso_timestamp).ok()?;
    let now = chrono::Utc::now();
    let duration = now.signed_duration_since(parsed.with_timezone(&chrono::Utc));
    Some(duration.num_days().max(0) as u64)
}

pub fn refresh_buddy() -> Result<BuddyState, String> {
    let mut state = load_buddy()?;

    if state.github_username.is_none() {
        if let Some(username) = detect_github_username() {
            state.avatar_url = Some(format!("https://github.com/{username}.png?size=80"));
            state.github_username = Some(username);
        }
    }

    let stats = scan_archives();

    state.total_archives = stats.count;
    state.xp = stats.total_xp % XP_PER_LEVEL;
    state.level = 1 + (stats.total_xp / XP_PER_LEVEL);

    if let Some(ref earliest) = stats.earliest {
        state.first_activity = Some(earliest.clone());
        state.d_plus_day = days_since(earliest);
    }

    state.total_sessions = count_total_sessions();

    save_buddy(&state)?;
    Ok(state)
}
