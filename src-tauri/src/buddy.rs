use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const BUDDY_FILENAME: &str = ".claude/session-manager-buddy.json";
const SESSION_THRESHOLDS: [usize; 4] = [20, 40, 60, 80];
const XP_PER_CLEANUP: u32 = 10;
const XP_PER_LEVEL: u32 = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuddyState {
    pub level: u32,
    pub xp: u32,
    pub total_sessions: usize,
    pub weight_stage: u32,
    pub total_cleanups: u32,
    pub last_session_count: usize,
}

impl Default for BuddyState {
    fn default() -> Self {
        Self {
            level: 1,
            xp: 0,
            total_sessions: 0,
            weight_stage: 0,
            total_cleanups: 0,
            last_session_count: 0,
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

fn count_total_sessions() -> Result<usize, String> {
    let home = dirs::home_dir().ok_or("Failed to resolve home directory")?;
    let projects_dir = home.join(".claude/projects");

    if !projects_dir.exists() {
        return Ok(0);
    }

    let mut count = 0;
    for entry in fs::read_dir(&projects_dir)
        .map_err(|err| format!("Failed to read projects: {err}"))?
        .flatten()
    {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Ok(rd) = fs::read_dir(&path) {
            count += rd
                .flatten()
                .filter(|e| e.path().extension().is_some_and(|ext| ext == "jsonl"))
                .count();
        }
    }

    Ok(count)
}

fn weight_stage_from_sessions(total: usize) -> u32 {
    let mut stage = 0u32;
    for threshold in SESSION_THRESHOLDS {
        if total >= threshold {
            stage += 1;
        }
    }
    stage
}

pub fn refresh_buddy() -> Result<BuddyState, String> {
    let mut state = load_buddy()?;
    let current_sessions = count_total_sessions()?;

    if current_sessions < state.last_session_count && state.last_session_count > 0 {
        let cleaned = state.last_session_count - current_sessions;
        state.total_cleanups += cleaned as u32;
        state.xp += XP_PER_CLEANUP * cleaned as u32;

        while state.xp >= XP_PER_LEVEL {
            state.xp -= XP_PER_LEVEL;
            state.level += 1;
        }
    }

    state.total_sessions = current_sessions;
    state.weight_stage = weight_stage_from_sessions(current_sessions);
    state.last_session_count = current_sessions;

    save_buddy(&state)?;
    Ok(state)
}
