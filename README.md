# Claude Session Manager

A macOS desktop app for managing Claude Code sessions (Tauri v2 + React)

[한국어 문서](docs/kr/README.md)

## Features

- **Session List**: Sessions grouped by project with timestamp, message count, and model info
- **Session Viewer**: Full conversation schema with markdown rendering, syntax highlighting, collapsible tool use/result/thinking blocks
- **Custom Titles**: Double-click to rename sessions
- **Running Detection**: `Running` badge on sessions currently active in terminal (5s polling)
- **Resume in iTerm2**: Resume any session directly in iTerm2
- **Archive System**: Claude auto-summarizes sessions to JSON archives, viewable in the Archive tab with timeline/search/filter
- **Session Deletion**: Delete original session files
- **Buddy Widget**: GitHub avatar + archive-based XP/level system

## Prerequisites

- macOS (Apple Silicon)
- [iTerm2](https://iterm2.com/) (for session resume)
- [Claude Code CLI](https://claude.ai/claude-code) (for archive feature)

## Installation

### DMG (Recommended)

Download `claude-session-manager_0.1.0_aarch64.dmg` from [Releases](https://github.com/modec28/claude-session-manager/releases) and drag to Applications.

### Build from Source

Requires [Rust](https://rustup.rs/) (1.70+), [Node.js](https://nodejs.org/) (18+), [pnpm](https://pnpm.io/).

```bash
git clone https://github.com/modec28/claude-session-manager.git
cd claude-session-manager
pnpm install
pnpm tauri build
```

Built app: `src-tauri/target/release/bundle/macos/claude-session-manager.app`

Development mode:

```bash
pnpm tauri dev
```

## Configuration

### 1. Session Archive Reference (CLAUDE.md)

Add the following to your global `~/.claude/CLAUDE.md` or project-level `CLAUDE.md` so Claude Code can reference archives:

```markdown
## Session Archives

Work history from past Claude Code sessions is archived as JSON files in `~/.claude/session-archives/`.
Each file contains a work summary, changed files, technical decisions, and related issue keys.

When previous work context is needed, refer to the archive summaries (JSON) by default.
Only read the original JSONL files in `~/.claude/projects/` when the user explicitly requests full session schema.
```

### 2. Summarize Skill (Optional)

A `~/.claude/commands/summarize-session.md` file is created on first use. Run `/summarize-session` in Claude Code to manually archive the current session.

## Data Storage

| Data | Path |
|------|------|
| Session originals (managed by Claude Code) | `~/.claude/projects/<project>/<session-id>.jsonl` |
| Session archives (summaries) | `~/.claude/session-archives/<timestamp>_<project>.json` |
| Custom titles | `~/.claude/session-manager-titles.json` |
| Buddy state | `~/.claude/session-manager-buddy.json` |

## Usage

### Session Management

- Expand a project in the sidebar, click a session to view the conversation schema
- Double-click a session title to rename it
- `Resume in iTerm2` to continue the session in iTerm2
- `Archive` to have Claude summarize and save the session (original preserved)
- `Delete` to remove the original session file

### Archive View

- Switch to `Archive` tab for a date-grouped timeline
- Filter by project, search by keyword
- Click a card to expand details (tasks, changed files, decisions)
- `Open in Finder` to browse archive JSON files

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Rust (Tauri v2)
- **Archive Generation**: Claude Code CLI (`claude --print`)

## License

[MIT](LICENSE)
