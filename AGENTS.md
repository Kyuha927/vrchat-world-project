# VRChat AI Pipeline — Codex Agent Context

## 프로젝트 목표
유저 텍스트 입력으로부터 VRChat에 업로드 가능한 월드를 자동 생성한다.

## 폴더 구조
/world_spec/       — world_spec.json, room_graph.json, asset_manifest.json
/assets/raw/       — AI 생성 원본 GLB (수정 금지)
/assets/ready/     — 최적화 완료 에셋 (Unity 임포트용)
/unity/            — Unity 프로젝트 루트
/unity/Assets/VRC/ — VRChat 전용 씬, 스크립트, 프리팹
/logs/             — 에이전트 실행 로그

## 에이전트 역할 (이 Codex 인스턴스)
- world_spec 생성 (plan 서브에이전트)
- 3D 에셋 API 병렬 호출 (asset 서브에이전트)
- Blender Python 리토폴/최적화 (repair 서브에이전트)
- Unity Editor CLI 씬 조립 (scene 서브에이전트)
- UdonSharp 스크립트 생성·컴파일 (logic 서브에이전트)
- VRChat SDK 빌드·업로드 (ship 서브에이전트)

## 절대 금지
- /assets/raw/ 파일 직접 수정 금지
- Unity 씬에서 VRC_SceneDescriptor 제거 금지
- UdonSharp에서 SendCustomNetworkEvent 무한 루프 생성 금지
- 텍스처 해상도 2048px 초과 금지 (VRChat 성능 예산)
- 단일 메쉬 폴리곤 70,000 초과 금지

## 도구 사용 규칙
- bash 실행 시 항상 /logs/에 타임스탬프 로그 기록
- Unity Editor -batchmode 사용 시 반드시 -quit 플래그 포함
- API 실패 시 3회 재시도 후 asset_manifest에 failed 마킹
