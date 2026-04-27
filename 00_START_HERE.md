# 먼저 읽기 - VRChat AI Agent Setup

요청대로 Antigravity를 자동으로 조작하지 않고, 사람이 열어서 복붙할 수 있는 파일과 지침만 정리했다.

## 위치

- Windows: `D:\UserData\vrchat-world-project`
- VM: `/home/khyuha/vrchat-world-project`
- 원본 HTML 보관: `docs/vrchat-ai-agent-setup.html`

## 바로 열 파일

1. `README.md` - 전체 구조와 흐름
2. `AGENTS.md` - Codex가 읽을 프로젝트 지침
3. `.antigravity/rules.md` - Antigravity Rules에 넣을 지침
4. `.antigravity/mcp.json` - Antigravity MCP 설정 예시
5. `prompts/CODEX_MASTER_PROMPT.md` - Codex에 복붙할 실행 프롬프트
6. `prompts/ANTIGRAVITY_ORCHESTRATOR_PROMPT.md` - Antigravity Agent Manager에 복붙할 프롬프트

## 사람이 할 일

### Codex에서

프로젝트 루트로 이동:

```powershell
cd D:\UserData\vrchat-world-project
```

VM에서는:

```bash
cd ~/vrchat-world-project
```

그 다음 `prompts/CODEX_MASTER_PROMPT.md` 내용을 Codex에 붙여넣으면 된다.

### Antigravity에서

1. 프로젝트 폴더를 연다.
   - Windows: `D:\UserData\vrchat-world-project`
   - VM: `/home/khyuha/vrchat-world-project`
2. `.antigravity/rules.md` 내용을 Rules로 사용한다.
3. 필요하면 `.antigravity/mcp.json`을 MCP 설정으로 사용한다.
4. `prompts/ANTIGRAVITY_ORCHESTRATOR_PROMPT.md` 내용을 Agent Manager에 붙여넣는다.

## 현재 상태

- 실제 API 호출/VRChat 업로드/Unity 빌드는 하지 않았다.
- 스크립트들은 안전한 placeholder 상태다.
- JSON 파일들은 샘플로 생성되어 있고 문법 검증 완료.
- VM에도 동일 폴더를 복사했다.
