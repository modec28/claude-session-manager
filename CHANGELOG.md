# Changelog

[한국어](docs/kr/CHANGELOG.md)

## [0.4.5] - 2026-04-27

### Fixed
- Korean IME composition was broken in the embedded terminal because ESET Endpoint Security hooks `compositionstart/update/end` events on xterm's internal helper textarea, leaving raw jamo to be sent as individual keystrokes. Replaced xterm's input path with our own `<textarea>` (which ESET does not intercept), forwarding composed text to the PTY via `write_terminal`.
- Ctrl+C (and other Ctrl+letter combos) failed to reach the PTY when ESET-induced focus thrash put focus back on xterm's helper textarea. Added a window-level capture-phase keydown listener that forwards Ctrl+letter to the PTY whenever focus is anywhere inside the terminal panel.
- Sticky drag selection: occasional ESET-dropped mouseup events left xterm's selection state stuck, so subsequent mouse movement extended selection without any button held. Added a document-level `mousemove` listener that dispatches a throttled synthetic `mouseup` on `xterm-screen` whenever the mouse moves with no buttons pressed, forcing xterm out of any stuck drag state.

### Added
- Manual mappings for special keys on the new input textarea: arrow keys, Home, End, PageUp/Down, Delete, Tab, Escape, Backspace, Enter (with Shift+Enter still using backslash continuation).
- Cmd+C copies xterm's current selection via `navigator.clipboard.writeText`. Cmd+A maps to `terminal.selectAll()`.
- Devtools enabled in release builds (`tauri = { features = ["devtools"] }`) so future diagnosis of WebView-level interference is possible without a separate debug build.

### Changed
- xterm's internal helper textarea is set to `tabindex="-1"` to keep it out of the focus order; our own offscreen textarea is the canonical input target.

## [0.4.4] - 2026-04-17

### Fixed
- Terminal failed to find `claude` when the binary lived only in `~/.local/bin/claude`. Our PTY wrapper used `$SHELL -l -c`, but `-l -c` is a login + non-interactive combination that sources `.zprofile` only — `.zshrc` (where most users set `~/.local/bin` in PATH) is skipped. Now we resolve the claude binary path in Rust (`claude_cli::resolve_claude_path`) and substitute the full path into the command before handing it to the shell.

### Added
- 10 new Rust unit tests for the terminal command rewriter: bare `claude`, claude with args, leading whitespace, `claudectl` prefix (must not match), absolute-path claude (must not rewrite), shell-quoting of paths with single quotes or spaces. Total suite: 29 tests.

## [0.4.3] - 2026-04-17

### Fixed
- Shift+Enter in terminal submitted the prompt instead of inserting a newline. The earlier `\n` and `\x1b\r` / modifyOtherKeys sequences weren't recognized by Claude Code without specific terminal setup. Now sends backslash+CR (`\\\r`) which Claude Code handles as line continuation in any terminal, and renders cleanly (no visible backslash).

### Added
- Graceful PTY shutdown on app quit. Tauri `WindowEvent::CloseRequested` now drains all active PTY sessions: drop writer/master to send SIGHUP, wait up to 500ms for exit, then SIGKILL if needed. No more orphan `claude` processes after quitting the app.

## [0.4.2] - 2026-04-17

### Fixed
- Terminal killed when navigating to another session and back. Now terminals persist across session navigation — PTY stays alive, Running badge accurate. State lifted from SessionView to App level; all terminals mounted in a persistent pool, visibility controlled by CSS.

### Added
- Version badge next to help icon in nav bar. Hover shows release notes fetched from GitHub, with current version marker and update notification when newer release available.
- Update detection on launch: peach-colored badge with `→ vX.Y.Z` when newer version exists. Click `Update →` opens GitHub releases page for manual DMG download (no auto-install — requires code signing).

### Changed
- Terminal button toggles now: green "Terminal" when closed, red "Close Terminal" when open.
- CSP updated to allow `https://api.github.com` for release metadata.

## [0.4.1] - 2026-04-17

### Fixed
- Terminal panel fails to spawn `claude` when app launched from Finder/Dock — PTY child inherited minimal GUI PATH without shell rc. Commands now run through `$SHELL -l -c` so login shell populates PATH

### Added
- Pre-commit hook: husky + lint-staged running `tsc --noEmit`, `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test` on changed files
- Rust unit tests (19 total): `validate_path_component`, `truncate_chars` (UTF-8/Korean safe), `dir_name_to_display_path`, `extract_json`, `build_archive_filename`

### Changed
- Renamed `iterm.rs` → `claude_cli.rs` (reflects actual contents after v0.4.0 dependency removal)
- `build_archive_filename` extracted into pure helper for testability

### Removed
- Dead code left over from v0.4.0 iTerm/tmux cleanup (preflight_check, AppleScript helpers, unused constants/fields)

## [0.4.0] - 2026-04-17

### Removed
- iTerm2 dependency: removed external terminal launch, AppleScript integration
- tmux dependency: removed `--teammate-mode tmux` from terminal commands
- MultiTerminal auto-detection: removed teams directory polling and agent panel spawning
- `teams.rs` module
- Teammate sub-sessions filtered from sidebar (first user message starts with `<teammate-message>`)

### Changed
- Terminal button runs `claude --resume` directly (no tmux wrapper)
- New session runs `claude` directly (no tmux wrapper)
- Standalone and session terminals use TerminalPanel directly (no MultiTerminal wrapper)
- Prerequisites: only macOS + Claude Code CLI required

## [0.3.0] - 2026-04-17

### Added
- Embedded terminal (xterm.js + PTY): run Claude sessions inside the app
- Terminal button in session view: opens Claude `--resume` in split panel
- iTerm2 button retained as external terminal option
- New session modal: enter session name before opening terminal
- Cmd+` to toggle terminal panel (VS Code style)
- PTY resize support: terminal size syncs with panel resize
- Binary data streaming: raw bytes from PTY to xterm.js (no UTF-8 corruption)
- Shift+Enter for multiline input in terminal
- Close button (red, visible) with Cmd+` shortcut hint
- Buddy username manual override: click avatar to change GitHub username
- iTerm2 environment isolation: `ITERM_SESSION_ID`/`TERM_PROGRAM` removed from PTY env to prevent external terminal hijacking

### Changed
- New session button opens embedded terminal instead of iTerm2
- Terminal stops Running badge on close

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
