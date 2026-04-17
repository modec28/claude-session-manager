# Changelog

## [0.3.0] - 2026-04-17

### 추가
- 내장 터미널 (xterm.js + PTY): 앱 안에서 Claude 세션 실행
- 세션 뷰 Terminal 버튼: `claude --resume`을 하단 분할 패널에서 실행
- iTerm2 버튼: 외부 터미널 열기 옵션 유지
- 새 세션 모달: 세션 이름 입력 후 터미널 열기
- Cmd+` 터미널 토글 (VS Code 스타일)
- PTY resize 지원: 패널 크기에 맞춰 터미널 자동 조정
- 바이너리 데이터 스트리밍: PTY → xterm.js 원시 바이트 전송 (UTF-8 손상 방지)
- Shift+Enter 멀티라인 입력
- Close 버튼 (빨간색, 눈에 잘 보이게)
- 버디 username 수동 오버라이드: 아바타 클릭으로 GitHub username 변경
- iTerm2 환경 격리: PTY에서 `ITERM_SESSION_ID`/`TERM_PROGRAM` 제거하여 외부 터미널 분할 방지

### 변경
- 새 세션 버튼이 iTerm2 대신 내장 터미널 실행
- 터미널 닫으면 Running 뱃지 자동 해제

## [0.2.0] - 2026-04-17

### 추가
- History 탭: 프로젝트별 작업 히스토리 (경력기술서 형태 — tasks, decisions, files, session timeline)
- 사이드바 토글: Cmd+B 또는 화살표 버튼 클릭 (CSS display로 상태 유지)
- Tab/Shift+Tab으로 탭 순환 이동 (Sessions/Archive/History)
- Cmd+F: Sessions/History 탭에서 사이드바 검색, Archive 탭에서 아카이브 검색 포커스
- 세션/아카이브 검색에서 sessionId, 프로젝트명 매칭 지원
- 사이드바 검색 시 프로젝트 자동 펼침 + 세션 ID/제목 필터링
- 단축키 도움말 (? 아이콘, 호버 시 표시)
- 사이드바 프로젝트 경로/세션 제목 호버 시 전체 텍스트 툴팁

### 변경
- 사이드바가 모든 탭에서 항상 표시 (펼침/접힘 상태 유지)
- 제목 수정: 더블클릭 대신 Rename/Save/Cancel 버튼 방식
- 제목 입력이 uncontrolled ref 방식으로 변경 (폴링 리렌더링에 의한 입력 렉 해소)

## [0.1.1] - 2026-04-17

### 추가
- 단축키: `a`/`ㅁ` (아카이브), `d`/`ㅇ` (삭제), `y`/`ㅛ` (확정), `n`/`ㅜ`/`Escape` (취소)
- 사이드바 키보드 네비게이션: 화살표 순환 인덱스, Enter/Right 펼치기/선택, Left 접기
- 사이드바 10초 자동 폴링 (펼침/접힘 상태 유지)
- 아카이브 파일명에 sessionId 포함 (덮어쓰기 충돌 방지)
- 아카이브 카드에 sessionId 표시
- 아카이브 실패 시 nav bar에 빨간 "failed" 표시
- `list_projects`에서 `archivedCount` 반환, 펼치기 전 정확한 카운트 표시
- Running 뱃지: 앱에서 Resume한 세션만 표시 (ps/mtime 스캔 제거)

### 수정
- 아카이브 시 Rust에서 세션 digest 추출 방식으로 변경 (19MB+ 팀 에이전트 세션 지원)
- 셸 경유 대신 CLI 직접 실행 (특수문자 아카이브 실패 수정)
- `--no-session-persistence`로 아카이브 부산물 세션 방지
- 아카이브 프롬프트에서 스킬 트리거 방지
- 아카이브/삭제 후 사이드바 세션 소실 수정
- 5 msgs 이하 빈 세션 사이드바에서 무조건 필터링
- `<teammate-message>`, `<local-command>` 시스템 텍스트 세션 제목에서 스킵
- `<teammate-message>`는 아카이브 digest에 유지 (팀 에이전트 컨텍스트)
- Archive 탭 전환 시 selected 리셋

## [0.1.0] - 2026-04-16

첫 번째 릴리즈.

### 세션 관리
- 프로젝트별 세션 목록 (타임스탬프, 메시지 수, 모델 표시)
- 세션 대화 스키마 뷰어 (마크다운 렌더링, 코드 syntax highlighting, tool use/result/thinking 접기)
- 커스텀 제목 편집 (더블클릭으로 수정, `~/.claude/session-manager-titles.json` 저장)
- 실행 중인 세션 감지 (`Running` 뱃지, 5초 폴링)
- Sidechain(서브에이전트) 메시지 토글
- iTerm2에서 세션 Resume / 새 세션 실행
- iTerm2, Claude CLI preflight 체크 및 에러 안내

### 아카이브 시스템
- `claude --print`로 세션 자동 요약 → JSON 아카이브 저장
- Archive 탭: 날짜별 타임라인, 프로젝트 필터, 키워드 검색
- startDate ~ endDate 세션 실제 활동 기간 표시
- 아카이브된 세션은 사이드바에서 기본 숨김 (`Show archived` 토글)
- 아카이브 진행 상태: 세션 제목 + 파일 크기 + 경과 시간 실시간 표시
- 탭 전환해도 아카이브 작업 유지 (App 레벨 관리)
- Open in Finder 버튼
- CLAUDE.md에 아카이브 참조 안내 추가

### 버디 위젯
- GitHub 아바타 (git config user.name에서 자동 감지)
- 아카이브 기반 XP 시스템 (task 5XP, file 3XP, decision 8XP, 기본 10XP)
- 100 XP마다 레벨업
- 아카이브 수 / 세션 수 표시

### 보안 (v0.1.0 hardening)
- 모든 Tauri 커맨드에 Path Traversal 방어 (validate_path_component)
- delete_archive에 canonicalize + starts_with 검증
- CSP 활성화 (default-src 'self')
- Shell Injection 방어 (디렉토리 존재 검증 + single-quote 이스케이프)
- MIT 라이선스

### 기타
- Claude 스타일 앱 아이콘
- UTF-8 한글 텍스트 안전 처리 (바이트 슬라이싱 panic 수정)
- 존재하지 않는 cwd 폴백 처리
- Claude CLI PATH 감지 (`~/.local/bin`, homebrew, zsh login shell)
