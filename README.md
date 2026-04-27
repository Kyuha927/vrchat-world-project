# VRChat AI Pipeline Setup

This scaffold was created from `docs/vrchat-ai-agent-setup.html`.

## Main flow
1. `scripts/gen_spec.py`
2. `scripts/gen_assets.py`
3. `scripts/repair_assets.py`
4. `scripts/assemble_scene.py`
5. `scripts/gen_udon.py`
6. `scripts/qa_check.py`

Each script writes a timestamped log under `logs/`.

## Codex master prompt
다음 VRChat 월드를 AI 파이프라인으로 자동 생성해줘.

월드 설명: [여기에 월드 콘셉트를 한 문장으로]

실행 순서:
1. `scripts/gen_spec.py`를 실행해서 위 설명을 `world_spec/world_spec.json`, `room_graph.json`, `asset_manifest.json`으로 변환해줘.
2. `scripts/gen_assets.py`를 실행해서 `asset_manifest`의 모든 에셋을 병렬로 Meshy API에 요청하고 `/assets/raw/`에 저장해줘. 실패한 항목은 `asset_manifest`에 `"status": "failed"`로 마킹해줘.
3. `scripts/repair_assets.py`를 실행해서 `/assets/raw/`의 모든 GLB를 Blender Python으로 리토폴로지, UV, LOD 생성, 콜라이더 단순화 처리하고 `/assets/ready/`에 저장해줘. 폴리곤은 오브젝트당 최대 15,000으로 제한.
4. `scripts/assemble_scene.py`를 실행해서 Unity Editor `-batchmode`로 `/assets/ready/`의 에셋을 임포트하고, `room_graph.json` 구조에 따라 씬에 배치해줘. `VRC_SceneDescriptor`를 자동으로 부착해줘.
5. `scripts/gen_udon.py`를 실행해서 `world_spec`의 `interactions` 목록을 UdonSharp 스크립트로 변환하고 `/unity/Assets/VRC/Scripts/`에 저장해줘.
6. `scripts/qa_check.py`를 실행해서 성능 예산을 검사해줘.

## Antigravity prompt
너는 VRChat 월드 자동 생성 파이프라인의 오케스트레이터 에이전트야.

현재 프로젝트 루트에 `world_spec/`, `assets/`, `unity/`, `scripts/`, `logs/` 폴더가 있어.

- Phase 1: `world_spec/world_spec.json`을 읽고 Implementation Plan 아티팩트 생성
- Phase 2: `logs/`를 모니터링해 Task List 아티팩트 업데이트
- Phase 3: 씬 조립 후 비주얼 QA
- Phase 4: 빌드 전 최종 체크리스트 생성
