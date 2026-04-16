# Changelog

## [0.1.1] - 2026-04-16

### 수정
- 아카이브 시 파일 직접 읽기 대신 세션 digest 추출 방식으로 변경 (19MB 팀 에이전트 세션 지원)
- 셸 경유 대신 CLI 직접 실행 (single-quote/특수문자 아카이브 실패 수정)
- 아카이브/삭제 후 사이드바 세션 소실 수정 (캐시 초기화 방식 변경)
- 빈 시스템 세션 (팀 에이전트 스텁) 사이드바에서 필터링
- 아카이브 프롬프트에서 스킬 트리거 방지
- `--no-session-persistence` 추가로 아카이브 부산물 세션 방지
- 삭제 취소에 `n` 키 추가

### 추가
- 단축키: `a` (아카이브), `d` (삭제), `y` (확정), `n`/`Escape` (취소)
- 사이드바 키보드 네비게이션: 화살표로 이동, Enter/Right로 펼치기/선택, Left로 접기

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
