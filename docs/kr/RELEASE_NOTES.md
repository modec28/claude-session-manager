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
