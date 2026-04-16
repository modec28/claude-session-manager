# Claude Session Manager

Claude Code 세션을 관리하는 macOS 데스크톱 앱 (Tauri v2 + React)

## 주요 기능

- **세션 목록**: 프로젝트별 그룹핑, 타임스탬프/메시지 수/모델 표시
- **세션 뷰어**: 대화 전체 스키마 렌더링 (마크다운, 코드 하이라이팅, tool use/result/thinking 접기)
- **세션 제목 편집**: 더블클릭으로 커스텀 제목 부여
- **실행 중 감지**: 현재 터미널에서 실행 중인 세션에 `Running` 뱃지 표시
- **Resume in iTerm2**: 세션을 iTerm2에서 바로 이어가기
- **아카이브**: Claude가 세션을 자동 요약하여 JSON으로 저장, Archive 탭에서 타임라인 조회
- **세션 삭제**: 원본 세션 파일 삭제
- **버디 위젯**: GitHub 아바타 + 아카이브 기반 XP/레벨 시스템

## 사전 요구사항

- macOS
- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- [pnpm](https://pnpm.io/)
- [iTerm2](https://iterm2.com/) (터미널 연동용)
- [Claude Code CLI](https://claude.ai/claude-code) (아카이브 기능용)

## 설치 및 빌드

```bash
git clone https://github.com/modec28/claude-session-manager.git
cd claude-session-manager
pnpm install
pnpm tauri build
```

빌드된 앱: `src-tauri/target/release/bundle/macos/claude-session-manager.app`

개발 모드:

```bash
pnpm tauri dev
```

## 설정

### 1. Claude Code 세션 아카이브 안내 (CLAUDE.md)

글로벌 `~/.claude/CLAUDE.md` 또는 프로젝트별 `CLAUDE.md`에 아래 내용을 추가하면, Claude Code가 아카이브를 참조할 수 있다:

```markdown
## 세션 아카이브

과거 Claude Code 세션에서 수행한 작업 히스토리가 `~/.claude/session-archives/` 에 JSON 파일로 아카이브되어 있다.
각 파일에는 세션에서 수행한 작업 요약, 변경된 파일 목록, 기술적 결정 사항, 관련 이슈 키 등이 포함되어 있다.

이전 작업 맥락이 필요할 때는 기본적으로 아카이브 요약(JSON)만 참고할 것.
원본 세션 스키마가 필요한 경우에는 사용자가 명시적으로 요청할 때만
`~/.claude/projects/` 의 JSONL 원본을 읽을 것.
```

### 2. 요약 스킬 등록 (선택)

`~/.claude/commands/summarize-session.md` 파일이 설치 시 자동 생성된다. Claude Code 세션에서 `/summarize-session`을 실행하면 현재 세션을 수동으로 아카이브할 수 있다.

## 데이터 저장 위치

| 데이터 | 경로 |
|--------|------|
| 세션 원본 (Claude Code 관리) | `~/.claude/projects/<project>/<session-id>.jsonl` |
| 세션 아카이브 (요약) | `~/.claude/session-archives/<timestamp>_<project>.json` |
| 커스텀 제목 | `~/.claude/session-manager-titles.json` |
| 버디 상태 | `~/.claude/session-manager-buddy.json` |

## 사용법

### 세션 관리

- 사이드바에서 프로젝트 펼치기 → 세션 클릭 → 대화 스키마 확인
- 세션 제목 더블클릭 → 커스텀 제목 편집
- `Resume in iTerm2` → 해당 세션을 iTerm2에서 이어가기
- `Archive` → Claude가 세션을 요약하여 아카이브에 저장 (원본 유지)
- `Delete` → 원본 세션 파일 삭제

### 아카이브 조회

- 상단 `Archive` 탭 → 날짜별 타임라인
- 프로젝트 필터, 키워드 검색 지원
- 카드 클릭 → 상세 내용 (작업 목록, 변경 파일, 기술 결정)

## 기술 스택

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Rust (Tauri v2)
- **아카이브 생성**: Claude Code CLI (`claude --print`)
