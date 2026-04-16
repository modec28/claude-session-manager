use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

const TITLES_FILENAME: &str = ".claude/session-manager-titles.json";

fn titles_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Failed to resolve home directory")?;
    Ok(home.join(TITLES_FILENAME))
}

fn load_titles_map() -> Result<HashMap<String, String>, String> {
    let path = titles_path()?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content = fs::read_to_string(&path)
        .map_err(|err| format!("Failed to read titles file: {err}"))?;
    serde_json::from_str(&content)
        .map_err(|err| format!("Failed to parse titles file: {err}"))
}

fn save_titles_map(titles: &HashMap<String, String>) -> Result<(), String> {
    let path = titles_path()?;
    let content = serde_json::to_string_pretty(titles)
        .map_err(|err| format!("Failed to serialize titles: {err}"))?;
    fs::write(&path, content)
        .map_err(|err| format!("Failed to write titles file: {err}"))
}

pub fn custom_title(session_id: &str) -> Result<Option<String>, String> {
    let titles = load_titles_map()?;
    Ok(titles.get(session_id).cloned())
}

pub fn set_custom_title(session_id: &str, title: &str) -> Result<(), String> {
    let mut titles = load_titles_map()?;
    if title.is_empty() {
        titles.remove(session_id);
    } else {
        titles.insert(session_id.to_string(), title.to_string());
    }
    save_titles_map(&titles)
}

pub fn all_custom_titles() -> Result<HashMap<String, String>, String> {
    load_titles_map()
}
