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
    if !std::path::Path::new(cwd).is_dir() {
        return Err(format!("Directory does not exist: {cwd}"));
    }

    let safe_cwd = shell_escape(cwd);
    let safe_cmd = shell_command.replace('\\', "\\\\").replace('"', "\\\"");

    let script = format!(
        r#"tell application "iTerm2"
    activate
    set newWindow to (create window with default profile)
    tell current session of newWindow
        write text "cd {safe_cwd} && {safe_cmd}"
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

fn resolve_claude_path() -> Result<String, String> {
    let home = dirs::home_dir().unwrap_or_default();
    let local_bin = home.join(".local/bin/claude");
    if local_bin.exists() {
        return Ok(local_bin.to_string_lossy().to_string());
    }

    for path in CLAUDE_KNOWN_PATHS {
        if Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }

    let output = Command::new("/bin/zsh")
        .arg("-l")
        .arg("-c")
        .arg("which claude")
        .output()
        .map_err(|err| format!("Failed to resolve claude path: {err}"))?;

    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Ok(path);
        }
    }

    Err("Claude CLI not found".to_string())
}

pub fn run_claude_headless(cwd: &str, prompt: &str) -> Result<String, String> {
    let claude_path = resolve_claude_path()?;

    let effective_cwd = if Path::new(cwd).is_dir() {
        cwd.to_string()
    } else {
        dirs::home_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    };

    let output = Command::new("/bin/zsh")
        .arg("-l")
        .arg("-c")
        .arg(format!(
            "cd {} && {} --print {}",
            shell_escape(&effective_cwd),
            shell_escape(&claude_path),
            shell_escape(prompt),
        ))
        .output()
        .map_err(|err| format!("Failed to run claude: {err}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Claude exited with error: {stderr}"))
    }
}

fn shell_escape(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}
