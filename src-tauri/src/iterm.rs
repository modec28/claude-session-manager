use std::path::Path;
use std::process::Command;

const ITERM2_APP_PATH: &str = "/Applications/iTerm.app";

const CLAUDE_KNOWN_PATHS: &[&str] = &[
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
];

fn is_iterm2_installed() -> bool {
    Path::new(ITERM2_APP_PATH).exists()
}

fn resolve_via_shell(binary: &str) -> bool {
    Command::new("/bin/zsh")
        .arg("-l")
        .arg("-c")
        .arg(format!("which {binary}"))
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn is_claude_installed() -> bool {
    let home = dirs::home_dir().unwrap_or_default();
    let local_bin = home.join(".local/bin/claude");
    if local_bin.exists() {
        return true;
    }

    for path in CLAUDE_KNOWN_PATHS {
        if Path::new(path).exists() {
            return true;
        }
    }

    resolve_via_shell("claude")
}

pub fn preflight_check() -> Result<(), String> {
    if !is_claude_installed() {
        return Err(
            "Claude CLI is not installed.\n\
             Install: npm install -g @anthropic-ai/claude-code"
                .to_string(),
        );
    }

    if !is_iterm2_installed() {
        return Err(
            "iTerm2 is not installed.\n\
             Download: https://iterm2.com/downloads.html"
                .to_string(),
        );
    }

    Ok(())
}

fn run_applescript(cwd: &str, shell_command: &str) -> Result<(), String> {
    let escaped_cwd = cwd.replace('\\', "\\\\").replace('"', "\\\"");
    let escaped_cmd = shell_command.replace('\\', "\\\\").replace('"', "\\\"");

    let script = format!(
        r#"tell application "iTerm2"
    activate
    set newWindow to (create window with default profile)
    tell current session of newWindow
        write text "cd \"{escaped_cwd}\" && {escaped_cmd}"
    end tell
end tell"#
    );

    Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|err| format!("Failed to launch iTerm2: {err}"))?;

    Ok(())
}

pub fn resume_session(cwd: &str, session_id: &str) -> Result<(), String> {
    preflight_check()?;
    run_applescript(cwd, &format!("claude --resume {session_id}"))
}

pub fn new_session(cwd: &str) -> Result<(), String> {
    preflight_check()?;
    run_applescript(cwd, "claude")
}
