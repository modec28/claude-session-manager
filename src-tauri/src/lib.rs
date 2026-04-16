mod buddy;
mod iterm;
mod models;
mod session;
mod titles;

use buddy::BuddyState;
use models::{ConversationMessage, ProjectInfo, SessionInfo};
use std::collections::HashMap;

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
            get_custom_titles,
            set_session_title,
            refresh_buddy,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
