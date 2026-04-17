use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;

struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
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

    let args = shell_words::split(&command)
        .map_err(|err| format!("Failed to parse command: {err}"))?;

    let mut cmd = CommandBuilder::new(&args[0]);
    for arg in &args[1..] {
        cmd.arg(arg);
    }
    cmd.cwd(&cwd);
    cmd.env_remove("ITERM_SESSION_ID");
    cmd.env_remove("ITERM_PROFILE");
    cmd.env_remove("TERM_PROGRAM");
    cmd.env("TERM_PROGRAM", "claude-session-manager");
    cmd.env("TERM", "xterm-256color");

    let _child = pty_pair
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
            },
        );
    }

    let read_terminal_id = terminal_id.clone();
    thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    let _ = app_handle.emit(
                        &format!("terminal-exit-{read_terminal_id}"),
                        (),
                    );
                    break;
                }
                Ok(n) => {
                    let data: Vec<u8> = buffer[..n].to_vec();
                    let _ = app_handle.emit(
                        &format!("terminal-output-{read_terminal_id}"),
                        data,
                    );
                }
                Err(_) => {
                    let _ = app_handle.emit(
                        &format!("terminal-exit-{read_terminal_id}"),
                        (),
                    );
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
    let mut sessions = PTY_SESSIONS
        .lock()
        .map_err(|err| format!("Lock error: {err}"))?;

    sessions.remove(terminal_id);
    Ok(())
}
