use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;
const GRACEFUL_SHUTDOWN_TIMEOUT: Duration = Duration::from_millis(500);

struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
}

lazy_static::lazy_static! {
    static ref PTY_SESSIONS: Arc<Mutex<HashMap<String, PtySession>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

pub fn spawn_terminal(
    app_handle: AppHandle,
    terminal_id: String,
    cwd: String,
    command: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let effective_cols = if cols > 0 { cols } else { DEFAULT_COLS };
    let effective_rows = if rows > 0 { rows } else { DEFAULT_ROWS };

    let pty_pair = pty_system
        .openpty(PtySize {
            rows: effective_rows,
            cols: effective_cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("Failed to open PTY: {err}"))?;

    let login_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let resolved_command = rewrite_claude_command(&command);

    let mut cmd = CommandBuilder::new(&login_shell);
    cmd.arg("-l");
    cmd.arg("-c");
    cmd.arg(&resolved_command);
    cmd.cwd(&cwd);
    cmd.env_remove("ITERM_SESSION_ID");
    cmd.env_remove("ITERM_PROFILE");
    cmd.env_remove("TERM_PROGRAM");
    cmd.env("TERM_PROGRAM", "claude-session-manager");
    cmd.env("TERM", "xterm-256color");

    let child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|err| format!("Failed to spawn command: {err}"))?;

    drop(pty_pair.slave);

    let writer = pty_pair
        .master
        .take_writer()
        .map_err(|err| format!("Failed to get PTY writer: {err}"))?;

    let mut reader = pty_pair
        .master
        .try_clone_reader()
        .map_err(|err| format!("Failed to get PTY reader: {err}"))?;

    {
        let mut sessions = PTY_SESSIONS
            .lock()
            .map_err(|err| format!("Lock error: {err}"))?;
        sessions.insert(
            terminal_id.clone(),
            PtySession {
                writer,
                master: pty_pair.master,
                child,
            },
        );
    }

    let read_terminal_id = terminal_id.clone();
    thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    let _ = app_handle.emit(&format!("terminal-exit-{read_terminal_id}"), ());
                    break;
                }
                Ok(n) => {
                    let data: Vec<u8> = buffer[..n].to_vec();
                    let _ = app_handle.emit(&format!("terminal-output-{read_terminal_id}"), data);
                }
                Err(_) => {
                    let _ = app_handle.emit(&format!("terminal-exit-{read_terminal_id}"), ());
                    break;
                }
            }
        }

        let mut sessions = PTY_SESSIONS.lock().unwrap();
        sessions.remove(&read_terminal_id);
    });

    Ok(())
}

pub fn write_to_terminal(terminal_id: &str, data: &str) -> Result<(), String> {
    let mut sessions = PTY_SESSIONS
        .lock()
        .map_err(|err| format!("Lock error: {err}"))?;

    let session = sessions
        .get_mut(terminal_id)
        .ok_or_else(|| format!("Terminal not found: {terminal_id}"))?;

    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|err| format!("Failed to write to PTY: {err}"))?;

    session
        .writer
        .flush()
        .map_err(|err| format!("Failed to flush PTY: {err}"))?;

    Ok(())
}

pub fn resize_terminal(terminal_id: &str, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = PTY_SESSIONS
        .lock()
        .map_err(|err| format!("Lock error: {err}"))?;

    let session = sessions
        .get(terminal_id)
        .ok_or_else(|| format!("Terminal not found: {terminal_id}"))?;

    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("Failed to resize PTY: {err}"))?;

    Ok(())
}

pub fn close_terminal(terminal_id: &str) -> Result<(), String> {
    let session = {
        let mut sessions = PTY_SESSIONS
            .lock()
            .map_err(|err| format!("Lock error: {err}"))?;
        sessions.remove(terminal_id)
    };

    if let Some(session) = session {
        graceful_kill(session);
    }
    Ok(())
}

pub fn shutdown_all_terminals() {
    let drained: Vec<PtySession> = match PTY_SESSIONS.lock() {
        Ok(mut guard) => guard.drain().map(|(_, session)| session).collect(),
        Err(_) => return,
    };

    for session in drained {
        graceful_kill(session);
    }
}

fn rewrite_claude_command(command: &str) -> String {
    match crate::claude_cli::resolve_claude_path() {
        Ok(path) => substitute_claude_binary(command, &path),
        Err(_) => command.to_string(),
    }
}

fn substitute_claude_binary(command: &str, claude_path: &str) -> String {
    let trimmed = command.trim_start();
    let quoted = shell_quote_single(claude_path);

    if trimmed == "claude" {
        return quoted;
    }

    match trimmed.strip_prefix("claude ") {
        Some(rest) => format!("{quoted} {rest}"),
        None => command.to_string(),
    }
}

fn shell_quote_single(path: &str) -> String {
    let escaped = path.replace('\'', "'\\''");
    format!("'{escaped}'")
}

fn graceful_kill(mut session: PtySession) {
    drop(session.writer);
    drop(session.master);

    let deadline = Instant::now() + GRACEFUL_SHUTDOWN_TIMEOUT;
    loop {
        match session.child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) if Instant::now() >= deadline => break,
            Ok(None) => thread::sleep(Duration::from_millis(25)),
            Err(_) => break,
        }
    }

    let _ = session.child.kill();
    let _ = session.child.wait();
}

#[cfg(test)]
mod tests {
    use super::*;

    const FAKE_PATH: &str = "/Users/grant/.local/bin/claude";

    #[test]
    fn substitute_replaces_bare_claude() {
        assert_eq!(
            substitute_claude_binary("claude", FAKE_PATH),
            "'/Users/grant/.local/bin/claude'"
        );
    }

    #[test]
    fn substitute_replaces_claude_with_args() {
        assert_eq!(
            substitute_claude_binary("claude --resume abc123", FAKE_PATH),
            "'/Users/grant/.local/bin/claude' --resume abc123"
        );
    }

    #[test]
    fn substitute_preserves_trailing_flags_and_quoted_args() {
        assert_eq!(
            substitute_claude_binary("claude --name \"feature/login\"", FAKE_PATH),
            "'/Users/grant/.local/bin/claude' --name \"feature/login\""
        );
    }

    #[test]
    fn substitute_trims_leading_whitespace_before_matching() {
        assert_eq!(
            substitute_claude_binary("   claude --resume x", FAKE_PATH),
            "'/Users/grant/.local/bin/claude' --resume x"
        );
    }

    #[test]
    fn substitute_does_not_touch_non_claude_commands() {
        assert_eq!(
            substitute_claude_binary("echo hello", FAKE_PATH),
            "echo hello"
        );
    }

    #[test]
    fn substitute_does_not_match_claude_as_prefix_substring() {
        assert_eq!(
            substitute_claude_binary("claudectl --help", FAKE_PATH),
            "claudectl --help"
        );
    }

    #[test]
    fn substitute_does_not_match_absolute_path_claude() {
        assert_eq!(
            substitute_claude_binary("/usr/local/bin/claude --resume x", FAKE_PATH),
            "/usr/local/bin/claude --resume x"
        );
    }

    #[test]
    fn shell_quote_wraps_in_single_quotes() {
        assert_eq!(shell_quote_single("/tmp/foo"), "'/tmp/foo'");
    }

    #[test]
    fn shell_quote_escapes_embedded_single_quote() {
        assert_eq!(shell_quote_single("/tmp/it's"), "'/tmp/it'\\''s'");
    }

    #[test]
    fn shell_quote_preserves_spaces() {
        assert_eq!(
            shell_quote_single("/Users/me/My Apps/claude"),
            "'/Users/me/My Apps/claude'"
        );
    }
}
