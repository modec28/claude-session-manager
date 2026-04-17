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
