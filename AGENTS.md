# VRChat AI Pipeline — Codex Agent Context

## 프로젝트 목표
유저 텍스트 입력으로부터 VRChat에 업로드 가능한 월드를 자동 생성한다.
현재 타겟: **벨튀 대작전 — 사이버펑크 아파트 멀티플레이 게임 월드**

## 폴더 구조
/world_spec/       — world_spec.json, room_graph.json, asset_manifest.json
/assets/raw/       — AI 생성 원본 GLB (수정 금지)
/assets/ready/     — 최적화 완료 에셋 (Unity 임포트용)
/unity/            — Unity 프로젝트 루트
/unity/Assets/VRC/ — VRChat 전용 씬, 스크립트, 프리팹
/logs/             — 에이전트 실행 로그
/web-belltui/      — 2D 웹 프로토타입 (참고용)
/design/           — 디자인 기획 문서

## 에이전트 역할 (이 Codex 인스턴스)
- world_spec 생성 (plan 서브에이전트)
- 3D 에셋 API 병렬 호출 (asset 서브에이전트)
- Blender Python 리토폴/최적화 (repair 서브에이전트)
- Unity Editor CLI 씬 조립 (scene 서브에이전트)
- UdonSharp 스크립트 생성·컴파일 (logic 서브에이전트)
- VRChat SDK 빌드·업로드 (ship 서브에이전트)

## 벨튀 게임 시스템 (UdonSharp)
- `GameManager.cs` — 점수, 콤보, 타이머, 라운드 관리
- `BellButton.cs` — 초인종 Interact → 벨 + 문 + 점수
- `DoorController.cs` — 문 열림, NPC 반응, 플레이어 감지/추적
- `ScoreBoard.cs` — Canvas UI 실시간 스코어보드
- `NotorietySystem.cs` — 악명 레벨 → 감시 시스템 활성화
- `HideSpot.cs` — 트리거 기반 숨기 장소
- `FloorElevator.cs` — 층간 텔레포트

## 멀티 스트리머 지원
- VRChat 네이티브 아바타 시스템 활용 (별도 캐릭터 시스템 불필요)
- 어떤 아바타로든 게임 플레이 가능
- 스코어보드에 VRChat displayName 표시
- Avatar Pedestal로 빌런 아바타 선택 옵션 제공

## 경량화 규칙 (Quest 호환)
- 총 폴리곤 50,000 이하
- 드로우콜 100 이하
- 텍스처 최대 1024px (2048px 절대 금지)
- 실시간 라이트 0개 (전부 라이트맵 베이크)
- 셰이더: Mobile/Standard Lite 전용
- 빌드 크기 50MB 이하
- 네온 효과 = Emission 텍스처 (라이트 대신)
- 파티클 최소화

## 절대 금지
- /assets/raw/ 파일 직접 수정 금지
- Unity 씬에서 VRC_SceneDescriptor 제거 금지
- UdonSharp에서 SendCustomNetworkEvent 무한 루프 생성 금지
- 텍스처 해상도 2048px 초과 금지
- 단일 메쉬 폴리곤 70,000 초과 금지
- Update()에서 매 프레임 네트워크 동기화 금지

## 도구 사용 규칙
- bash 실행 시 항상 /logs/에 타임스탬프 로그 기록
- Unity Editor -batchmode 사용 시 반드시 -quit 플래그 포함
- API 실패 시 3회 재시도 후 asset_manifest에 failed 마킹
