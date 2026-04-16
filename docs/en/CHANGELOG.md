# Changelog

## [0.1.0] - 2026-04-16

First release.

### Session Management
- Session list grouped by project (timestamp, message count, model)
- Session conversation schema viewer (markdown rendering, syntax highlighting, collapsible tool use/result/thinking blocks)
- Custom title editing (double-click to rename, stored in `~/.claude/session-manager-titles.json`)
- Running session detection (`Running` badge, 5s polling)
- Sidechain (sub-agent) message toggle
- Resume session / new session in iTerm2
- iTerm2 and Claude CLI preflight checks with error guidance

### Archive System
- Auto-summarize sessions via `claude --print` to JSON archives
- Archive tab: date-grouped timeline, project filter, keyword search
- startDate ~ endDate showing actual session activity period
- Archived sessions hidden from sidebar by default (`Show archived` toggle)
- Archive progress: real-time session title + file size + elapsed time display
- Archive jobs survive tab switching (App-level management)
- Open in Finder button
- CLAUDE.md archive reference guide

### Buddy Widget
- GitHub avatar (detected from git config user.name)
- Archive-based XP system (task 5XP, file 3XP, decision 8XP, base 10XP)
- Level up every 100 XP
- Archive count / session count display

### Security (v0.1.0 hardening)
- Path traversal prevention on all Tauri commands (validate_path_component)
- Canonicalize + starts_with check on delete_archive
- CSP enabled (default-src 'self')
- Shell injection defense (directory existence check + single-quote escaping)
- MIT License

### Other
- Claude-style app icon
- UTF-8 safe truncation for Korean text
- Fallback for non-existent cwd paths
- Claude CLI PATH detection (~/.local/bin, homebrew, zsh login shell)
