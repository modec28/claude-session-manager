# CLAUDE.md

이 프로젝트를 이어받는 에이전트를 위한 가이드. 컨텍스트가 compact 되면 이 문서를 먼저 읽자.

## 이 앱이 하는 일

macOS Tauri v2 데스크탑 앱. `~/.claude/projects/*.jsonl` 의 Claude Code 세션을 탐색/뷰어/아카이브. 앱 내장 xterm.js 터미널로 `claude --resume` 실행.

- Frontend: React 19 + TS + Tailwind v4 (`src/`)
- Backend: Rust + Tauri (`src-tauri/src/`)
- 외부 의존성: macOS + Claude Code CLI **뿐**. iTerm2/tmux 는 v0.4.0 에서 완전 제거됨 — 되살리지 말 것.

## 반복되는 함정 (이 프로젝트에서 실제로 밟았던 것들)

### macOS GUI 앱 PATH
Finder/Dock 에서 띄우면 PATH 가 `/usr/bin:/bin:/usr/sbin:/sbin` 만 들어있다. `.zshrc` 안 읽힘. 서브프로세스로 `claude` 같은 유저 바이너리 실행하려면 반드시 `$SHELL -l -c "<cmd>"` 로 감싸 login shell 경유. `src-tauri/src/terminal.rs:43` 참고.

### UTF-8 바이트 슬라이싱 금지
한글 포함 문자열 truncation 에서 `&s[..n]` 쓰면 panic. 항상 `.chars().take(n).collect()` 사용. `session.rs::truncate_chars` 참고. 한글 세션 제목이 6400개+ 섞여있어서 이거 빠지면 바로 깨짐.

### 아카이브 파일명 충돌
같은 프로젝트에서 비슷한 시간에 아카이브하면 이전 것을 덮어썼던 버그 있었음. 파일명에 `sessionId[..8]` 반드시 포함. `lib.rs::build_archive_filename` 참고 — 유닛 테스트로 픽스됨.

### 한글 입력 모드에서 키보드 단축키
`event.key` 는 한글 입력 모드에선 `ㅁ`, `ㅇ` 같은 자모가 들어옴. 단축키는 전부 `event.code` 기반 (`KeyA`, `KeyD` 등). `SessionView.tsx:77` 참고.

### 대용량 세션 (19MB+ 팀 에이전트 세션)
`claude --print` 에게 JSONL 파일 전체를 먹이면 터짐. Rust 에서 먼저 digest 추출해서 prompt 에 inline 해서 넘김. `lib.rs::extract_session_digest` 참고. `DIGEST_MAX_CHARS = 30000` 이 한계선.

### Path traversal / 파일명 검증
Tauri command 로 들어오는 모든 경로 컴포넌트는 `session::validate_path_input` 통과시켜야 함. `delete_archive` 는 `canonicalize() + starts_with` 로 한 번 더 검증. 보안 회귀 방지를 위해 유닛 테스트 있음.

### 아카이브 시 부산물 세션
`claude --print` 실행하면 그 자체가 세션으로 기록될 수 있음. 반드시 `--no-session-persistence` 붙이기. `claude_cli.rs::run_claude_headless` 참고.

### PTY 에서 iTerm2 환경 변수 상속
상위가 iTerm2 면 `ITERM_SESSION_ID`, `TERM_PROGRAM` 이 상속되어 팀 에이전트가 외부 iTerm2 를 분할시켜버림. `terminal.rs` 에서 명시적으로 `env_remove` 하고 `TERM_PROGRAM=claude-session-manager` 로 덮어씀.

### 터미널 상태는 App 레벨에 둘 것 (v0.4.2)
세션 뷰에 로컬 state 로 터미널을 가지면 세션 전환시 SessionView 언마운트 → TerminalPanel cleanup → PTY 종료로 `claude` 프로세스가 죽음. 터미널 상태는 반드시 `App.tsx` 의 `sessionTerminals` 맵에 둘 것. 모든 터미널은 persistent pool 에 마운트되고 CSS display 로만 활성 세션 것 표시.

### Shift+Enter 는 backslash+CR (v0.4.3)
Claude Code TUI 에 Shift+Enter 개행을 보내려면 `\x1b\r` (Option+Enter), modifyOtherKeys `\x1b[27;2;13~` 전부 안 먹음 (terminal-setup 으로 매핑된 환경에서만 동작). 대신 `\\\r` (backslash + CR) 로 보내면 Claude 가 line continuation 으로 해석해서 모든 환경에서 동작하고 렌더링도 깨끗함. `TerminalPanel.tsx::attachCustomKeyEventHandler` 참고.

### 앱 종료시 PTY graceful shutdown (v0.4.3)
PTY 자식을 그냥 두면 부모 사망시 orphan 으로 남을 수 있음. `terminal.rs::shutdown_all_terminals` 가 Tauri `WindowEvent::CloseRequested` 에서 호출되어 writer/master drop → SIGHUP → 500ms 대기 → SIGKILL 순으로 정리. 새 터미널 기능 추가할 때 `PtySession.child: Box<dyn Child + Send + Sync>` 에 자식 핸들 유지 필수.

## 버전 올릴 때 수정할 3개 파일

1. `package.json` `version`
2. `src-tauri/tauri.conf.json` `version`
3. `src-tauri/Cargo.toml` `[package] version`

그 후 `cd src-tauri && cargo check` 로 `Cargo.lock` 갱신.

## 빌드 / 로컬 설치 / 동작 확인

```sh
pnpm tauri build
# → src-tauri/target/release/bundle/dmg/claude-session-manager_<ver>_aarch64.dmg
# → src-tauri/target/release/bundle/macos/claude-session-manager.app
```

설치된 버전이 구버전이면 **앱이 새로 빌드된걸 안 읽는다**. 항상 replace:

```sh
osascript -e 'tell application "claude-session-manager" to quit'
rm -rf /Applications/claude-session-manager.app
cp -R src-tauri/target/release/bundle/macos/claude-session-manager.app /Applications/
open /Applications/claude-session-manager.app
```

버전 확인: `/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" /Applications/claude-session-manager.app/Contents/Info.plist`

UI 동작은 터미널에서 `pnpm tauri build` 후 빌드된 앱을 Finder 실행으로 확인. `pnpm tauri dev` 는 터미널 상속 PATH 라 PATH 버그 못 잡음 — Finder 실행 테스트 꼭 포함.

## Pre-commit 훅

husky + lint-staged. 스테이지된 파일 기준으로 동작:
- `.ts/.tsx` 변경 → `tsc --noEmit`
- `src-tauri/src/*.rs` 변경 → `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`

Clippy 가 warning 도 error 로 막음. 데드 코드 남기지 말 것. `flatten()` on `Lines` 금지 (`map_while(Result::ok)` 사용).

## 릴리즈 플로우

1. 브랜치 따서 작업 (직접 main 푸시 불가 — branch protection)
2. 버전 3곳 올리고 `CHANGELOG.md` + `docs/kr/CHANGELOG.md` + `docs/kr/RELEASE_NOTES.md` 업데이트
3. 커밋 (pre-commit 훅이 fmt/clippy/test 돌림)
4. `git push -u origin <branch>` + `gh pr create`
5. 사용자가 머지
6. `git checkout main && git pull`
7. `gh release create v<ver> <dmg-path> --title "v<ver>" --notes "..."` — **반드시 `--notes` 로 inline**. `--notes-file` 쓰면 RELEASE_NOTES.md 가 누적되어 이전 버전 전부 표시됨 (v0.3.0 에서 실제로 일어남)

## 의도적으로 제거된 것 (되살리지 말 것)

- iTerm2 통합 / AppleScript (v0.4.0)
- tmux 래퍼 / `--teammate-mode tmux` (v0.4.0)
- `teams.rs`, `MultiTerminal.tsx` (v0.4.0)
- 팀 에이전트 자동 패널 분할 — Claude Code 의 내부 아키텍처상 외부에서 attach 불가. 시도하지 말 것.

팀 에이전트는 외부 iTerm2 + tmux 환경에서 사용자가 따로 돌림. 이 앱은 거기 관여 안 함.

## 디렉토리 빠른 참조

```
src/
  App.tsx                   탭/선택/키보드 단축키 최상위
  components/
    session/SessionView.tsx   세션 뷰, 터미널 토글, rename
    terminal/TerminalPanel.tsx xterm.js + PTY bridge
  api.ts                    Tauri invoke 래퍼
src-tauri/src/
  lib.rs                    Tauri command 핸들러, archive_and_delete
  session.rs                JSONL 파싱, 경로 검증, truncate
  archive.rs                아카이브 CRUD, path traversal 방어
  terminal.rs               PTY spawn, resize, write, close
  claude_cli.rs             claude 바이너리 경로 탐색 + headless 실행
  buddy.rs                  XP/레벨, GitHub 아바타
  titles.rs                 커스텀 세션 제목 저장
  models.rs                 RawEntry/RawMessage/ContentBlock
```

외부 경로:
- `~/.claude/projects/<dir>/<sessionId>.jsonl` — Claude Code 원본 세션
- `~/.claude/session-archives/*.json` — 이 앱이 만든 아카이브
- `~/.claude/session-manager-titles.json` — 커스텀 제목
- `~/.claude/session-manager-buddy.json` — 버디 상태

## 테스트

`cd src-tauri && cargo test` — 19개 순수 함수 테스트. 프런트엔드 테스트는 없음. 보안 경계 함수 (`validate_path_component`, archive filename) 는 항상 테스트 커버리지 유지.
