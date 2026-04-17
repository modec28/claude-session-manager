use std::path::Path;
use std::process::Command;

const CLAUDE_KNOWN_PATHS: &[&str] = &["/usr/local/bin/claude", "/opt/homebrew/bin/claude"];

pub fn resolve_claude_path() -> Result<String, String> {
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

    let output = Command::new(&claude_path)
        .arg("--print")
        .arg("--no-session-persistence")
        .arg(prompt)
        .current_dir(&effective_cwd)
        .output()
        .map_err(|err| format!("Failed to run claude: {err}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Err(format!(
            "Claude exited with error.\nstderr: {stderr}\nstdout: {stdout}"
        ))
    }
}
