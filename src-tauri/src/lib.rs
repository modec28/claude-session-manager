mod archive;
mod buddy;
mod claude_cli;
mod models;
mod session;
mod terminal;
mod titles;

use archive::ArchiveEntry;
use buddy::BuddyState;
use models::{ConversationMessage, ProjectInfo, SessionInfo};
use std::collections::HashMap;
use std::process::Command;

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
fn set_buddy_username(username: String) -> Result<(), String> {
    buddy::set_username(&username)
}

#[tauri::command]
fn spawn_terminal(
    app_handle: tauri::AppHandle,
    terminal_id: String,
    cwd: String,
    command: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    terminal::spawn_terminal(app_handle, terminal_id, cwd, command, cols, rows)
}

#[tauri::command]
fn write_terminal(terminal_id: String, data: String) -> Result<(), String> {
    terminal::write_to_terminal(&terminal_id, &data)
}

#[tauri::command]
fn resize_terminal(terminal_id: String, cols: u16, rows: u16) -> Result<(), String> {
    terminal::resize_terminal(&terminal_id, cols, rows)
}

#[tauri::command]
fn close_terminal(terminal_id: String) -> Result<(), String> {
    terminal::close_terminal(&terminal_id)
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
    let meta = std::fs::metadata(&path).map_err(|err| format!("Failed to get file size: {err}"))?;
    Ok(meta.len() / 1024)
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

    let result =
        tokio::task::spawn_blocking(move || claude_cli::run_claude_headless(&cwd, &prompt))
            .await
            .map_err(|err| format!("Task failed: {err}"))??;

    let json_str = extract_json(&result).ok_or("Failed to extract JSON from Claude output")?;

    let parsed: serde_json::Value =
        serde_json::from_str(&json_str).map_err(|err| format!("Failed to parse JSON: {err}"))?;

    let timestamp = parsed
        .get("startDate")
        .or_else(|| parsed.get("timestamp"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let project = parsed
        .get("project")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let filename = build_archive_filename(timestamp, project, &session_id);
    let filepath = std::path::Path::new(&archives_dir_str).join(&filename);

    std::fs::write(
        &filepath,
        serde_json::to_string_pretty(&parsed).unwrap_or_default(),
    )
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
    for line in reader.lines().map_while(Result::ok) {
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

    for line in reader.lines().map_while(Result::ok) {
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
                                format!(
                                    "{}...",
                                    &s.chars().take(USER_MESSAGE_MAX_CHARS).collect::<String>()
                                )
                            } else {
                                s.clone()
                            }
                        }
                        serde_json::Value::Array(arr) => arr
                            .iter()
                            .filter_map(|block| {
                                let block_type = block.get("type")?.as_str()?;
                                match block_type {
                                    "text" => {
                                        let text = block.get("text")?.as_str()?;
                                        if text.len() > USER_MESSAGE_MAX_CHARS {
                                            Some(format!(
                                                "{}...",
                                                &text
                                                    .chars()
                                                    .take(USER_MESSAGE_MAX_CHARS)
                                                    .collect::<String>()
                                            ))
                                        } else {
                                            Some(text.to_string())
                                        }
                                    }
                                    _ => None,
                                }
                            })
                            .collect::<Vec<_>>()
                            .join(" "),
                        _ => String::new(),
                    })
                    .unwrap_or_default();

                let is_system =
                    content.starts_with("<local-command") || content.starts_with("<command-name>");
                if !content.is_empty() && !is_system {
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
                                            Some(format!(
                                                "[Text] {}...",
                                                &text
                                                    .chars()
                                                    .take(USER_MESSAGE_MAX_CHARS)
                                                    .collect::<String>()
                                            ))
                                        } else {
                                            Some(format!("[Text] {text}"))
                                        }
                                    }
                                    "tool_use" => {
                                        let name = block.get("name")?.as_str()?;
                                        let input = block.get("input")?;
                                        let file_path = input
                                            .get("file_path")
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

fn build_archive_filename(timestamp: &str, project: &str, session_id: &str) -> String {
    let safe_ts = timestamp.replace([':', '.'], "");
    let ts_prefix = if safe_ts.len() >= TIMESTAMP_PREFIX_LENGTH {
        &safe_ts[..TIMESTAMP_PREFIX_LENGTH]
    } else {
        &safe_ts
    };
    let safe_project: String = project
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let short_id = &session_id[..8.min(session_id.len())];
    format!("{ts_prefix}_{safe_project}_{short_id}.json")
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
            delete_session,
            queue_deletion,
            check_archive_exists,
            get_custom_titles,
            set_session_title,
            refresh_buddy,
            set_buddy_username,
            open_archives_in_finder,
            session_file_size,
            archive_and_delete,
            list_archives,
            delete_archive,
            spawn_terminal,
            write_terminal,
            resize_terminal,
            close_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_json_picks_balanced_object() {
        let input = "prefix text {\"a\":1,\"b\":{\"c\":2}} trailing";
        assert_eq!(
            extract_json(input),
            Some("{\"a\":1,\"b\":{\"c\":2}}".to_string())
        );
    }

    #[test]
    fn extract_json_ignores_braces_in_strings() {
        let input = r#"{"msg":"not a {brace}","n":1}"#;
        assert_eq!(extract_json(input), Some(input.to_string()));
    }

    #[test]
    fn extract_json_handles_escaped_quotes() {
        let input = r#"{"msg":"a \"quoted\" word","n":1}"#;
        assert_eq!(extract_json(input), Some(input.to_string()));
    }

    #[test]
    fn extract_json_returns_none_when_no_object() {
        assert_eq!(extract_json("just text"), None);
    }

    #[test]
    fn extract_json_returns_none_when_unbalanced() {
        assert_eq!(extract_json("{\"a\":1"), None);
    }

    #[test]
    fn build_archive_filename_strips_timestamp_separators() {
        let filename = build_archive_filename(
            "2026-04-17T10:18:23.456Z",
            "my-project",
            "13a52e92-d24b-4033-ad3f-228c4b95f5eb",
        );
        assert_eq!(filename, "2026-04-17T1018_my-project_13a52e92.json");
    }

    #[test]
    fn build_archive_filename_replaces_unsafe_project_chars() {
        let filename = build_archive_filename(
            "2026-04-17T10:18:23Z",
            "/Users/grant/onboarding",
            "abcdef1234567890",
        );
        assert!(filename.contains("_Users_grant_onboarding_"));
        assert!(filename.ends_with("_abcdef12.json"));
    }

    #[test]
    fn build_archive_filename_truncates_short_session_id() {
        let filename = build_archive_filename("2026-04-17T00:00:00Z", "p", "abc");
        assert!(filename.ends_with("_p_abc.json"));
    }

    #[test]
    fn build_archive_filename_handles_unknown_timestamp() {
        let filename = build_archive_filename("unknown", "project", "abcdef12");
        assert!(filename.starts_with("unknown_project_abcdef12"));
    }
}
