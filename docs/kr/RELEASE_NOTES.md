# v0.4.4

## `claude not found` 버그 수정 + 테스트 강화

**PATH 버그 재발** — v0.4.1 에서 `$SHELL -l -c` 로 감싸서 해결했다고 생각했던 PATH 문제가 특정 환경에서 재발했습니다. `claude` 가 `~/.local/bin` 에만 있고 그 경로가 `.zshrc` 에서 PATH 에 들어가는 경우, login shell 의 non-interactive 모드는 `.zshrc` 를 안 읽어서 claude 를 못 찾습니다. Rust 에서 claude 바이너리 풀패스를 미리 해석해서 커맨드에 치환하는 방식으로 근본 수정.

**테스트 빡빡하게** — 동일 버그 재발 방지 위해 터미널 커맨드 rewriter 에 10개 유닛 테스트 추가 (bare/인자/공백/prefix/절대경로/쉘 quoting). 총 29개.

**Fixed**
- `~/.local/bin/claude` 만 있을 때 터미널에서 `command not found` 나던 버그 (Rust 에서 풀패스 해석)

**Added**
- 터미널 커맨드 rewriter 유닛 테스트 10개

---

# v0.4.3

## Shift+Enter 개행 + 앱 종료시 PTY 정리

**Shift+Enter** — 터미널에서 Shift+Enter 누르면 프롬프트 제출 대신 개행되도록 수정했습니다. 이전엔 `\n`, `\x1b\r`, modifyOtherKeys 시퀀스 전부 안 먹었는데 backslash+CR (`\\\r`) 로 보내니 Claude Code 가 line continuation 으로 처리해서 어떤 터미널 환경에서도 동작합니다. 백슬래시도 안 보이고 깔끔하게 줄바꿈 됩니다.

**Graceful shutdown** — 앱 종료 (Cmd+Q, Dock 우클릭 Quit 등) 시 실행중이던 앱 내장 터미널의 `claude` 프로세스를 정리합니다. 이전엔 앱만 꺼지고 PTY 자식 프로세스가 좀비로 남을 수 있었는데, 이제 SIGHUP 보내고 500ms 대기 후 안 죽으면 SIGKILL 로 확실히 정리합니다.

**Fixed**
- Shift+Enter 프롬프트 제출 버그 (backslash continuation 방식으로 해결)

**Added**
- 앱 종료시 PTY graceful shutdown (SIGHUP → 500ms → SIGKILL)

---

# v0.4.2

## 터미널 세션간 유지 + 버전 감지

**터미널 지속성** — 터미널 열어두고 다른 세션 갔다와도 이제 안 죽습니다. 내부적으로 터미널 상태를 App 레벨로 끌어올려서 모든 세션의 터미널이 백그라운드 유지되고, 활성 세션 것만 화면에 표시됩니다. PTY/claude 프로세스 살아있고 Running 뱃지도 정확하게 반영됩니다.

**버전 배지** — 네비바 `?` 아이콘 옆에 현재 버전 배지가 생겼습니다. 호버하면 GitHub 에서 최신 릴리즈 노트 목록을 받아와 툴팁으로 보여줍니다.

**업데이트 감지** — 앱 시작시 GitHub 릴리즈와 비교해서 최신 버전이 있으면 배지가 복숭아색으로 바뀌고 `v0.4.2 → v0.5.0` 형태로 표시됩니다. 툴팁 안의 `Update →` 버튼 누르면 릴리즈 페이지가 브라우저에서 열리니 거기서 DMG 받아 설치하세요. (완전 자동 설치는 코드 서명 인증서 필요해서 수동 다운로드 방식입니다.)

**Fixed**
- 세션 전환시 터미널이 죽던 버그 (상태를 App 레벨로 리프트)

**Added**
- 네비바 버전 배지 + 릴리즈 노트 호버 툴팁
- 앱 시작시 최신 버전 감지, 업데이트 알림 + GitHub 릴리즈 링크

**Changed**
- Terminal 버튼: 상태에 따라 "Terminal" (초록) ↔ "Close Terminal" (빨강)
- CSP 에 `https://api.github.com` 추가

---

# v0.4.1

## 터미널 PATH 버그 수정 + 테스트/훅 기반 정비

Finder/Dock 에서 앱을 실행하면 터미널 패널이 `claude` 를 찾지 못하던 버그를 수정했습니다. GUI 앱은 shell rc 를 읽지 않아 PATH 가 최소값으로만 들어있었는데, 이제 `$SHELL -l -c` 로 login shell 경유로 실행하여 PATH 가 정상 로드됩니다.

이와 함께 pre-commit 훅과 Rust 유닛 테스트를 도입했습니다.

**Fixed**
- Finder/Dock 실행 시 터미널 `claude` spawn 실패 (PATH 문제)

**Added**
- Pre-commit 훅 (husky + lint-staged): `tsc --noEmit`, `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test` 자동 실행
- Rust 유닛 테스트 19개 (path traversal, UTF-8 한글 truncation, JSON 추출, archive 파일명 등 순수 함수 위주)

**Changed**
- `iterm.rs` → `claude_cli.rs` 리네임 (v0.4.0 의존성 제거 후 실제 내용에 맞게)

**Removed**
- v0.4.0 정리 잔여 데드 코드 (preflight_check, AppleScript 헬퍼, 미사용 상수/필드)

---

# v0.4.0

## 외부 의존성 제거

iTerm2, tmux 의존성을 완전히 제거했습니다. 앱 내장 터미널(xterm.js + PTY)만으로 모든 세션 관리가 가능합니다.

**사전 요구사항**: macOS + Claude Code CLI만 필요.

---

# v0.3.0

## 내장 터미널

xterm.js + PTY 기반 내장 터미널로 앱 안에서 직접 Claude 세션을 실행할 수 있습니다. iTerm2 없이도 세션 Resume, 새 세션 생성이 가능합니다.

**터미널 기능**
- 세션 뷰 하단에 Terminal 패널 (50/50 분할)
- Cmd+` 로 터미널 토글
- Shift+Enter 멀티라인 입력
- PTY resize: 패널 크기에 맞춰 자동 조정
- 바이너리 스트리밍으로 ANSI 렌더링 정확도 향상
- iTerm2 환경 격리: 팀 에이전트가 외부 터미널을 분할하지 않음

**새 세션 모달** — + New 클릭 시 세션 이름 입력 후 터미널 실행

**버디 username** — 아바타 클릭으로 GitHub username 수동 변경 가능

**iTerm2** — 외부 터미널 열기 옵션은 유지

---

# v0.2.0

## History 탭 + UX 개선

**History 탭** — 아카이브된 세션을 프로젝트별로 그룹핑하여 경력기술서 형태로 표시합니다. 작업 내용, 기술 결정, 변경 파일, 세션 타임라인을 한눈에 확인할 수 있습니다.

**사이드바 개선**
- 모든 탭에서 사이드바 표시 (펼침/접힘 상태 유지)
- Cmd+B로 사이드바 토글
- 세션 ID/제목으로 검색 (자동 펼침)
- 경로/제목 호버 시 전체 텍스트 툴팁

**키보드 단축키**
- Tab/Shift+Tab: 탭 순환 이동
- Cmd+F: 탭에 따라 검색창 포커스
- ?: 단축키 가이드 (호버)

**제목 편집 개선** — Rename 버튼 + Save/Cancel, 입력 렉 해소

---

# v0.1.0

Claude Code 세션을 관리하는 macOS 데스크톱 앱의 첫 릴리즈입니다.

## 주요 기능

**세션 뷰어** — Claude Code의 모든 세션을 프로젝트별로 탐색하고, 대화 스키마를 마크다운/코드 하이라이팅으로 확인할 수 있습니다. 실행 중인 세션은 `Running` 뱃지로 표시됩니다.

**아카이브 시스템** — 세션을 요약하여 JSON으로 아카이브합니다. Claude CLI가 세션 내용을 분석하고 한국어로 요약합니다. 아카이브된 세션은 Archive 탭에서 타임라인/검색/필터로 조회 가능합니다.

**iTerm2 연동** — 세션을 iTerm2에서 바로 이어가거나 새 세션을 실행할 수 있습니다.

**버디 위젯** — GitHub 아바타와 아카이브 기반 XP/레벨 시스템으로 세션 관리를 게이미피케이션합니다.

## 설치

### 빌드

```bash
git clone https://github.com/modec28/claude-session-manager.git
cd claude-session-manager
pnpm install
pnpm tauri build
```

빌드된 앱: `src-tauri/target/release/bundle/macos/claude-session-manager.app`

### DMG

Releases에서 `claude-session-manager_0.1.0_aarch64.dmg`를 다운로드하여 설치할 수 있습니다.

## 사전 요구사항

- macOS (Apple Silicon)
- iTerm2
- Claude Code CLI

## 설정

`~/.claude/CLAUDE.md`에 아래 내용을 추가하면 Claude Code가 아카이브를 참조할 수 있습니다:

```markdown
## 세션 아카이브

과거 Claude Code 세션에서 수행한 작업 히스토리가 ~/.claude/session-archives/ 에 JSON 파일로 아카이브되어 있다.
이전 작업 맥락이 필요할 때는 기본적으로 아카이브 요약(JSON)만 참고할 것.
원본 세션 스키마가 필요한 경우에는 사용자가 명시적으로 요청할 때만 ~/.claude/projects/ 의 JSONL 원본을 읽을 것.
```

## 기술 스택

Tauri v2 + React 19 + Rust + Tailwind CSS
