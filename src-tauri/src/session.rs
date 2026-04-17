use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

use std::collections::HashSet;

use crate::models::{
    ContentBlock, ConversationMessage, MessageRole, ProjectInfo, RawEntry, SessionInfo,
};

const CLAUDE_PROJECTS_DIR: &str = ".claude/projects";
const TITLE_MAX_CHARS: usize = 57;
const EMPTY_SESSION_THRESHOLD: usize = 5;

pub fn validate_path_input(name: &str) -> Result<(), String> {
    validate_path_component(name)
}

fn validate_path_component(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("Path component cannot be empty".to_string());
    }
    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return Err(format!("Invalid path component: {name}"));
    }
    Ok(())
}

fn truncate_chars(text: &str, max_chars: usize) -> String {
    let char_count = text.chars().count();
    if char_count <= max_chars {
        text.to_string()
    } else {
        let truncated: String = text.chars().take(max_chars).collect();
        format!("{truncated}...")
    }
}

fn projects_base_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to resolve home directory")?;
    Ok(home.join(CLAUDE_PROJECTS_DIR))
}

fn load_archived_session_ids() -> HashSet<String> {
    let mut ids = HashSet::new();
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return ids,
    };
    let archives_dir = home.join(".claude/session-archives");
    if !archives_dir.exists() {
        return ids;
    }

    if let Ok(entries) = fs::read_dir(&archives_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(archive) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(sid) = archive.get("sessionId").and_then(|v| v.as_str()) {
                        ids.insert(sid.to_string());
                    }
                }
            }
        }
    }

    ids
}

fn dir_name_to_display_path(dir_name: &str) -> String {
    let without_leading_dash = dir_name.strip_prefix('-').unwrap_or(dir_name);
    format!("/{}", without_leading_dash.replace('-', "/"))
}

pub fn list_projects() -> Result<Vec<ProjectInfo>, String> {
    let base = projects_base_path()?;
    let entries =
        fs::read_dir(&base).map_err(|err| format!("Failed to read projects dir: {err}"))?;
    let archived_ids = load_archived_session_ids();

    let mut projects: Vec<ProjectInfo> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let dir_name = entry.file_name().to_string_lossy().to_string();
        let mut session_count = 0usize;
        let mut archived_count = 0usize;

        if let Ok(rd) = fs::read_dir(&path) {
            for file_entry in rd.flatten() {
                let file_path = file_entry.path();
                if file_path.extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
                    continue;
                }
                session_count += 1;
                if let Some(stem) = file_path.file_stem() {
                    if archived_ids.contains(&stem.to_string_lossy().to_string()) {
                        archived_count += 1;
                    }
                }
            }
        }

        if session_count == 0 {
            continue;
        }

        projects.push(ProjectInfo {
            display_path: dir_name_to_display_path(&dir_name),
            dir_name,
            session_count,
            archived_count,
        });
    }

    projects.sort_by(|a, b| b.session_count.cmp(&a.session_count));
    Ok(projects)
}

pub fn list_sessions(project_dir_name: &str) -> Result<Vec<SessionInfo>, String> {
    validate_path_component(project_dir_name)?;
    let base = projects_base_path()?;
    let project_path = base.join(project_dir_name);

    if !project_path.is_dir() {
        return Err(format!("Project directory not found: {project_dir_name}"));
    }

    let entries =
        fs::read_dir(&project_path).map_err(|err| format!("Failed to read project dir: {err}"))?;

    let archived_ids = load_archived_session_ids();

    let mut sessions: Vec<SessionInfo> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }

        let session_id = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        let archived = archived_ids.contains(&session_id);

        match extract_session_metadata(&path) {
            Ok(meta) => {
                if meta.message_count <= EMPTY_SESSION_THRESHOLD || meta.is_teammate_session {
                    continue;
                }
                sessions.push(SessionInfo {
                    session_id,
                    archived,
                    title: meta.title,
                    timestamp: meta.timestamp,
                    message_count: meta.message_count,
                    cwd: meta.cwd,
                    model: meta.model,
                })
            }
            Err(_) => continue,
        }
    }

    sessions.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(sessions)
}

struct SessionMetadata {
    title: String,
    timestamp: String,
    message_count: usize,
    is_teammate_session: bool,
    cwd: String,
    model: Option<String>,
}

fn extract_session_metadata(path: &PathBuf) -> Result<SessionMetadata, String> {
    let file = fs::File::open(path).map_err(|err| format!("Failed to open session file: {err}"))?;
    let reader = BufReader::new(file);

    let mut title: Option<String> = None;
    let mut custom_title_found = false;
    let mut timestamp = String::new();
    let mut cwd = String::new();
    let mut model: Option<String> = None;
    let mut message_count: usize = 0;
    let mut metadata_complete = false;
    let mut is_teammate_session = false;
    let mut first_user_checked = false;

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.trim().is_empty() {
            continue;
        }

        if line.contains("\"type\":\"user\"") || line.contains("\"type\": \"user\"") {
            message_count += 1;
            if !first_user_checked {
                first_user_checked = true;
                if line.contains("<teammate-message") {
                    is_teammate_session = true;
                }
            }
        } else if line.contains("\"type\":\"assistant\"")
            || line.contains("\"type\": \"assistant\"")
        {
            message_count += 1;
        }

        if metadata_complete {
            continue;
        }

        let needs_parse = (timestamp.is_empty() && line.contains("\"type\":\"user\""))
            || (timestamp.is_empty() && line.contains("\"type\": \"user\""))
            || (model.is_none() && line.contains("\"assistant\""))
            || line.contains("custom-title")
            || line.contains("ai-title")
            || (title.is_none() && line.contains("\"slug\""));

        if !needs_parse {
            continue;
        }

        let entry: RawEntry = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_type = entry.entry_type.as_deref().unwrap_or("");

        match entry_type {
            "user" => {
                if timestamp.is_empty() {
                    timestamp = entry.timestamp.unwrap_or_default();
                }
                if cwd.is_empty() {
                    cwd = entry.cwd.unwrap_or_default();
                }
                if title.is_none() {
                    if let Some(slug) = &entry.slug {
                        if !slug.is_empty() {
                            title = Some(slug.clone());
                        }
                    }
                }
            }
            "assistant" => {
                if model.is_none() {
                    if let Some(msg) = &entry.message {
                        model = msg.model.clone();
                    }
                }
            }
            "custom-title" => {
                if let Some(ct) = entry.custom_title {
                    title = Some(ct);
                    custom_title_found = true;
                }
            }
            "ai-title" => {
                if !custom_title_found {
                    if let Some(at) = entry.ai_title {
                        title = Some(at);
                    }
                }
            }
            _ => {}
        }

        metadata_complete =
            !timestamp.is_empty() && !cwd.is_empty() && model.is_some() && title.is_some();
    }

    let display_title = title.unwrap_or_else(|| {
        let first_user_text = extract_first_user_text(path);
        if first_user_text.is_empty() {
            "Untitled Session".to_string()
        } else {
            truncate_chars(&first_user_text, TITLE_MAX_CHARS)
        }
    });

    Ok(SessionMetadata {
        title: display_title,
        timestamp,
        message_count,
        is_teammate_session,
        cwd,
        model,
    })
}

const SYSTEM_TEXT_PREFIXES: &[&str] = &[
    "<local-command",
    "<teammate-message",
    "<command-name>",
    "<local-command-stdout>",
];

fn is_system_text(text: &str) -> bool {
    SYSTEM_TEXT_PREFIXES
        .iter()
        .any(|prefix| text.trim_start().starts_with(prefix))
}

fn extract_first_user_text(path: &PathBuf) -> String {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return String::new(),
    };
    let reader = BufReader::new(file);

    for line in reader.lines().map_while(Result::ok) {
        let entry: RawEntry = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(_) => continue,
        };

        if entry.entry_type.as_deref() != Some("user") {
            continue;
        }

        if let Some(msg) = &entry.message {
            if let Some(content) = &msg.content {
                let text = text_from_content(content);
                if !text.is_empty() && !is_system_text(&text) {
                    return text;
                }
            }
        }
    }

    String::new()
}

fn text_from_content(content: &serde_json::Value) -> String {
    match content {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Array(arr) => {
            for item in arr {
                if item.get("type").and_then(|t| t.as_str()) == Some("text") {
                    if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                        return text.to_string();
                    }
                }
            }
            String::new()
        }
        _ => String::new(),
    }
}

pub fn load_session(
    project_dir_name: &str,
    session_id: &str,
) -> Result<Vec<ConversationMessage>, String> {
    validate_path_component(project_dir_name)?;
    validate_path_component(session_id)?;
    let base = projects_base_path()?;
    let session_path = base
        .join(project_dir_name)
        .join(format!("{session_id}.jsonl"));

    if !session_path.exists() {
        return Err(format!("Session file not found: {session_id}"));
    }

    let file =
        fs::File::open(&session_path).map_err(|err| format!("Failed to open session: {err}"))?;
    let reader = BufReader::new(file);
    let mut messages: Vec<ConversationMessage> = Vec::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.trim().is_empty() {
            continue;
        }

        let entry: RawEntry = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_type = entry.entry_type.as_deref().unwrap_or("");

        match entry_type {
            "user" => {
                let content_blocks =
                    parse_content_blocks(entry.message.as_ref().and_then(|m| m.content.as_ref()));
                if content_blocks.is_empty() {
                    continue;
                }
                messages.push(ConversationMessage {
                    uuid: entry.uuid.unwrap_or_default(),
                    role: MessageRole::User,
                    timestamp: entry.timestamp.unwrap_or_default(),
                    content: content_blocks,
                    model: None,
                    is_sidechain: entry.is_sidechain,
                });
            }
            "assistant" => {
                let msg = match &entry.message {
                    Some(m) => m,
                    None => continue,
                };
                let content_blocks = parse_content_blocks(msg.content.as_ref());
                if content_blocks.is_empty() {
                    continue;
                }
                messages.push(ConversationMessage {
                    uuid: entry.uuid.unwrap_or_default(),
                    role: MessageRole::Assistant,
                    timestamp: entry.timestamp.unwrap_or_default(),
                    content: content_blocks,
                    model: msg.model.clone(),
                    is_sidechain: entry.is_sidechain,
                });
            }
            _ => {}
        }
    }

    Ok(messages)
}

fn parse_content_blocks(content: Option<&serde_json::Value>) -> Vec<ContentBlock> {
    let content = match content {
        Some(c) => c,
        None => return Vec::new(),
    };

    match content {
        serde_json::Value::String(s) => {
            if s.is_empty() {
                Vec::new()
            } else {
                vec![ContentBlock::Text { text: s.clone() }]
            }
        }
        serde_json::Value::Array(arr) => arr
            .iter()
            .filter_map(|block| {
                let block_type = block.get("type")?.as_str()?;
                match block_type {
                    "text" => {
                        let text = block.get("text")?.as_str()?.to_string();
                        if text.is_empty() {
                            None
                        } else {
                            Some(ContentBlock::Text { text })
                        }
                    }
                    "tool_use" => Some(ContentBlock::ToolUse {
                        id: block
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        name: block
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        input: block
                            .get("input")
                            .cloned()
                            .unwrap_or(serde_json::Value::Null),
                    }),
                    "tool_result" => Some(ContentBlock::ToolResult {
                        tool_use_id: block
                            .get("tool_use_id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        content: block
                            .get("content")
                            .cloned()
                            .unwrap_or(serde_json::Value::Null),
                    }),
                    "thinking" => {
                        let thinking = block
                            .get("thinking")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        if thinking.is_empty() {
                            None
                        } else {
                            Some(ContentBlock::Thinking { thinking })
                        }
                    }
                    _ => None,
                }
            })
            .collect(),
        _ => Vec::new(),
    }
}

pub fn delete_session(project_dir_name: &str, session_id: &str) -> Result<(), String> {
    validate_path_component(project_dir_name)?;
    validate_path_component(session_id)?;
    let base = projects_base_path()?;
    let session_path = base
        .join(project_dir_name)
        .join(format!("{session_id}.jsonl"));

    if !session_path.exists() {
        return Err(format!("Session file not found: {session_id}"));
    }

    fs::remove_file(&session_path).map_err(|err| format!("Failed to delete session: {err}"))?;

    let session_dir = base.join(project_dir_name).join(session_id);
    if session_dir.is_dir() {
        fs::remove_dir_all(&session_dir)
            .map_err(|err| format!("Failed to delete session directory: {err}"))?;
    }

    Ok(())
}

const PENDING_DELETE_DIR: &str = ".claude/session-pending-delete";

pub fn queue_for_deletion(
    project_dir_name: &str,
    session_id: &str,
    session_title: &str,
    cwd: &str,
) -> Result<(), String> {
    validate_path_component(project_dir_name)?;
    validate_path_component(session_id)?;
    let home = dirs::home_dir().ok_or("Failed to resolve home directory")?;
    let pending_dir = home.join(PENDING_DELETE_DIR);

    if !pending_dir.exists() {
        fs::create_dir_all(&pending_dir)
            .map_err(|err| format!("Failed to create pending dir: {err}"))?;
    }

    let pending = serde_json::json!({
        "sessionId": session_id,
        "projectDirName": project_dir_name,
        "title": session_title,
        "cwd": cwd,
        "queuedAt": chrono::Utc::now().to_rfc3339(),
    });

    let filepath = pending_dir.join(format!("{session_id}.json"));
    let content = serde_json::to_string_pretty(&pending)
        .map_err(|err| format!("Failed to serialize pending entry: {err}"))?;
    fs::write(&filepath, content).map_err(|err| format!("Failed to write pending entry: {err}"))?;

    Ok(())
}

pub fn has_archive(session_id: &str) -> Result<bool, String> {
    let home = dirs::home_dir().ok_or("Failed to resolve home directory")?;
    let archives_dir = home.join(".claude/session-archives");

    if !archives_dir.exists() {
        return Ok(false);
    }

    let archived_ids = load_archived_session_ids();
    Ok(archived_ids.contains(session_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_path_component_accepts_safe_name() {
        assert!(validate_path_component("session-abc_123.jsonl").is_ok());
    }

    #[test]
    fn validate_path_component_rejects_parent_traversal() {
        assert!(validate_path_component("..").is_err());
        assert!(validate_path_component("foo/../bar").is_err());
        assert!(validate_path_component("foo..bar").is_err());
    }

    #[test]
    fn validate_path_component_rejects_separators() {
        assert!(validate_path_component("foo/bar").is_err());
        assert!(validate_path_component("foo\\bar").is_err());
    }

    #[test]
    fn validate_path_component_rejects_empty() {
        assert!(validate_path_component("").is_err());
    }

    #[test]
    fn truncate_chars_preserves_short_text() {
        assert_eq!(truncate_chars("short", 10), "short");
    }

    #[test]
    fn truncate_chars_truncates_with_ellipsis() {
        assert_eq!(truncate_chars("abcdefghij", 5), "abcde...");
    }

    #[test]
    fn truncate_chars_counts_unicode_scalars_not_bytes() {
        let korean = "한글테스트입니다";
        assert_eq!(korean.chars().count(), 8);
        assert_eq!(truncate_chars(korean, 3), "한글테...");
    }

    #[test]
    fn truncate_chars_handles_multibyte_boundary_safely() {
        let mixed = "abc한글def";
        let result = truncate_chars(mixed, 4);
        assert_eq!(result, "abc한...");
    }

    #[test]
    fn dir_name_to_display_path_converts_dashes() {
        assert_eq!(
            dir_name_to_display_path("-Users-grant-project"),
            "/Users/grant/project"
        );
    }

    #[test]
    fn dir_name_to_display_path_handles_no_leading_dash() {
        assert_eq!(dir_name_to_display_path("tmp-x"), "/tmp/x");
    }
}
