# Changelog

[한국어](docs/kr/CHANGELOG.md)

## [0.2.0] - 2026-04-17

### Added
- History tab: career-style work history grouped by project with tasks, decisions, files, session timeline
- Sidebar toggle: Cmd+B or click arrow button to hide/show (state preserved via CSS display)
- Tab keyboard navigation: Tab/Shift+Tab to cycle Sessions/Archive/History
- Cmd+F: focuses sidebar search (Sessions/History tab) or archive search (Archive tab)
- Session/archive search now matches sessionId and project name
- Sidebar search auto-expands projects and filters sessions by ID/title
- Keyboard shortcuts help tooltip (? icon in nav bar)
- Sidebar hover tooltips for truncated project paths and session titles

### Changed
- Sidebar always visible across all tabs (expand/collapse state preserved)
- Title rename: explicit Rename/Save/Cancel buttons instead of double-click
- Title input uses uncontrolled ref (no lag from re-rendering during typing)
- Sidebar polling (10s) no longer causes input lag

## [0.1.1] - 2026-04-17

### Added
- Keyboard shortcuts: `a`/`ㅁ` (archive), `d`/`ㅇ` (delete), `y`/`ㅛ` (confirm), `n`/`ㅜ`/Escape (cancel)
- Sidebar keyboard navigation: arrow keys with circular index, Enter/Right to expand/select, Left to collapse
- Sidebar 10s auto-polling (expand/collapse state preserved)
- Archive filename includes sessionId to prevent overwrite collisions
- Archive card shows sessionId prefix
- Archive errors shown as red "failed" in nav bar
- `list_projects` returns `archivedCount` for accurate pre-expand count display
- Running badge only for app-launched sessions (removed ps/mtime scanning)

### Fixed
- Archive uses session digest extracted in Rust instead of file reading (supports 19MB+ team agent sessions)
- Archive uses direct CLI execution instead of shell passthrough (fixes special character failures)
- Archive `--no-session-persistence` prevents byproduct sessions
- Archive prompt avoids "summarize" keyword to prevent skill trigger
- Sidebar no longer loses sessions after archive or delete
- Sessions <=5 msgs filtered unconditionally from sidebar
- `<teammate-message>`, `<local-command>` system text skipped in session title extraction
- `<teammate-message>` kept in archive digest for team agent context
- Archive tab switch resets selected session

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

### Security
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
