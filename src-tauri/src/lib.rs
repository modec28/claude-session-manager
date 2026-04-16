mod archive;
mod buddy;
mod iterm;
mod models;
mod session;
mod titles;

use archive::ArchiveEntry;
use buddy::BuddyState;
use models::{ConversationMessage, ProjectInfo, SessionInfo};
use std::collections::HashMap;
use std::process::Command;

const UUID_LENGTH: usize = 36;
const RUNNING_SESSION_THRESHOLD_SECS: u64 = 3600;
const TIMESTAMP_PREFIX_LENGTH: usize = 15;

#[tauri::command]
fn list_projects() -> Result<Vec<ProjectInfo>, String> {
    session::list_projects()
}

#[tauri::command]
fn list_sessions(project_dir_name: String) -> Result<Vec<SessionInfo>, String> {
    session::list_sessions(&project_dir_name)
}

#[tauri::command]
fn load_session(
    project_dir_name: String,
    session_id: String,
) -> Result<Vec<ConversationMessage>, String> {
    session::load_session(&project_dir_name, &session_id)
}

#[tauri::command]
fn resume_in_iterm(cwd: String, session_id: String) -> Result<(), String> {
    iterm::resume_session(&cwd, &session_id)
}

#[tauri::command]
fn new_session_in_iterm(cwd: String) -> Result<(), String> {
    iterm::new_session(&cwd)
}

#[tauri::command]
fn delete_session(project_dir_name: String, session_id: String) -> Result<(), String> {
    session::delete_session(&project_dir_name, &session_id)
}

#[tauri::command]
fn queue_deletion(
    project_dir_name: String,
    session_id: String,
    session_title: String,
    cwd: String,
) -> Result<(), String> {
    session::queue_for_deletion(&project_dir_name, &session_id, &session_title, &cwd)
}

#[tauri::command]
fn check_archive_exists(session_id: String) -> Result<bool, String> {
    session::has_archive(&session_id)
}

#[tauri::command]
fn get_custom_titles() -> Result<HashMap<String, String>, String> {
    titles::all_custom_titles()
}

#[tauri::command]
fn set_session_title(session_id: String, title: String) -> Result<(), String> {
    titles::set_custom_title(&session_id, &title)
}

#[tauri::command]
fn refresh_buddy() -> Result<BuddyState, String> {
    buddy::refresh_buddy()
}

#[tauri::command]
fn open_archives_in_finder() -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to resolve home directory")?;
    let archives_dir = home.join(".claude/session-archives");
    Command::new("open")
        .arg(archives_dir)
        .spawn()
        .map_err(|err| format!("Failed to open Finder: {err}"))?;
    Ok(())
}

#[tauri::command]
fn session_file_size(project_dir_name: String, session_id: String) -> Result<u64, String> {
    session::validate_path_input(&project_dir_name)?;
    session::validate_path_input(&session_id)?;
    let home = dirs::home_dir().ok_or("Failed to resolve home directory")?;
    let path = home
        .join(".claude/projects")
        .join(&project_dir_name)
        .join(format!("{session_id}.jsonl"));
    let meta = std::fs::metadata(&path)
        .map_err(|err| format!("Failed to get file size: {err}"))?;
    Ok(meta.len() / 1024)
}

#[tauri::command]
fn running_sessions() -> Result<Vec<String>, String> {
    let output = Command::new("ps")
        .args(["aux"])
        .output()
        .map_err(|err| format!("Failed to run ps: {err}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut session_ids: Vec<String> = Vec::new();
    for line in stdout.lines() {
        for flag in ["--resume ", "-r ", "--session-id "] {
            if let Some(pos) = line.find(flag) {
                let after = &line[pos + flag.len()..];
                let id = after.split_whitespace().next().unwrap_or("");
                if id.len() >= UUID_LENGTH {
                    session_ids.push(id.to_string());
                }
            }
        }
    }

    let home = dirs::home_dir().unwrap_or_default();
    let projects_dir = home.join(".claude/projects");
    if let Ok(projects) = std::fs::read_dir(&projects_dir) {
        let now = std::time::SystemTime::now();
        let recent_threshold = std::time::Duration::from_secs(RUNNING_SESSION_THRESHOLD_SECS);

        for project in projects.flatten() {
            if !project.path().is_dir() {
                continue;
            }
            if let Ok(files) = std::fs::read_dir(project.path()) {
                for file in files.flatten() {
                    let path = file.path();
                    if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                        continue;
                    }
                    if let Ok(meta) = path.metadata() {
                        if let Ok(modified) = meta.modified() {
                            if let Ok(elapsed) = now.duration_since(modified) {
                                if elapsed < recent_threshold {
                                    if let Some(stem) = path.file_stem() {
                                        let id = stem.to_string_lossy().to_string();
                                        if !session_ids.contains(&id) {
                                            session_ids.push(id);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(session_ids)
}

#[tauri::command]
async fn archive_and_delete(
    project_dir_name: String,
    session_id: String,
    cwd: String,
) -> Result<String, String> {
    session::validate_path_input(&project_dir_name)?;
    session::validate_path_input(&session_id)?;
    let home = dirs::home_dir().ok_or("Failed to resolve home directory")?;
    let archives_dir = home.join(".claude/session-archives");
    let archives_dir_str = archives_dir.to_string_lossy().to_string();

    let session_path = home
        .join(".claude/projects")
        .join(&project_dir_name)
        .join(format!("{session_id}.jsonl"));
    let (start_ts, end_ts) = extract_session_timerange(&session_path);
    let session_digest = extract_session_digest(&session_path);

    let prompt = format!(
        r#"Below is a digest of a Claude Code session. Produce a structured overview of what was accomplished.

Output ONLY a valid JSON object (no markdown, no code fences, no explanation before or after) with this structure:
{{
  "sessionId": "{session_id}",
  "startDate": "{start_ts}",
  "endDate": "{end_ts}",
  "project": "<project name from cwd>",
  "cwd": "{cwd}",
  "branch": "<git branch if mentioned, or null>",
  "issueKeys": [],
  "title": "<one-line summary in Korean>",
  "summary": "<2-3 sentence summary in Korean>",
  "tasks": ["<each task accomplished, in Korean>"],
  "filesChanged": ["<files modified>"],
  "decisions": ["<key decisions, in Korean>"],
  "tags": ["<bugfix/feature/refactor/devops/analysis>"]
}}

Be specific, not generic. Write title/summary/tasks/decisions in Korean.

--- SESSION DIGEST ---
{session_digest}"#
    );

    let result = tokio::task::spawn_blocking(move || {
        iterm::run_claude_headless(&cwd, &prompt)
    })
    .await
    .map_err(|err| format!("Task failed: {err}"))??;

    let json_str = extract_json(&result).ok_or("Failed to extract JSON from Claude output")?;

    let parsed: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|err| format!("Failed to parse JSON: {err}"))?;

    let timestamp = parsed.get("startDate")
        .or_else(|| parsed.get("timestamp"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let project = parsed.get("project")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let safe_ts = timestamp.replace([':', '.'], "");
    let ts_prefix = if safe_ts.len() >= TIMESTAMP_PREFIX_LENGTH {
        &safe_ts[..TIMESTAMP_PREFIX_LENGTH]
    } else {
        &safe_ts
    };
    let safe_project = project.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>();
    let filename = format!("{ts_prefix}_{safe_project}.json");
    let filepath = std::path::Path::new(&archives_dir_str).join(&filename);

    std::fs::write(&filepath, serde_json::to_string_pretty(&parsed).unwrap_or_default())
        .map_err(|err| format!("Failed to write archive: {err}"))?;

    Ok(format!("Archived to {filename}"))
}

fn extract_session_timerange(path: &std::path::Path) -> (String, String) {
    let unknown = "unknown".to_string();
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return (unknown.clone(), unknown),
    };
    let reader = std::io::BufReader::new(file);

    let mut first_ts: Option<String> = None;
    let mut last_ts: Option<String> = None;

    use std::io::BufRead;
    for line in reader.lines().flatten() {
        if !line.contains("\"timestamp\"") {
            continue;
        }
        if let Ok(entry) = serde_json::from_str::<serde_json::Value>(&line) {
            let entry_type = entry.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if entry_type != "user" && entry_type != "assistant" {
                continue;
            }
            if let Some(ts) = entry.get("timestamp").and_then(|v| v.as_str()) {
                if first_ts.is_none() {
                    first_ts = Some(ts.to_string());
                }
                last_ts = Some(ts.to_string());
            }
        }
    }

    (
        first_ts.unwrap_or_else(|| unknown.clone()),
        last_ts.unwrap_or(unknown),
    )
}

const DIGEST_MAX_CHARS: usize = 30000;
const USER_MESSAGE_MAX_CHARS: usize = 200;

fn extract_session_digest(path: &std::path::Path) -> String {
    use std::io::BufRead;
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return "Unable to read session file".to_string(),
    };
    let reader = std::io::BufReader::new(file);
    let mut digest = String::new();
    let mut total_chars = 0;

    for line in reader.lines().flatten() {
        if total_chars >= DIGEST_MAX_CHARS {
            digest.push_str("\n... (truncated)\n");
            break;
        }

        let entry = match serde_json::from_str::<serde_json::Value>(&line) {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_type = entry.get("type").and_then(|v| v.as_str()).unwrap_or("");

        match entry_type {
            "user" => {
                let content = entry
                    .get("message")
                    .and_then(|m| m.get("content"))
                    .map(|c| match c {
                        serde_json::Value::String(s) => {
                            if s.len() > USER_MESSAGE_MAX_CHARS {
                                format!("{}...", &s.chars().take(USER_MESSAGE_MAX_CHARS).collect::<String>())
                            } else {
                                s.clone()
                            }
                        }
                        serde_json::Value::Array(arr) => {
                            arr.iter()
                                .filter_map(|block| {
                                    let block_type = block.get("type")?.as_str()?;
                                    match block_type {
                                        "text" => {
                                            let text = block.get("text")?.as_str()?;
                                            if text.len() > USER_MESSAGE_MAX_CHARS {
                                                Some(format!("{}...", &text.chars().take(USER_MESSAGE_MAX_CHARS).collect::<String>()))
                                            } else {
                                                Some(text.to_string())
                                            }
                                        }
                                        _ => None,
                                    }
                                })
                                .collect::<Vec<_>>()
                                .join(" ")
                        }
                        _ => String::new(),
                    })
                    .unwrap_or_default();

                if !content.is_empty() && !content.starts_with("<local-command") {
                    let entry_text = format!("[User] {content}\n");
                    total_chars += entry_text.len();
                    digest.push_str(&entry_text);
                }
            }
            "assistant" => {
                let content = entry
                    .get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|block| {
                                let block_type = block.get("type")?.as_str()?;
                                match block_type {
                                    "text" => {
                                        let text = block.get("text")?.as_str()?;
                                        if text.len() > USER_MESSAGE_MAX_CHARS {
                                            Some(format!("[Text] {}...", &text.chars().take(USER_MESSAGE_MAX_CHARS).collect::<String>()))
                                        } else {
                                            Some(format!("[Text] {text}"))
                                        }
                                    }
                                    "tool_use" => {
                                        let name = block.get("name")?.as_str()?;
                                        let input = block.get("input")?;
                                        let file_path = input.get("file_path")
                                            .or_else(|| input.get("path"))
                                            .or_else(|| input.get("command"))
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("");
                                        Some(format!("[{name}] {file_path}"))
                                    }
                                    _ => None,
                                }
                            })
                            .collect::<Vec<_>>()
                            .join(" | ")
                    })
                    .unwrap_or_default();

                if !content.is_empty() {
                    let entry_text = format!("[Assistant] {content}\n");
                    total_chars += entry_text.len();
                    digest.push_str(&entry_text);
                }
            }
            _ => {}
        }
    }

    if digest.is_empty() {
        "Empty session".to_string()
    } else {
        digest
    }
}

fn extract_json(text: &str) -> Option<String> {
    let start = text.find('{')?;
    let bytes = text.as_bytes();
    let mut depth = 0;
    let mut in_string = false;
    let mut escape_next = false;

    for (i, &byte) in bytes.iter().enumerate().skip(start) {
        if escape_next {
            escape_next = false;
            continue;
        }
        match byte {
            b'\\' if in_string => escape_next = true,
            b'"' => in_string = !in_string,
            b'{' if !in_string => depth += 1,
            b'}' if !in_string => {
                depth -= 1;
                if depth == 0 {
                    return Some(text[start..=i].to_string());
                }
            }
            _ => {}
        }
    }
    None
}

#[tauri::command]
fn list_archives() -> Result<Vec<ArchiveEntry>, String> {
    archive::list_archives()
}

#[tauri::command]
fn delete_archive(filename: String) -> Result<(), String> {
    archive::delete_archive(&filename)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_projects,
            list_sessions,
            load_session,
            resume_in_iterm,
            new_session_in_iterm,
            delete_session,
            queue_deletion,
            check_archive_exists,
            get_custom_titles,
            set_session_title,
            refresh_buddy,
            open_archives_in_finder,
            session_file_size,
            running_sessions,
            archive_and_delete,
            list_archives,
            delete_archive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
